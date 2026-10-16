/* 生成 200px 宽封面缩略图：assets/covers/*.jpg → assets/thumbs/*.jpg */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const SRC = path.resolve(__dirname, "..", "assets", "covers");
const DST = path.resolve(__dirname, "..", "assets", "thumbs");

(async () => {
  if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".jpg"));
  let done = 0, skipped = 0;
  for (const f of files) {
    const out = path.join(DST, f);
    if (fs.existsSync(out) && fs.statSync(out).size > 2000) { skipped++; continue; }
    await sharp(path.join(SRC, f))
      .resize({ width: 200 })
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(out);
    done++;
    if (done % 50 === 0) console.log("progress", done + skipped, "/", files.length);
  }
  const totalBytes = fs.readdirSync(DST).reduce((n, f) => n + fs.statSync(path.join(DST, f)).size, 0);
  console.log("DONE. resized:", done, "skipped:", skipped, "| thumbs size:", (totalBytes / 1048576).toFixed(1) + "MB");
})();
