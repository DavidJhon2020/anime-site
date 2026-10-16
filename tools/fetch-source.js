/* Fetch and archive the public source pages with normal TLS verification. */
const fs = require("fs");
const path = require("path");
const seasons = require("./seasons");
const OUT = path.join(__dirname, "snapshots");
const MAX_ATTEMPTS = 3;
function option(name) { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; }
function choose() {
  const value = option("--only");
  if (!value) return seasons;
  const keys = value.split(",").map((item) => item.trim());
  const selected = seasons.filter((season) => keys.includes(season.key) || keys.includes(season.page));
  const missing = keys.filter((key) => !selected.some((season) => season.key === key || season.page === key));
  if (missing.length) throw new Error(`Unknown season key/page: ${missing.join(", ")}`);
  return selected;
}
async function fetchOne(season) {
  const url = `https://yuc.wiki/${season.page}/`;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
        headers: { "user-agent": "SeasonalAnimeQuarterly/1.0 (public source archive)", accept: "text/html" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const count = html.match(/共收录[\s\S]{0,180}?<u>\s*(\d+)\s*<\/u>/i);
      const entries = (html.match(/class=["']title_cn_r\d*["']/gi) || []).length;
      if (!/<html\b/i.test(html) || html.length < 20000 || !count || entries < season.minCount) {
        throw new Error(`页面结构不完整（${html.length} 字节，识别 ${entries} 条，公告 ${count ? count[1] : "无"}）`);
      }
      if (entries !== Number(count[1])) throw new Error(`页面公告 ${count[1]} 条，但解析到 ${entries} 个标题节点`);
      fs.mkdirSync(OUT, { recursive: true });
      const target = path.join(OUT, `yuc${season.page}.html`);
      const temporary = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, html, "utf8");
      fs.renameSync(temporary, target);
      console.log(`${season.key}: fetched ${entries} entries (${Buffer.byteLength(html)} bytes) -> ${path.relative(path.resolve(__dirname, ".."), target)}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`${season.key}: fetch attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = 1000 * 2 ** attempt;
        console.warn(`${season.key}: retrying in ${delayMs / 1000}s`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`${season.key} (${url}): ${lastError.message}`);
}
(async () => {
  const selected = choose();
  for (const season of selected) await fetchOne(season);
})().catch((error) => { console.error(`fetch-source failed: ${error.message}`); process.exitCode = 1; });
