/* Data integrity, stable-ID diff, local DOM smoke checks and optional Pages parity. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const http = require("http");
const seasonsConfig = require("./seasons");
const ROOT = path.resolve(__dirname, "..");
function option(name, fallback) { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; }
function has(name) { return process.argv.includes(name); }
function readData(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context);
  if (!context.window.SEASONAL_DATA) throw new Error(`${path.relative(ROOT, file)} did not define window.SEASONAL_DATA`);
  return context.window.SEASONAL_DATA;
}
function collectIssues(data, label) {
  const issues = [];
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.updated || "")) issues.push(`${label}: updated must be YYYY-MM-DD`);
  if (!Array.isArray(data?.seasons) || !data.seasons.length) return [...issues, `${label}: no seasons`];
  const seenSeason = new Set(), seenId = new Set();
  for (const season of data.seasons) {
    if (seenSeason.has(season.key)) issues.push(`${label}: duplicate season ${season.key}`);
    seenSeason.add(season.key);
    const config = seasonsConfig.find((item) => item.key === season.key);
    if (!config) issues.push(`${label}: season not configured: ${season.key}`);
    const entries = Array.isArray(season.items) ? season.items : [];
    if (config && entries.length < config.minCount) issues.push(`${label}: ${season.key} has ${entries.length} items (minimum ${config.minCount})`);
    const seasonIds = new Set();
    for (const item of entries) {
      if (!item.id || seasonIds.has(item.id) || seenId.has(item.id)) issues.push(`${label}: missing or duplicate ID ${item.id || "(empty)"}`);
      seasonIds.add(item.id); seenId.add(item.id);
      if (!item.cn && !item.jp) issues.push(`${label}: ${item.id} has no usable title`);
      if (!item.cover || !fs.existsSync(path.join(ROOT, item.cover))) issues.push(`${label}: missing cover for ${item.id} (${item.cover || "empty"})`);
      const thumb = item.cover && item.cover.replace("assets/covers/", "assets/thumbs/");
      if (!thumb || !fs.existsSync(path.join(ROOT, thumb))) issues.push(`${label}: missing thumbnail for ${item.id}`);
    }
  }
  for (const config of seasonsConfig) if (!seenSeason.has(config.key)) issues.push(`${label}: missing configured season ${config.key}`);
  return issues;
}
function checkShell() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8");
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)/g)].map((match) => match[1]));
  const used = new Set([...app.matchAll(/\$\(["']#([\w-]+)/g)].map((match) => match[1]));
  const issues = [...used].filter((id) => !ids.has(id)).map((id) => `app.js selects missing #${id} in index.html`);
  for (const view of ["timetable", "gallery", "list"]) {
    if (!html.includes(`data-view="${view}"`)) issues.push(`index.html is missing the ${view} view control`);
  }
  if (!/<time\b[^>]*id=["']footerUpdatedAt["']/.test(html)) issues.push("index.html is missing the publication date time element");
  const dataScript = html.indexOf("assets/js/data.js"), appScript = html.indexOf("assets/js/app.js");
  if (dataScript < 0 || appScript < 0 || dataScript > appScript) issues.push("index.html must load data.js before app.js");
  if (!app.includes("footerUpdatedAt.dateTime = DATA.updated")) issues.push("app.js does not bind the footer date to DATA.updated");
  return { ids: ids.size, selectors: used.size, issues };
}
function compareData(candidate, current, allowChanges) {
  const issues = [];
  const allIds = (season) => new Set((season?.items || []).map((item) => item.id));
  for (const config of seasonsConfig) {
    const before = current.seasons.find((season) => season.key === config.key);
    const after = candidate.seasons.find((season) => season.key === config.key);
    if (!after) continue;
    const oldIds = allIds(before), newIds = allIds(after);
    const removed = [...oldIds].filter((id) => !newIds.has(id)).sort();
    const added = [...newIds].filter((id) => !oldIds.has(id)).sort();
    console.log(`${config.key}: ${before ? before.items.length : 0} → ${after.items.length} | +${added.length} -${removed.length}`);
    if (added.length) console.log(`  added IDs: ${added.join(", ")}`);
    if (removed.length) console.log(`  removed IDs: ${removed.join(", ")}`);
    if (!allowChanges && removed.length > config.maxRemoved) issues.push(`${config.key}: ${removed.length} removed IDs exceeds the safety limit ${config.maxRemoved}; review and rerun with --approve-changes`);
    if (before && !allowChanges && Math.abs(after.items.length - before.items.length) > config.countTolerance) {
      issues.push(`${config.key}: count changed by ${after.items.length - before.items.length}, outside ±${config.countTolerance}; review and rerun with --approve-changes`);
    }
  }
  return issues;
}
function verifyIdMap(file, data) {
  if (!fs.existsSync(file)) return [`missing ID map: ${path.relative(ROOT, file)}`];
  let map;
  try { map = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { return [`invalid ID map JSON: ${error.message}`]; }
  const issues = [];
  if (map.version !== 1 || !map.titles || typeof map.titles !== "object") issues.push("ID map must contain version 1 and a titles object");
  for (const season of data.seasons) {
    const pairs = Object.entries(map.titles?.[season.key] || {});
    const seen = new Map();
    for (const [title, id] of pairs) {
      if (!/^(jp|cn):.+/.test(title)) issues.push(`invalid title key in ID map: ${season.key}/${title}`);
      if (seen.has(title) && seen.get(title) !== id) issues.push(`conflicting title key in ID map: ${season.key}/${title}`);
      seen.set(title, id);
    }
    for (const item of season.items) {
      const mapIds = [`jp:${normalize(item.jp)}`, `cn:${normalize(item.cn)}`].filter((key) => !key.endsWith(":" )).map((key) => map.titles?.[season.key]?.[key]).filter(Boolean);
      if (!mapIds.includes(item.id)) issues.push(`${season.key}: ${item.id} is not reachable from its title in ID map`);
    }
  }
  return issues;
}
function normalize(value) { return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, ""); }
function serve() {
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
  const server = http.createServer((request, response) => {
    let relative;
    try { relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, "") || "index.html"; }
    catch { response.writeHead(400).end("bad path"); return; }
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, "index.html")) { response.writeHead(403).end("forbidden"); return; }
    fs.readFile(file, (error, body) => {
      if (error) { response.writeHead(404).end("not found"); return; }
      response.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" }).end(body);
    });
  });
  return server;
}
async function domChecks(candidateFile) {
  const { chromium } = require("playwright");
  const server = serve();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    const channel = process.env.PLAYWRIGHT_CHANNEL;
    try { browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true }); }
    catch (firstError) {
      if (channel || process.platform !== "win32") throw firstError;
      browser = await chromium.launch({ channel: "msedge", headless: true });
    }
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (response.url().includes("127.0.0.1") && response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    if (candidateFile) {
      const body = fs.readFileSync(candidateFile, "utf8");
      await page.route("**/assets/js/data.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body }));
    }
    const port = server.address().port;
    await page.goto(`http://127.0.0.1:${port}/?view=timetable`, { waitUntil: "load" });
    for (const selector of ["#galleryView", "#listView", "#timetableView", "#searchInput", "#updatedAt", "#footerUpdatedAt", ".view-btn[data-view='timetable']", ".view-btn[data-view='gallery']", ".view-btn[data-view='list']"]) {
      if (await page.locator(selector).count() !== 1) errors.push(`missing or duplicate DOM node ${selector}`);
    }
    const expectedDate = candidateFile ? readData(candidateFile).updated : readData(path.join(ROOT, "assets/js/data.js")).updated;
    if (await page.locator("#footerUpdatedAt").textContent() !== expectedDate) errors.push("footer issue date does not match data.updated");
    for (const view of ["gallery", "list", "timetable"]) {
      await page.locator(`.view-btn[data-view="${view}"]`).click();
      const shown = await page.locator(`#${view === "gallery" ? "galleryView" : view === "list" ? "listView" : "timetableView"}`).evaluate((node) => !node.hidden);
      if (!shown) errors.push(`${view} view did not become visible`);
      const count = await page.locator(`#${view === "gallery" ? "galleryView" : view === "list" ? "listView" : "timetableView"} [data-id]`).count();
      if (!count) errors.push(`${view} view rendered no entries`);
    }
    if (errors.length) throw new Error(`DOM verification failed:\n- ${errors.join("\n- ")}`);
    console.log("DOM smoke checks passed: required nodes, footer date, and all three views.");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function comparePublished(url) {
  const base = url.endsWith("/") ? url : `${url}/`;
  const files = ["index.html", "assets/css/style.css", "assets/js/app.js", "assets/js/data.js"];
  const errors = [];
  for (const relative of files) {
    const response = await fetch(new URL(relative, base), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) { errors.push(`${relative}: HTTP ${response.status}`); continue; }
    const remote = Buffer.from(await response.arrayBuffer());
    const local = fs.readFileSync(path.join(ROOT, relative));
    if (!remote.equals(local)) errors.push(`${relative}: published file differs (${remote.length} remote bytes / ${local.length} local bytes)`);
    else console.log(`${relative}: matches published site`);
  }
  if (errors.length) throw new Error(`Published site verification failed:\n- ${errors.join("\n- ")}`);
}
async function main() {
  const livePath = path.join(ROOT, "assets/js/data.js");
  const candidateFile = option("--candidate", null) && path.resolve(option("--candidate", null));
  const candidateMap = path.resolve(option("--candidate-map", path.join(__dirname, candidateFile ? "id-map.candidate.json" : "id-map.json")));
  const compareFile = path.resolve(option("--compare", livePath));
  const data = readData(candidateFile || compareFile);
  const current = readData(compareFile);
  const shell = checkShell();
  const issues = [...shell.issues, ...collectIssues(data, candidateFile ? "candidate" : "data"), ...verifyIdMap(candidateMap, data)];
  if (candidateFile) issues.push(...compareData(data, current, has("--approve-changes")));
  if (issues.length) throw new Error(`Static data verification failed:\n- ${issues.join("\n- ")}`);
  console.log(`Static data checks passed: ${data.seasons.length} seasons, ${data.seasons.reduce((n, season) => n + season.items.length, 0)} items.`);
  console.log(`Static shell checks passed: ${shell.ids} HTML IDs, ${shell.selectors} app.js selectors, view controls and footer date.`);
  if (!has("--no-dom")) await domChecks(candidateFile);
  const url = option("--url", null);
  if (url) await comparePublished(url);
}
main().catch((error) => { console.error(`verify failed: ${error.message}`); process.exitCode = 1; });
