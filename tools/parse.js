/* 解析 yuc.wiki 季度新番表 → 结构化 JSON */
const fs = require("fs");
const DIR = __dirname;

const SEASONS = [
  { key: "2025-summer", page: "202507", year: 2025, season: "夏" },
  { key: "2025-autumn", page: "202510", year: 2025, season: "秋" },
  { key: "2026-winter", page: "202601", year: 2026, season: "冬" },
  { key: "2026-spring", page: "202604", year: 2026, season: "春" },
  { key: "2026-summer", page: "202607", year: 2026, season: "夏" },
  { key: "2026-autumn", page: "202610", year: 2026, season: "秋" }
];

function clean(s) {
  if (!s) return "";
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function field(chunk, re) {
  const m = chunk.match(re);
  return m ? clean(m[1]) : "";
}

const out = [];
for (const s of SEASONS) {
  const html = fs.readFileSync(`${DIR}/yuc${s.page}.html`, "utf8");
  const chunks = html.split(/<div style="clear:both"><\/div>/);
  let n = 0;
  for (const chunk of chunks) {
    if (chunk.indexOf("title_cn_r") === -1) continue;
    n++;
    const img = field(chunk, /data-src="([^"]+)"/);
    const cn = field(chunk, /<p class="title_cn_r\d*">([\s\S]*?)<\/p>/);
    const jp = field(chunk, /<p class="title_jp_r\d*">([\s\S]*?)<\/p>/);
    const type = field(chunk, /<td class="type_[a-z]_r\d*">([\s\S]*?)<\/td>/);
    const tags = field(chunk, /<td class="type_tag_r\d*">([\s\S]*?)<\/td>/);
    const studio = field(chunk, /动画制作：([^<\n]*)/);
    const author = field(chunk, /原作：([^<\n]*)/);
    const broadcast = field(chunk, /<p class="broadcast_r\d*">([\s\S]*?)<\/p>/);
    if (!cn && !jp) { console.log("SKIP in", s.key, ":", clean(chunk.slice(0, 120))); continue; }
    out.push({
      id: `${s.key}-${String(n).padStart(3, "0")}`,
      season: s.key,
      cn: cn || jp,
      jp,
      type,
      tags: tags ? tags.split(/[\/、,，]/).map(clean).filter(Boolean) : [],
      studio,
      author,
      broadcast,
      img
    });
  }
  console.log(s.key, "entries:", n);
}

fs.writeFileSync(`${DIR}/parsed.json`, JSON.stringify(out, null, 1));
console.log("TOTAL:", out.length);
console.log("with img:", out.filter((e) => e.img).length);
console.log("with studio:", out.filter((e) => e.studio).length);
