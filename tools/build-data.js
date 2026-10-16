/* 由 parsed.json 生成最终 data.js */
const fs = require("fs");
const DIR = __dirname;
const data = require("./parsed.json");

const SEASON_META = {
  "2025-summer": { year: 2025, season: "夏", tagline: "续作霸权与新作黑马扎堆的一个夏天——从灵异青春到科幻求生，密度极高。" },
  "2025-autumn": { year: 2025, season: "秋", tagline: "霸权续作集结的秋天——一拳超人、间谍过家家与我的英雄学院同台竞演。" },
  "2026-winter": { year: 2026, season: "冬", tagline: "开年即王炸——咒术回战、葬送的芙莉莲与我推的孩子三巨头同季回归。" },
  "2026-spring": { year: 2026, season: "春", tagline: "恋爱时代与神仙续作——从荒川弘新作到 Re:0 第四季，密度罕见。" },
  "2026-summer": { year: 2026, season: "夏", tagline: "BLEACH 终章、攻壳重启与无职转生——夏天的重量级阵容。" },
  "2026-autumn": { year: 2026, season: "秋", current: true, tagline: "药屋、黑五与边缘行者 2 领衔——2026 年最后的盛宴，续作浓度全年最高。" }
};

const PICKS = {
  "2025-summer": ["胆大党", "废渊战鬼", "光死去的夏天"],
  "2025-autumn": ["一拳超人", "间谍过家家", "我的英雄学院"],
  "2026-winter": ["咒术回战", "葬送的芙莉莲"],
  "2026-spring": ["黄泉的使者", "异兽魔都", "春夏秋冬"],
  "2026-summer": ["BLEACH", "攻壳"],
  "2026-autumn": ["药屋", "黑色五叶草", "冰之城墙", "FX战士"]
};

function normType(t) {
  if (!t) return "其他";
  if (t.includes("漫画") || t.includes("韩漫")) return "漫画";
  if (t.includes("小说")) return "小说";
  if (t.includes("原创")) return "原创";
  if (t.includes("游戏")) return "游戏";
  return "其他";
}

function dateInfo(b) {
  let m = (b || "").match(/(\d{1,2})\/(\d{1,2})/);
  if (m) return { short: m[1] + "/" + m[2], sort: parseInt(m[1], 10) * 100 + parseInt(m[2], 10) };
  m = (b || "").match(/(\d{1,2})月/);
  if (m) return { short: m[1] + "月", sort: parseInt(m[1], 10) * 100 + 99 };
  return { short: b || "待定", sort: 99999 };
}

const order = ["2025-summer", "2025-autumn", "2026-winter", "2026-spring", "2026-summer", "2026-autumn"];
const seasons = order.map((key) => {
  const meta = SEASON_META[key];
  const items = data
    .filter((e) => e.season === key)
    .map((e) => {
      const d = dateInfo(e.broadcast);
      return {
        id: e.id,
        cn: e.cn,
        jp: e.jp || "",
        type: normType(e.type),
        tags: e.tags.slice(0, 4),
        studio: e.studio || "",
        author: e.author || "",
        dateShort: d.short,
        broadcast: e.broadcast || "",
        sort: d.sort,
        cover: "assets/covers/" + e.id + ".jpg",
        pick: PICKS[key].some((p) => e.cn.includes(p) || (e.jp || "").includes(p))
      };
    })
    .sort((a, b) => a.sort - b.sort);
  return Object.assign({ key }, meta, { items });
});

let total = 0, picks = 0;
seasons.forEach((s) => { total += s.items.length; picks += s.items.filter((i) => i.pick).length; });
console.log("seasons:", seasons.length, "total:", total, "picks:", picks);

const js =
  "/**\n" +
  " * 新番导览 · 数据文件（全量版）\n" +
  " * 收录 2025 夏季 – 2026 秋季共 6 个季度的日本 TV 动画，每季全量片单。\n" +
  " * 数据整理自 長門番堂 季度新番一览（yuc.wiki）；封面为各作品官方视觉图。\n" +
  " * 最近更新：" + "2026-10-15\n" +
  " */\n" +
  "window.SEASONAL_DATA = " + JSON.stringify({ updated: "2026-10-15", seasons }, null, 1) + ";\n";

fs.writeFileSync(require("path").join(__dirname, "..", "assets", "js", "data.js"), js);
console.log("data.js written,", js.length, "bytes");
