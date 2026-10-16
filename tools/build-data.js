/* Build a candidate data.js from parser output without touching the published file. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const seasonsConfig = require("./seasons");
function option(name, fallback) { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; }
function readData(file) { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx); return ctx.window.SEASONAL_DATA; }
function dateInfo(value) {
  let match = (value || "").match(/(\d{1,2})\/(\d{1,2})/);
  if (match) return { short: `${match[1]}/${match[2]}`, sort: Number(match[1]) * 100 + Number(match[2]) };
  match = (value || "").match(/(\d{1,2})月/);
  return match ? { short: `${match[1]}月`, sort: Number(match[1]) * 100 + 99 } : { short: value || "待定", sort: 99999 };
}
function normType(value) {
  if (!value) return "其他";
  if (/漫画|韩漫/.test(value)) return "漫画";
  if (/小说/.test(value)) return "小说";
  if (/原创/.test(value)) return "原创";
  if (/游戏/.test(value)) return "游戏";
  return "其他";
}
function main() {
  const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, "parsed.json"), "utf8"));
  const out = option("--out", path.join(ROOT, ".tmp", "data.candidate.js"));
  const onlyArg = option("--only", (parsed.selected || []).join(","));
  const selected = new Set(onlyArg.split(",").filter(Boolean));
  const livePath = path.join(ROOT, "assets/js/data.js");
  const live = readData(livePath);
  const parsedSeasons = parsed.seasons || {};
  const seasons = seasonsConfig.map((config) => {
    if (!selected.has(config.key)) {
      const previous = live.seasons.find((entry) => entry.key === config.key);
      if (!previous) throw new Error(`No existing data for ${config.key}; include it in parsed.json`);
      return previous;
    }
    const source = parsedSeasons[config.key];
    if (!source || !Array.isArray(source.items)) throw new Error(`Missing parsed season ${config.key}`);
    const items = source.items.map((entry) => {
      const date = dateInfo(entry.broadcast);
      return {
        id: entry.id, cn: entry.cn, jp: entry.jp || "", type: normType(entry.type),
        tags: (entry.tags || []).slice(0, 4), studio: entry.studio || "", author: entry.author || "",
        dateShort: date.short, broadcast: entry.broadcast || "", sort: date.sort,
        cover: `assets/covers/${entry.id}.jpg`,
        pick: config.picks.some((word) => entry.cn.includes(word) || (entry.jp || "").includes(word))
      };
    }).sort((a, b) => a.sort - b.sort);
    return { key: config.key, year: config.year, season: config.season, ...(config.current ? { current: true } : {}), tagline: config.tagline, items };
  });
  if (new Set(seasons.map((season) => season.key)).size !== seasonsConfig.length) throw new Error("Season configuration contains duplicate keys");
  const data = { updated: new Date().toISOString().slice(0, 10), seasons };
  const count = seasons.reduce((n, season) => n + season.items.length, 0);
  const picks = seasons.reduce((n, season) => n + season.items.filter((item) => item.pick).length, 0);
  const first = seasons[0], last = seasons[seasons.length - 1];
  const period = `${first.year} ${first.season}季 – ${last.year} ${last.season}季`;
  const js = `/**\n * 季刊新番 · 数据文件（全量版）\n * 收录 ${period} 共 ${seasons.length} 个季度的日本 TV 动画，共 ${count} 部。\n * 数据整理自 長門番堂 季度新番一览（yuc.wiki）；封面为各作品官方视觉图。\n * 最近更新：${data.updated}\n */\nwindow.SEASONAL_DATA = ${JSON.stringify(data, null, 1)};\n`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, js);
  console.log(`candidate written: ${path.relative(ROOT, out)} | ${seasons.length} seasons, ${count} entries, ${picks} picks`);
}
try { main(); } catch (error) { console.error(`build-data failed: ${error.message}`); process.exitCode = 1; }
