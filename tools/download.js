/* 批量下载封面图到 assets/covers/ */
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "covers");
const data = require("./parsed.json");

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.bilibili.com/" }, timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function downloadOne(entry, tries = 3) {
  const file = path.join(OUT, entry.id + ".jpg");
  if (fs.existsSync(file) && fs.statSync(file).size > 5000) return "cached";
  const url = entry.img.replace(/^http:/, "https:");
  for (let t = 1; t <= tries; t++) {
    try {
      const buf = await get(url);
      if (buf.length < 5000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("bad image " + buf.length);
      fs.writeFileSync(file, buf);
      return "ok";
    } catch (e) {
      if (t === tries) return "fail: " + e.message;
      await new Promise((r) => setTimeout(r, 800 * t));
    }
  }
}

(async () => {
  const conc = 6;
  let i = 0, ok = 0, cached = 0, fail = 0;
  const fails = [];
  async function worker() {
    while (i < data.length) {
      const idx = i++;
      const r = await downloadOne(data[idx]);
      if (r === "ok") ok++;
      else if (r === "cached") cached++;
      else { fail++; fails.push(data[idx].id + " " + r); }
      if ((ok + cached + fail) % 40 === 0) console.log("progress", ok + cached + fail, "/", data.length);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  console.log("DONE ok=" + ok, "cached=" + cached, "fail=" + fail);
  if (fails.length) console.log(fails.join("\n"));
})();
