/* Parse checked-in yuc.wiki HTML snapshots into tools/parsed.json. */
const fs = require("fs");
const path = require("path");
const seasons = require("./seasons");
const root = path.resolve(__dirname, "..");
const snapshotDir = path.join(__dirname, "snapshots");
const mapPath = path.join(__dirname, "id-map.json");
const candidateMapPath = path.join(__dirname, "id-map.candidate.json");

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") out.only = argv[++i];
    else if (argv[i] === "--help") out.help = true;
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return out;
}
function normalized(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, "");
}
function decode(value) {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ").trim();
}
function field(chunk, re) {
  const match = chunk.match(re);
  return match ? decode(match[1]) : "";
}
function keysFor(item) {
  const keys = [];
  if (item.jp) keys.push(`jp:${normalized(item.jp)}`);
  if (item.cn) keys.push(`cn:${normalized(item.cn)}`);
  return [...new Set(keys.filter((key) => !key.endsWith(":")))];
}
function loadExistingData() {
  const vm = require("vm");
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/data.js"), "utf8"), context);
  return context.window.SEASONAL_DATA;
}
function seedMap(data) {
  const titles = {};
  for (const season of data.seasons) {
    titles[season.key] = titles[season.key] || {};
    for (const item of season.items) {
      for (const key of keysFor(item)) {
        if (!(key in titles[season.key])) titles[season.key][key] = item.id;
      }
    }
  }
  return { version: 1, titles };
}
function parseSeason(season) {
  const file = path.join(snapshotDir, `yuc${season.page}.html`);
  if (!fs.existsSync(file)) throw new Error(`Missing source snapshot: ${path.relative(root, file)} (run node tools/fetch-source.js --only ${season.key})`);
  const html = fs.readFileSync(file, "utf8");
  if (!/<html\b/i.test(html) || !/title_cn_r/i.test(html)) throw new Error(`${season.key}: snapshot does not look like a source page`);
  const advertised = html.match(/共收录[\s\S]{0,180}?<u>\s*(\d+)\s*<\/u>/i);
  if (!advertised) throw new Error(`${season.key}: source advertised count was not found`);
  const chunks = html.split(/<div\s+style=["']clear:both["']\s*>\s*<\/div>/i);
  const items = [];
  for (const chunk of chunks) {
    if (!/title_cn_r/i.test(chunk)) continue;
    const cn = field(chunk, /<p\s+class=["']title_cn_r\d*["'][^>]*>([\s\S]*?)<\/p>/i);
    const jp = field(chunk, /<p\s+class=["']title_jp_r\d*["'][^>]*>([\s\S]*?)<\/p>/i);
    const type = field(chunk, /<td\s+class=["']type_[a-z]_r\d*["'][^>]*>([\s\S]*?)<\/td>/i);
    const tags = field(chunk, /<td\s+class=["']type_tag_r\d*["'][^>]*>([\s\S]*?)<\/td>/i);
    const studio = field(chunk, /动画制作：([^<\n]*)/i);
    const author = field(chunk, /原作：([^<\n]*)/i);
    const broadcast = field(chunk, /<p\s+class=["']broadcast_r\d*["'][^>]*>([\s\S]*?)<\/p>/i);
    const img = field(chunk, /(?:data-src|src)=["']([^"']+)["']/i);
    if (!cn && !jp) continue;
    if (items.some((item) => item.jp && jp && normalized(item.jp) === normalized(jp))) {
      throw new Error(`${season.key}: duplicate Japanese title in source: ${jp}`);
    }
    items.push({ season: season.key, cn: cn || jp, jp, type, tags: tags ? tags.split(/[\/、,，]/).map(decode).filter(Boolean) : [], studio, author, broadcast, img });
  }
  const sourceCount = Number(advertised[1]);
  if (items.length < season.minCount) throw new Error(`${season.key}: parsed only ${items.length} titles (minimum ${season.minCount}); refusing to continue`);
  if (items.length !== sourceCount) throw new Error(`${season.key}: parsed ${items.length} titles but source advertises ${sourceCount}`);
  return { sourceCount, items };
}
function main() {
  const args = argsOf(process.argv.slice(2));
  if (args.help) { console.log("node tools/parse.js [--only season-key[,season-key...]]"); return; }
  const selected = args.only ? args.only.split(",").map((v) => v.trim()) : seasons.map((s) => s.key);
  const unknown = selected.filter((key) => !seasons.some((s) => s.key === key));
  if (unknown.length) throw new Error(`Unknown season key(s): ${unknown.join(", ")}`);
  const live = loadExistingData();
  const existingMap = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : seedMap(live);
  const candidateMap = JSON.parse(JSON.stringify(existingMap));
  candidateMap.version = 1;
  candidateMap.titles = candidateMap.titles || {};
  const parsedSeasons = {};
  for (const season of seasons.filter((s) => selected.includes(s.key))) {
    const parsed = parseSeason(season);
    const titleMap = candidateMap.titles[season.key] || (candidateMap.titles[season.key] = {});
    const currentIds = [...(live.seasons.find((entry) => entry.key === season.key)?.items || []).map((item) => item.id), ...Object.values(titleMap)];
    let nextId = currentIds.reduce((max, id) => Math.max(max, Number(String(id).split("-").pop()) || 0), 0) + 1;
    const seen = new Set();
    for (const item of parsed.items) {
      const keys = keysFor(item);
      const matches = [...new Set(keys.map((key) => titleMap[key]).filter(Boolean))];
      if (matches.length > 1) throw new Error(`${season.key}: title aliases point to different IDs (${matches.join(", ")}) for ${item.cn}`);
      item.id = matches[0] || `${season.key}-${String(nextId++).padStart(3, "0")}`;
      if (seen.has(item.id)) throw new Error(`${season.key}: ID collision ${item.id}`);
      seen.add(item.id);
      for (const key of keys) {
        if (titleMap[key] && titleMap[key] !== item.id) throw new Error(`${season.key}: ID map collision for ${key}`);
        titleMap[key] = item.id;
      }
    }
    parsedSeasons[season.key] = parsed;
    console.log(`${season.key}: ${parsed.items.length} entries (source says ${parsed.sourceCount})`);
  }
  fs.writeFileSync(path.join(__dirname, "parsed.json"), JSON.stringify({ version: 1, selected, seasons: parsedSeasons }, null, 1) + "\n");
  fs.writeFileSync(candidateMapPath, JSON.stringify(candidateMap, null, 1) + "\n");
  console.log(`Parsed ${Object.values(parsedSeasons).reduce((n, s) => n + s.items.length, 0)} entries; ID map candidate written.`);
}
try { main(); } catch (error) { console.error(`parse failed: ${error.message}`); process.exitCode = 1; }
