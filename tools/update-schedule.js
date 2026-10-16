/* 为 data.js 增加放送周期字段：dow（1=周一…7=周日，0=其他/网络）、slot（时段序号，-1=未标注） */
const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(__dirname, "..", "assets", "js", "data.js");

global.window = {};
require(DATA_PATH);
const data = global.window.SEASONAL_DATA;

var DOW = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7 };
var SLOTS = [
  ["凌晨", 0], ["清晨", 1], ["早间", 2], ["上午", 3], ["午间", 4], ["午后", 5],
  ["下午", 6], ["傍晚", 7], ["晚间", 8], ["夜晚", 9], ["半夜", 10], ["深夜", 11]
];
var SLOT_LABELS = ["凌晨", "清晨", "早间", "上午", "午间", "午后", "下午", "傍晚", "晚间", "夜晚", "半夜", "深夜"];

function parseSchedule(b) {
  var s = b || "";
  var dow = 0, slot = -1;
  var wm = s.match(/周([一二三四五六日天])/);
  if (wm) {
    dow = DOW[wm[1]];
    var rest = s.slice(wm.index + 1);
    var bestIdx = Infinity;
    for (var i = 0; i < SLOTS.length; i++) {
      var p = rest.indexOf(SLOTS[i][0]);
      if (p !== -1 && p < bestIdx) { bestIdx = p; slot = SLOTS[i][1]; }
    }
  }
  return { dow: dow, slot: slot };
}

var stats = {};
data.seasons.forEach(function (s) {
  s.items.forEach(function (it) {
    var sch = parseSchedule(it.broadcast);
    it.dow = sch.dow;
    it.slot = sch.slot;
    it.slotLabel = sch.slot >= 0 ? SLOT_LABELS[sch.slot] : "时段未标注";
    var k = sch.dow + "/" + sch.slot;
    stats[k] = (stats[k] || 0) + 1;
  });
});

/* 列分布统计 */
var cols = {};
Object.keys(stats).forEach(function (k) { cols[k.split("/")[0]] = (cols[k.split("/")[0]] || 0) + stats[k]; });
console.log("列分布(周一~周日,0=其他):", JSON.stringify(cols));
console.log("无时段标注:", Object.keys(stats).filter(function (k) { return k.endsWith("/-1"); }).reduce(function (n, k) { return n + stats[k]; }, 0));

var js =
  "/**\n" +
  " * 新番导览 · 数据文件（全量版）\n" +
  " * 收录 2025 夏季 – 2026 秋季共 6 个季度的日本 TV 动画，每季全量片单。\n" +
  " * 数据整理自 長門番堂 季度新番一览（yuc.wiki）；封面为各作品官方视觉图。\n" +
  " * 字段：dow=放送星期（1周一…7周日，0其他/网络），slot=时段序号（0凌晨…11深夜，-1未标注）\n" +
  " * 最近更新：2026-10-15\n" +
  " */\n" +
  "window.SEASONAL_DATA = " + JSON.stringify(data, null, 1) + ";\n";

fs.writeFileSync(DATA_PATH, js);
console.log("data.js updated,", js.length, "bytes");
