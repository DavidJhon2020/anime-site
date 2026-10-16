/* Resumable season pipeline. Generated data is validated before it replaces live files. */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const vm = require("vm");
const seasons = require("./seasons");
const ROOT = path.resolve(__dirname, "..");
const TEMP = path.join(ROOT, ".tmp");
const DATA = path.join(ROOT, "assets/js/data.js");
const DATA_CANDIDATE = path.join(TEMP, "data.candidate.js");
const ID_MAP = path.join(__dirname, "id-map.json");
const ID_MAP_CANDIDATE = path.join(__dirname, "id-map.candidate.json");
const PHASES = ["fetch", "parse", "build", "download", "schedule", "thumbs", "verify", "publish"];
function option(name, fallback) { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; }
function has(name) { return process.argv.includes(name); }
function readData(file) { const context = { window: {} }; vm.runInNewContext(fs.readFileSync(file, "utf8"), context); return context.window.SEASONAL_DATA; }
function run(file, args) {
  console.log(`\n> node tools/${file} ${args.map((arg) => arg.includes(" ") ? JSON.stringify(arg) : arg).join(" ")}`);
  execFileSync(process.execPath, [path.join(__dirname, file), ...args], { cwd: ROOT, stdio: "inherit", env: process.env });
}
function normalizeNoopDate() {
  if (!fs.existsSync(DATA_CANDIDATE) || !fs.existsSync(DATA)) return;
  const before = readData(DATA), after = readData(DATA_CANDIDATE);
  const normalize = (value) => JSON.stringify(Object.assign({}, value, { updated: "" }));
  if (normalize(before) !== normalize(after)) return;
  after.updated = before.updated;
  const first = after.seasons[0], last = after.seasons[after.seasons.length - 1];
  const range = first && last ? `${first.year} ${first.season}季 – ${last.year} ${last.season}季` : "季度片单";
  const count = after.seasons.reduce((n, season) => n + season.items.length, 0);
  const text = `/**\n * 季刊新番 · 数据文件（全量版）\n * 收录 ${range} 共 ${after.seasons.length} 个季度的日本 TV 动画，共 ${count} 部。\n * 数据整理自 長門番堂 季度新番一览（yuc.wiki）；封面为各作品官方视觉图。\n * 最近更新：${after.updated}\n */\nwindow.SEASONAL_DATA = ${JSON.stringify(after, null, 1)};\n`;
  fs.writeFileSync(DATA_CANDIDATE, text);
  console.log(`No data changes detected; preserved updated=${before.updated}.`);
}
function publish(files) {
  const backups = [];
  const temps = [];
  try {
    for (const [source, target] of files) {
      if (!fs.existsSync(source)) throw new Error(`Missing validated candidate: ${path.relative(ROOT, source)}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const temp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.publish`);
      fs.copyFileSync(source, temp);
      temps.push([temp, target]);
      if (fs.existsSync(target)) {
        const backup = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.backup`);
        fs.copyFileSync(target, backup);
        backups.push([backup, target]);
      } else backups.push([null, target]);
    }
    for (const [temp, target] of temps) fs.renameSync(temp, target);
    for (const [backup] of backups) if (backup && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  } catch (error) {
    for (let i = backups.length - 1; i >= 0; i--) {
      const [backup, target] = backups[i];
      if (backup && fs.existsSync(backup)) fs.copyFileSync(backup, target);
      else if (!backup && fs.existsSync(target)) fs.rmSync(target, { force: true });
    }
    throw error;
  } finally {
    for (const [temp] of temps) if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
    for (const [backup] of backups) if (backup && fs.existsSync(backup)) fs.rmSync(backup, { force: true });
  }
}
function main() {
  if (has("--help")) {
    console.log("node tools/update-season.js [--only season-key[,season-key...]] [--from fetch|parse|build|download|schedule|thumbs|verify|publish] [--approve-changes] [--no-dom]");
    return;
  }
  const from = option("--from", "fetch");
  const start = PHASES.indexOf(from);
  if (start < 0) throw new Error(`Unknown --from phase: ${from}`);
  let selected = option("--only", "");
  if (!selected && start >= PHASES.indexOf("build") && fs.existsSync(path.join(__dirname, "parsed.json"))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, "parsed.json"), "utf8"));
    selected = (parsed.selected || []).join(",");
  }
  const keys = selected ? selected.split(",").map((key) => key.trim()).filter(Boolean) : seasons.map((season) => season.key);
  const unknown = keys.filter((key) => !seasons.some((season) => season.key === key));
  if (unknown.length) throw new Error(`Unknown season key(s): ${unknown.join(", ")}`);
  selected = keys.join(",");
  fs.mkdirSync(TEMP, { recursive: true });
  const seasonArg = ["--only", selected];
  if (PHASES.indexOf("fetch") >= start) run("fetch-source.js", seasonArg);
  if (PHASES.indexOf("parse") >= start) run("parse.js", seasonArg);
  if (PHASES.indexOf("build") >= start) run("build-data.js", ["--out", DATA_CANDIDATE, ...seasonArg]);
  if (PHASES.indexOf("download") >= start) run("download.js", seasonArg);
  if (PHASES.indexOf("schedule") >= start) run("update-schedule.js", ["--file", DATA_CANDIDATE]);
  if (PHASES.indexOf("thumbs") >= start) run("make-thumbs.js", seasonArg);
  if (PHASES.indexOf("verify") >= start || from === "publish") {
    normalizeNoopDate();
    const verifyArgs = ["--candidate", DATA_CANDIDATE, "--candidate-map", ID_MAP_CANDIDATE, "--compare", DATA];
    if (has("--approve-changes")) verifyArgs.push("--approve-changes");
    if (has("--no-dom")) verifyArgs.push("--no-dom");
    run("verify.js", verifyArgs);
  }
  if (PHASES.indexOf("publish") >= start) {
    publish([[DATA_CANDIDATE, DATA], [ID_MAP_CANDIDATE, ID_MAP]]);
    console.log("Published data.js and id-map.json after validation.");
  }
}
try { main(); } catch (error) { console.error(`update-season failed: ${error.message}`); process.exitCode = 1; }
