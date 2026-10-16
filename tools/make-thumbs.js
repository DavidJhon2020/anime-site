/* 生成 200px 宽封面缩略图：assets/covers/*.jpg → assets/thumbs/*.jpg */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const SRC = path.resolve(__dirname, "..", "assets", "covers");
const DST = path.resolve(__dirname, "..", "assets", "thumbs");
const onlyIndex = process.argv.indexOf("--only");
const selected = onlyIndex >= 0 ? new Set(process.argv[onlyIndex + 1].split(",")) : null;
const parsedPath = path.join(__dirname, "parsed.json");
let selectedIds = null;
if (selected && fs.existsSync(parsedPath)) {
  const parsed = JSON.parse(fs.readFileSync(parsedPath, "utf8"));
  selectedIds = new Set(Object.values(parsed.seasons || {}).flatMap((season) => season.items).filter((item) => selected.has(item.season)).map((item) => `${item.id}.jpg`));
}

(async () => {
  if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".jpg") && (!selectedIds || selectedIds.has(f)));
  let done = 0, skipped = 0;
  for (const f of files) {
    const out = path.join(DST, f);
    if (fs.existsSync(out) && fs.statSync(out).size > 2000) { skipped++; continue; }
    const temporary = path.join(DST, `${f}.${process.pid}.tmp`);
    await sharp(path.join(SRC, f))
      .resize({ width: 200 })
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(temporary);
    fs.renameSync(temporary, out);
    done++;
    if (done % 50 === 0) console.log("progress", done + skipped, "/", files.length);
  }
  const totalBytes = files.reduce((n, f) => n + fs.statSync(path.join(DST, f)).size, 0);
  console.log("DONE. resized:", done, "skipped:", skipped, "| thumbs size:", (totalBytes / 1048576).toFixed(1) + "MB");
})();
