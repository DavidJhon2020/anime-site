/**
 * 季刊新番 · Seasonal Anime Quarterly
 * 期号切换 / 封面特集 / 今日明日放送 / 时刻表·图版·索引三读法 / 全局搜索 / 详情 / 纸本·夜间双主题
 */
(function () {
  "use strict";

  var DATA = window.SEASONAL_DATA;
  var SEASONS = DATA.seasons;

  var COLORS = {
    paper: { 冬: "#4267E8", 春: "#D94D79", 夏: "#168A7B", 秋: "#C85B32" },
    night: { 冬: "#91A6FF", 春: "#F08BAB", 夏: "#5CCBB4", 秋: "#F0A078" }
  };
  var SEASON_FULL = { 冬: "冬季", 春: "春季", 夏: "夏季", 秋: "秋季" };

  /* ---------- 号色体系 ----------
     四季在本刊只承担两件事：时间坐标与「号色」（每期一个识别色）。
     色用于标记，不作装饰：目次编号、图版标签、激活筛选、今日栏。
  --------------------------------- */
  var SEASON_LATIN = { 冬: "WINTER", 春: "SPRING", 夏: "SUMMER", 秋: "AUTUMN" };

  var COLOUR_NOTES = [
    { s: "冬", d: "开年档，续作密度高" },
    { s: "春", d: "新作与恋爱题材集中" },
    { s: "夏", d: "长篇终章与重启" },
    { s: "秋", d: "全年续作浓度最高" }
  ];

  var NOTES = [
    ["胆大党", "灵异、青春与街头文化的奇妙化学反应，本季最具质感的话题作。"],
    ["废渊战鬼", "骨头社操刀，画风与动作设计都极具个性的黑暗奇幻黑马。"],
    ["光死去的夏天", "年度话题悬疑恐怖作，CygamesPictures 细腻还原了原作的窒息氛围。"],
    ["一拳超人", "苦等六年的光头英雄回归，S 级英雄与怪人协会的全面战争。"],
    ["间谍过家家", "现象级合家欢回归，黄昏的过去终于要揭晓。"],
    ["我的英雄学院", "九年青春的终点，英雄与敌人的师徒对决。"],
    ["咒术回战", "死灭回游开幕，虎杖与乙骨的宿命对决。"],
    ["葬送的芙莉莲", "温暖而忧伤的旅途继续，Madhouse 的制作依旧顶级。"],
    ["黄泉的使者", "牛姨时隔多年的全新连载动画化，骨头社制作。"],
    ["异兽魔都", "风格独树一帜的 cult 经典回归。"],
    ["春夏秋冬代行者", "《紫罗兰永恒花园》作者暁佳奈原作，WIT STUDIO 制作。"],
    ["攻壳机动队", "士郎正宗原作 × Science SARU 的全新攻壳。"],
    ["死神", "二十余年的死神史诗，终于走到最后篇章。"],
    ["药屋少女", "猫猫回归，宫廷谜案升级为更大的阴谋。"],
    ["黑色五叶草", "「不放弃就是我的魔法」再度响起的秋天。"],
    ["冰之城墙", "细腻到令人心疼的青春群像剧。"],
    ["FX战士久留美", "十月最特殊的题材，一部写给投资者的警世寓言。"]
  ];
  function noteOf(item) {
    for (var i = 0; i < NOTES.length; i++) {
      if (item.cn.indexOf(NOTES[i][0]) !== -1 || (item.jp || "").indexOf(NOTES[i][0]) !== -1) return NOTES[i][1];
    }
    return "";
  }

  var STUDIO_ALIASES = [
    ["骨头社", "bones"], ["京阿尼", "kyoto animation"], ["京都动画", "kyoto animation"],
    ["飞碟社", "ufotable"], ["盲人社", "mappa"], ["马趴", "mappa"], ["扳机社", "trigger"],
    ["a1", "a-1"], ["节操社", "j.c.staff"], ["jc", "j.c.staff"], ["cw", "cloverworks"],
    ["wit", "wit studio"], ["疯房子", "madhouse"], ["银链", "silver link"],
    ["pa", "p.a.works"], ["白狐", "white fox"], ["龙之子", "tatsunoko"], ["日升", "sunrise"],
    ["动画工房", "動画工房"], ["ol", "olm"], ["小丑社", "pierrot"], ["david", "david production"]
  ];

  var state = { key: null, source: "all", pickOnly: false, view: "timetable" };
  var modalReturnFocus = null;
  var DOW_NAMES = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日", 0: "其他" };
  var WEEK_CHARS = "日一二三四五六";
  var AIR_WINDOW_DAYS = 91;

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function theme() { return document.documentElement.getAttribute("data-theme") === "night" ? "night" : "paper"; }
  function colorOf(s) { return COLORS[theme()][s.season]; }
  function seasonOf(key) {
    for (var i = 0; i < SEASONS.length; i++) if (SEASONS[i].key === key) return SEASONS[i];
    return SEASONS[SEASONS.length - 1];
  }
  function totalItems() { return SEASONS.reduce(function (n, s) { return n + s.items.length; }, 0); }
  function findItem(id) {
    for (var i = 0; i < SEASONS.length; i++) {
      var hit = SEASONS[i].items.filter(function (it) { return it.id === id; })[0];
      if (hit) return { item: hit, season: SEASONS[i] };
    }
    return null;
  }
  function featuredOf(s) {
    var picks = s.items.filter(isPick);
    return picks.length ? picks[0] : s.items[0];
  }
  /* ---------- 每日特集 ----------
     特集池来自手写的 features.js；按日期每日轮换一部。
     尚未开播（放送日未到）的作品在开播当日自动进入轮换。
  --------------------------------- */
  var FEATURE_DEFS = window.DAILY_FEATURES || {};

  /* item.id → 评语（同时决定该作是否带 ★，即本刊「推荐」） */
  var PICK_MAP = (function () {
    var map = {};
    SEASONS.forEach(function (s) {
      (FEATURE_DEFS[s.key] || []).forEach(function (def) {
        for (var i = 0; i < s.items.length; i++) {
          var it = s.items[i];
          if (it.cn.indexOf(def.match) !== -1 || (it.jp || "").indexOf(def.match) !== -1) {
            map[it.id] = def.blurb;
            return;
          }
        }
      });
    });
    return map;
  })();

  function isPick(item) { return !!PICK_MAP[item.id]; }
  function blurbOf(item) { return PICK_MAP[item.id] || ""; }
  function pickCount(s) { return s.items.filter(isPick).length; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function pad3(n) { return ("00" + n).slice(-3); }
  /* 小尺寸场景统一用 200px 缩略图；大图只给图版与弹窗 */
  function thumbOf(item) { return item.cover.replace("/covers/", "/thumbs/"); }
  function specRow(dt, dd) {
    return '<div class="spec-row"><dt>' + esc(dt) + '</dt><span class="leader"></span><dd>' + esc(dd) + "</dd></div>";
  }
  function bindImg(img) {
    if (img.complete && img.naturalWidth > 0) { img.classList.add("loaded"); return; }
    img.addEventListener("load", function () { img.classList.add("loaded"); });
    img.addEventListener("error", function () { img.style.opacity = "0"; });
  }

  /* ---------- 搜索索引 ---------- */
  var SEARCH_INDEX = (function () {
    var list = [];
    SEASONS.forEach(function (s) {
      s.items.forEach(function (it) {
        var studio = (it.studio || "").toLowerCase();
        var extra = "";
        for (var i = 0; i < STUDIO_ALIASES.length; i++) {
          if (studio.indexOf(STUDIO_ALIASES[i][1]) !== -1) extra += " " + STUDIO_ALIASES[i][0];
        }
        list.push({
          item: it, season: s,
          hay: (it.cn + " " + (it.jp || "") + " " + (it.studio || "") + " " + it.tags.join(" ") + extra).toLowerCase()
        });
      });
    });
    return list;
  })();

  /* ---------- 刊头期号 ---------- */
  function renderIssueNav() {
    var nav = $("#issueNav");
    nav.innerHTML = SEASONS.map(function (s) {
      return '<button class="issue-link' + (s.key === state.key ? " active" : "") + '" data-key="' + s.key + '" style="--sc:' + colorOf(s) + '">' +
        s.year + " " + s.season + (s.current ? '<span class="il-now">最新</span>' : "") + "</button>";
    }).join("");
    $all(".issue-link", nav).forEach(function (el) {
      el.addEventListener("click", function () { setSeason(el.dataset.key, true); });
    });
  }

  /* ---------- 每日特集取用 ---------- */
  function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  /* 当期特集池（静态）：手写条目按放送日排序 */
  function staticPoolOf(s) {
    var defs = FEATURE_DEFS[s.key] || [];
    var pool = [];
    defs.forEach(function (def) {
      for (var i = 0; i < s.items.length; i++) {
        var it = s.items[i];
        if (it.cn.indexOf(def.match) !== -1 || (it.jp || "").indexOf(def.match) !== -1) {
          pool.push({ item: it, blurb: def.blurb });
          return;
        }
      }
    });
    pool.sort(function (a, b) { return a.item.sort - b.item.sort; });
    return pool;
  }

  /* 排期模拟：从期初逐日推进，已开播者按序上位，未开播者顺延。
     保证序列单调、不提前重复，并在作品开播当日自然进入轮换。 */
  var FEATURE_PLAN_CACHE = {};
  function featurePlanOf(s) {
    var today = today0();
    var cacheKey = s.key + "@" + today.getTime();
    if (FEATURE_PLAN_CACHE[cacheKey]) return FEATURE_PLAN_CACHE[cacheKey];

    var pool = staticPoolOf(s);
    var plan = [];
    if (pool.length) {
      var cursor = 0;
      var first = null;
      pool.forEach(function (p) {
        var st = startDateOf(p.item, s);
        if (st && (!first || st.getTime() < first.getTime())) first = st;
      });
      var d = first ? new Date(first.getTime()) : new Date(s.year, 0, 1);
      for (; d.getTime() <= today.getTime(); d.setDate(d.getDate() + 1)) {
        for (var k = 0; k < pool.length; k++) {
          var cand = pool[(cursor + k) % pool.length];
          var st2 = startDateOf(cand.item, s);
          if (!st2 || st2.getTime() <= d.getTime()) {
            cursor = (cursor + k + 1) % pool.length;
            plan.push(cand);
            break;
          }
        }
      }
    }
    FEATURE_PLAN_CACHE = {};
    FEATURE_PLAN_CACHE[cacheKey] = plan;
    return plan;
  }

  function featureOfToday(s) {
    var plan = featurePlanOf(s);
    if (plan.length) return plan[plan.length - 1];
    var fb = featuredOf(s);
    return { item: fb, blurb: blurbOf(fb) || noteOf(fb) };
  }

  function dateCn(date) {
    return (date.getMonth() + 1) + " 月 " + date.getDate() + " 日";
  }

  /* ---------- 封面 ---------- */
  function renderCover() {
    var s = seasonOf(state.key);
    var f = featuredOf(s);
    var issueNo = SEASONS.indexOf(s) + 1;

    $(".cover").style.setProperty("--sc", colorOf(s));

    $("#coverIssue").textContent =
      "第 " + pad2(issueNo) + " 期 · " + s.year + " " + SEASON_FULL[s.season] + "号 ／ 収録 " + s.items.length + " 部";

    $("#storyLabel").textContent = "本期封面 · ISSUE COVER";
    $("#storyTitle").textContent = f.cn;
    $("#storyJp").textContent = f.jp || f.type;

    $("#coverSpecs").innerHTML =
      specRow("本期推荐", pickCount(s) + " 部") +
      specRow("特集更新", "每日轮换") +
      specRow("発行日", DATA.updated);

    var img = $("#coverImg");
    img.src = f.cover;
    img.alt = f.cn + " 官方视觉图";
    bindImg(img);

    $("#plateNo").textContent = "図版 " + pad2(1);
    $("#plateDesc").textContent = f.cn + " — " + (f.studio || f.type);
  }

  /* ---------- 目次 ---------- */
  function renderTOC() {
    var s = seasonOf(state.key);
    var todayCount = itemsAiringOn(today0()).length;
    var items = [
      { n: "01", label: "特集", note: "每日轮换", href: "#feature" },
      { n: "02", label: "放送日程", note: "今日 " + todayCount + " 部", href: "#daily" },
      { n: "03", label: "片单", note: "全量 " + s.items.length + " 部", href: "#panel" },
      { n: "04", label: "过刊", note: SEASONS.length + " 期存档", href: "#archive" }
    ];
    $("#toc").innerHTML =
      '<div class="toc-head"><h2>目次</h2><span>CONTENTS</span></div>' +
      '<div class="toc-list">' +
      items.map(function (it) {
        return '<a class="toc-item" href="' + it.href + '">' +
          '<span class="toc-num">' + it.n + "</span>" +
          '<span class="toc-label">' + it.label + "</span>" +
          '<span class="leader"></span>' +
          '<span class="toc-note">' + esc(it.note) + "</span>" +
          "</a>";
      }).join("") +
      "</div>";
  }

  /* ---------- 01 特集（每日轮换 · 纯文字跨页） ---------- */
  function renderFeature() {
    var s = seasonOf(state.key);
    var feat = featureOfToday(s);
    var f = feat.item;
    $(".feature").style.setProperty("--sc", colorOf(s));

    $("#featureKicker").textContent = "本日特集 · " + dateCn(today0());
    var title = $("#featureTitle");
    title.textContent = f.cn;
    title.onclick = function () { openModal(f.id); };
    title.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(f.id); }
    };
    $("#featureJpTitle").textContent = f.jp || "";
    $("#featureJpTitle").style.display = f.jp ? "" : "none";
    $("#featureNote").textContent = feat.blurb || noteOf(f) || "本期推荐之作。";
    $("#featureMeta").innerHTML =
      specRow("放送", f.broadcast || f.dateShort) +
      specRow("制作", f.studio || "—") +
      specRow("原作者", f.author || "—");
  }

  /* ---------- 04 过刊 · 文字索引（无图版） ---------- */
  function renderArchive() {
    $("#archiveStrip").innerHTML = SEASONS.map(function (s, i) {
      var picks = pickCount(s);
      var f = featuredOf(s);
      return (
        '<div class="issue-row' + (s.key === state.key ? " current" : "") + '" data-key="' + s.key + '" style="--sc:' + colorOf(s) + "; animation-delay:" + Math.min(i * 0.04, 0.25) + 's" tabindex="0" role="button" aria-label="进入 ' + s.year + " " + s.season + '期">' +
          '<span class="ir-no">第 ' + pad2(i + 1) + " 期</span>" +
          '<span class="ir-season">' + s.season + "</span>" +
          '<span class="ir-year">' + s.year + "</span>" +
          '<span class="leader"></span>' +
          '<span class="ir-lead">' + esc(f.cn) + "</span>" +
          '<span class="ir-meta">' + s.items.length + " 部 · 推荐 " + picks + " 部" + (s.current ? ' · <b>最新刊</b>' : "") + "</span>" +
        "</div>"
      );
    }).join("");
    $all(".issue-row").forEach(function (el) {
      function go() { setSeason(el.dataset.key, true); }
      el.addEventListener("click", go);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    });
  }

  /* ---------- 奥付 · 号色表 ---------- */
  function renderIssueColours() {
    $("#issueColours").innerHTML =
      '<h3 class="issue-colours-title">号色<em>ISSUE COLOURS</em></h3>' +
      COLOUR_NOTES.map(function (c) {
        return '<div class="colour-row" style="--sc:' + COLORS[theme()][c.s] + '">' +
          '<span class="colour-swatch"></span>' +
          '<span class="colour-season">' + c.s + "</span>" +
          '<span class="colour-latin">' + SEASON_LATIN[c.s] + "</span>" +
          '<span class="leader"></span>' +
          '<span class="colour-desc">' + esc(c.d) + "</span>" +
        "</div>";
      }).join("");
  }

  /* ---------- 筛选 ---------- */
  var TYPES = ["漫画", "小说", "原创", "游戏", "其他"];

  function renderFilters() {
    var s = seasonOf(state.key);
    var counts = { all: s.items.length };
    TYPES.forEach(function (t) {
      counts[t] = s.items.filter(function (it) { return it.type === t; }).length;
    });

    var html = '<button class="filter-chip' + (state.source === "all" ? " active" : "") + '" data-src="all" aria-pressed="' + (state.source === "all" ? "true" : "false") + '">全部<sup>' + counts.all + "</sup></button>";
    TYPES.forEach(function (t) {
      if (!counts[t]) return;
      html += '<button class="filter-chip' + (state.source === t ? " active" : "") + '" data-src="' + t + '" aria-pressed="' + (state.source === t ? "true" : "false") + '">' + t + "<sup>" + counts[t] + "</sup></button>";
    });

    var box = $("#sourceFilters");
    box.innerHTML = html;
    $all(".filter-chip", box).forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.source = chip.dataset.src;
        renderFilters();
        renderContent();
      });
    });
  }

  /* ---------- 栏目头 ---------- */
  function renderPanelHead() {
    var s = seasonOf(state.key);
    var issueNo = SEASONS.indexOf(s) + 1;
    $(".panel-wrap").style.setProperty("--sc", colorOf(s));
    document.title = s.year + " " + SEASON_FULL[s.season] + "号 · 季刊新番";

    $("#panelTitle").textContent = s.year + " " + SEASON_FULL[s.season] + "新番";
    $("#panelMeta").textContent = "第 " + pad2(issueNo) + " 期 · 全量 " + s.items.length + " 部";
    $("#panelDesc").textContent = s.tagline;
  }

  /* ---------- 三读法 ---------- */
  function filteredItems() {
    var s = seasonOf(state.key);
    return s.items.filter(function (it) {
      if (state.source !== "all" && it.type !== state.source) return false;
      if (state.pickOnly && !isPick(it)) return false;
      return true;
    });
  }

  function plateHTML(item, index, color) {
    return (
      '<article class="card" data-id="' + item.id + '" style="--sc:' + color + "; animation-delay:" + Math.min(index * 0.025, 0.6) + 's" tabindex="0" role="button" aria-label="查看《' + esc(item.cn) + '》详情">' +
        '<div class="card-cover">' +
          '<img src="' + thumbOf(item) + '" alt="' + esc(item.cn) + ' 官方视觉图" loading="lazy" decoding="async">' +
          '<span class="card-date">' + esc(item.dateShort) + "</span>" +
          (isPick(item) ? '<span class="card-pick">★</span>' : "") +
        "</div>" +
        '<div class="card-info">' +
          '<h3 class="card-title">' + esc(item.cn) + "</h3>" +
          '<p class="card-sub">No.' + pad3(index + 1) + " · " + esc(item.jp || item.studio || item.type) + "</p>" +
        "</div>" +
      "</article>"
    );
  }

  function indexRowHTML(item, index, color) {
    return (
      '<div class="list-row" data-id="' + item.id + '" style="--sc:' + color + '" tabindex="0" role="button" aria-label="查看《' + esc(item.cn) + '》详情">' +
        '<span class="col-no">' + pad3(index + 1) + "</span>" +
        '<span class="col-date">' + esc(item.dateShort) + "</span>" +
        '<span class="col-title">' +
          '<span class="lt-cn">' + esc(item.cn) + (isPick(item) ? '<span class="pick-star"> ★</span>' : "") + "</span>" +
          '<span class="lt-jp">' + esc(item.jp || "") + "</span>" +
        "</span>" +
        '<span class="col-type">' + esc(item.type) + "</span>" +
        '<span class="col-studio">' + esc(item.studio || "—") + "</span>" +
      "</div>"
    );
  }

  function slotLabelOf(it) {
    if (it.dow === 0) {
      var b = it.broadcast || "";
      if (/网络|配信/.test(b)) return "网络放送";
      return b.replace(/^\d+\/\d+\s*/, "") || "待定";
    }
    return it.slotLabel;
  }

  function timetableHTML(items, color) {
    var todayDow = dowOfDate(new Date());
    var cols = [1, 2, 3, 4, 5, 6, 7, 0];
    return cols.map(function (dow) {
      var list = items.filter(function (it) { return it.dow === dow; }).sort(function (a, b) {
        if (a.slot !== b.slot) {
          if (a.slot < 0) return 1;
          if (b.slot < 0) return -1;
          return a.slot - b.slot;
        }
        return a.sort - b.sort;
      });
      var body = list.length
        ? list.map(function (it, i) {
            return (
              '<div class="tt-item" data-id="' + it.id + '" style="animation-delay:' + Math.min(i * 0.03, 0.5) + 's" tabindex="0" role="button" aria-label="查看《' + esc(it.cn) + '》详情">' +
                '<img src="' + thumbOf(it) + '" alt="" loading="lazy" decoding="async">' +
                "<div>" +
                  '<span class="tt-slot">' + esc(slotLabelOf(it)) + "</span>" +
                  '<div class="tt-title">' + esc(it.cn) + (isPick(it) ? '<span class="pick-star"> ★</span>' : "") + "</div>" +
                "</div>" +
              "</div>"
            );
          }).join("")
        : '<div class="tt-empty">—</div>';
      var isToday = dow === todayDow;
      return (
        '<div class="tt-col' + (dow === 6 || dow === 7 ? " weekend" : "") + (isToday ? " today" : "") + '" style="--sc:' + color + '">' +
          '<div class="tt-col-head"><span class="tt-day">' + DOW_NAMES[dow] + (isToday ? '<span class="tt-today">今日</span>' : "") + '</span><span class="tt-count">' + list.length + "</span></div>" +
          '<div class="tt-col-body">' + body + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function scrollTodayIntoView() {
    if (state.view !== "timetable") return;
    var tt = $("#ttGrid");
    var col = $(".tt-col.today", tt);
    if (!col || tt.scrollWidth <= tt.clientWidth) return;
    tt.scrollLeft = (col.offsetLeft - tt.offsetLeft) - (tt.clientWidth - col.clientWidth) / 2;
  }

  function renderContent() {
    var s = seasonOf(state.key);
    var color = colorOf(s);
    var items = filteredItems();

    $("#galleryView").hidden = state.view !== "gallery";
    $("#listView").hidden = state.view !== "list";
    $("#timetableView").hidden = state.view !== "timetable";
    $("#emptyTip").hidden = items.length > 0;

    if (state.view === "gallery") {
      var grid = $("#galleryView");
      grid.innerHTML = items.map(function (it, i) { return plateHTML(it, i, color); }).join("");
      $all("img", grid).forEach(bindImg);
      bindEntries(grid);
    } else if (state.view === "list") {
      var body = $("#listBody");
      body.innerHTML = items.map(function (it, i) { return indexRowHTML(it, i, color); }).join("");
      bindEntries(body);
    } else {
      var tt = $("#ttGrid");
      tt.innerHTML = timetableHTML(items, color);
      $all("img", tt).forEach(bindImg);
      bindEntries(tt);
      scrollTodayIntoView();
    }
  }

  function bindEntries(root) {
    $all("[data-id]", root).forEach(function (el) {
      function open() { openModal(el.dataset.id); }
      el.addEventListener("click", open);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }

  /* ---------- 02 放送日程 ---------- */
  function dowOfDate(date) { var d = date.getDay(); return d === 0 ? 7 : d; }

  function startDateOf(item, season) {
    var m = (item.dateShort || "").match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    return new Date(season.year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  }

  function itemsAiringOn(date) {
    var dow = dowOfDate(date);
    var out = [];
    SEASONS.forEach(function (s) {
      s.items.forEach(function (it) {
        if (it.dow !== dow) return;
        var start = startDateOf(it, s);
        if (!start) return;
        var diff = Math.round((date.getTime() - start.getTime()) / 86400000);
        if (diff >= 0 && diff <= AIR_WINDOW_DAYS) out.push({ item: it, season: s });
      });
    });
    out.sort(function (a, b) {
      if (a.item.slot !== b.item.slot) {
        if (a.item.slot < 0) return 1;
        if (b.item.slot < 0) return -1;
        return a.item.slot - b.item.slot;
      }
      return a.item.sort - b.item.sort;
    });
    return out;
  }

  function dailyItemHTML(entry) {
    var it = entry.item;
    return (
      '<div class="daily-item" data-id="' + it.id + '" style="--sc:' + colorOf(entry.season) + '" tabindex="0" role="button">' +
        '<img src="' + thumbOf(it) + '" alt="" loading="lazy" decoding="async">' +
        '<div class="di-body">' +
          '<div class="di-title">' + esc(it.cn) + (isPick(it) ? '<span class="pick-star"> ★</span>' : "") + "</div>" +
          '<div class="di-meta">' + esc(it.studio || it.type) + " · " + entry.season.year + " " + entry.season.season + "</div>" +
        "</div>" +
        '<span class="di-slot">' + esc(it.slotLabel) + "</span>" +
      "</div>"
    );
  }

  function renderDailyList(listSel, countSel, entries) {
    var list = $(listSel);
    list.innerHTML = entries.length
      ? entries.map(dailyItemHTML).join("")
      : '<div class="daily-empty">当日无放送安排。</div>';
    if (countSel) $(countSel).textContent = entries.length + " 部";
    $all("img", list).forEach(bindImg);
    bindEntries(list);
  }

  /* ---------- 02 放送日程：周条 + 当日清单（默认今日） ---------- */
  var selectedDay = null;

  function renderDaily() {
    var today = today0();
    if (!selectedDay) selectedDay = today.getTime();
    renderWeekStrip(today);
    renderDayView();
  }

  function renderWeekStrip(today) {
    var dow = today.getDay();
    var monday = new Date(today.getTime() - ((dow === 0 ? 6 : dow - 1) * 86400000));
    var html = "";
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday.getTime() + i * 86400000);
      var n = itemsAiringOn(d).length;
      html +=
        '<div class="week-day' + (d.getTime() === today.getTime() ? " today" : "") + (d.getTime() === selectedDay ? " open" : "") +
        (n ? "" : " empty") + '" data-time="' + d.getTime() + '" role="button" tabindex="0" aria-label="' +
        (d.getMonth() + 1) + "月" + d.getDate() + "日 " + n + ' 部">' +
        '<span class="wd-dow">周' + WEEK_CHARS.charAt(d.getDay()) + "</span>" +
        '<span class="wd-date">' + (d.getMonth() + 1) + "/" + d.getDate() + "</span>" +
        '<span class="wd-count">' + (n ? n + " 部" : "—") + "</span>" +
        "</div>";
    }
    var strip = $("#weekStrip");
    strip.innerHTML = html;
    $all(".week-day", strip).forEach(function (el) {
      function select() {
        selectedDay = parseInt(el.dataset.time, 10);
        renderWeekStrip(today0());
        renderDayView();
      }
      el.addEventListener("click", select);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); }
      });
    });
  }

  function renderDayView() {
    var d = new Date(selectedDay);
    var today = today0().getTime();
    var isToday = d.getTime() === today;
    var isTomorrow = d.getTime() === today + 86400000;
    var tag = isToday ? "（今日）" : isTomorrow ? "（明日）" : "";
    $("#dayLabel").textContent = (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · 周" + WEEK_CHARS.charAt(d.getDay()) + tag;
    renderDailyList("#dayList", null, itemsAiringOn(d));
  }

  /* ---------- 详情 ---------- */
  function openModal(id) {
    var found = findItem(id);
    if (!found) return;
    var activeElement = document.activeElement;
    modalReturnFocus = activeElement && !activeElement.closest("[hidden]") ? activeElement : $("#searchInput");
    var item = found.item, s = found.season;

    var panel = $("#modal");
    $(".modal-panel", panel).style.setProperty("--sc", colorOf(s));

    var img = $("#modalCoverImg");
    img.src = item.cover;
    img.alt = item.cn + " 官方视觉图";
    img.classList.remove("loaded");
    img.style.opacity = "";
    bindImg(img);

    $("#modalKicker").textContent =
      "第 " + pad2(SEASONS.indexOf(s) + 1) + " 期 · " + s.year + " " + SEASON_FULL[s.season] + " ／ " + (item.broadcast || item.dateShort);
    $("#modalTitle").textContent = item.cn;
    $("#modalJp").textContent = item.jp || "";
    $("#modalJp").style.display = item.jp ? "" : "none";
    $("#modalGenres").innerHTML = item.tags.map(function (g) { return "<span>" + esc(g) + "</span>"; }).join("");

    var pickBox = $("#modalPick");
    pickBox.hidden = !isPick(item);
    if (isPick(item)) $("#modalPickNote").textContent = blurbOf(item) || noteOf(item);

    $("#modalMeta").innerHTML =
      specRow("原作", item.type) +
      specRow("放送", item.broadcast || item.dateShort) +
      specRow("制作", item.studio || "—") +
      specRow("时期", s.year + " " + SEASON_FULL[s.season]);

    panel.hidden = false;
    document.body.classList.add("modal-open");
    $("#modalClose").focus();
  }

  function closeModal() {
    $("#modal").hidden = true;
    document.body.classList.remove("modal-open");
    if (modalReturnFocus && modalReturnFocus.isConnected && !modalReturnFocus.closest("[hidden]")) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  /* ---------- 搜索 ---------- */
  var searchTimer = null;

  function runSearch(q) {
    var box = $("#searchResults");
    q = q.trim();
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    var lower = q.toLowerCase();
    var hits = [];
    for (var i = 0; i < SEARCH_INDEX.length && hits.length < 24; i++) {
      if (SEARCH_INDEX[i].hay.indexOf(lower) !== -1) hits.push(SEARCH_INDEX[i]);
    }
    if (!hits.length) {
      box.innerHTML = '<div class="search-empty">未找到「' + esc(q) + "」相关作品。</div>";
    } else {
      box.innerHTML = hits.map(function (h) {
        var it = h.item;
        return (
          '<button type="button" class="search-item" data-id="' + it.id + '" data-key="' + h.season.key + '" style="--sc:' + colorOf(h.season) + '">' +
            '<img src="' + thumbOf(it) + '" alt="" loading="lazy">' +
            '<div class="si-body">' +
              '<div class="si-title">' + esc(it.cn) + "</div>" +
              '<div class="si-meta">' + esc(it.jp || it.type) + (it.studio ? " · " + esc(it.studio) : "") + "</div>" +
            "</div>" +
            '<span class="si-season">' + h.season.year + " " + h.season.season + "</span>" +
          "</button>"
        );
      }).join("");
      $all(".search-item", box).forEach(function (el) {
        el.addEventListener("click", function () { jumpTo(el.dataset.key, el.dataset.id); });
      });
    }
    box.hidden = false;
  }

  function jumpTo(key, id) {
    closeSearch();
    if (key !== state.key) {
      setSeason(key, false);
    } else {
      state.source = "all";
      state.pickOnly = false;
      $("#pickOnly").checked = false;
      renderFilters();
      renderContent();
    }
    openModal(id);
  }

  function closeSearch() {
    $("#searchResults").hidden = true;
    $("#searchInput").value = "";
  }

  /* ---------- 期号切换 ---------- */
  function setSeason(key, scroll) {
    if (key === state.key) { if (scroll) scrollToPanel(); return; }
    state.key = key;
    state.source = "all";
    state.pickOnly = false;
    $("#pickOnly").checked = false;

    renderIssueNav();
    renderCover();
    renderTOC();
    renderFeature();
    renderPanelHead();
    renderFilters();
    renderContent();
    renderArchive();
    if (scroll) scrollToPanel();

    try { history.replaceState(null, "", "#" + key); } catch (e) {}
  }

  function scrollToPanel() {
    var top = $("#panel").getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  /* ---------- 主题 ---------- */
  function initTheme() {
    var root = document.documentElement;
    function apply(t) {
      root.setAttribute("data-theme", t);
      $("#themeIcon").textContent = t === "night" ? "☀" : "☾";
      $("#themeLabel").textContent = t === "night" ? "纸本版" : "夜间版";
      try { localStorage.setItem("quarterly-theme", t); } catch (e) {}
    }
    apply(root.getAttribute("data-theme") === "night" ? "night" : "paper");
    $("#themeBtn").addEventListener("click", function () {
      apply(root.getAttribute("data-theme") === "night" ? "paper" : "night");
      /* 主题变化后重绘依赖季节色的部分 */
      renderIssueNav();
      renderCover();
      renderIssueColours();
      renderFeature();
      renderPanelHead();
      renderContent();
      renderDaily();
      renderArchive();
    });
  }

  function syncViewButtons() {
    $all(".view-btn").forEach(function (button) {
      var active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var hash = (location.hash || "").replace("#", "");
    state.key = SEASONS.some(function (s) { return s.key === hash; }) ? hash : SEASONS[SEASONS.length - 1].key;

    try {
      var v = new URLSearchParams(location.search).get("view");
      if (v === "list" || v === "gallery" || v === "timetable") state.view = v;
      var t = new URLSearchParams(location.search).get("theme");
      if (t === "paper" || t === "night") document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
    syncViewButtons();

    initTheme();
    renderIssueNav();
    renderCover();
    renderTOC();
    renderIssueColours();
    renderFeature();
    renderPanelHead();
    renderFilters();
    renderContent();
    renderArchive();
    renderDaily();

    $("#updatedAt").textContent = DATA.updated;

    /* 跨日刷新：周条、当日清单与每日特集 */
    var lastDayKey = new Date().toDateString();
    setInterval(function () {
      if (new Date().toDateString() !== lastDayKey) {
        lastDayKey = new Date().toDateString();
        selectedDay = null;
        renderCover();
        renderFeature();
        renderDaily();
        renderContent();
      }
    }, 60000);

    /* 弹窗 */
    $("#modalClose").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", closeModal);

    /* 视图切换 */
    function setView(v) {
      state.view = v;
      syncViewButtons();
      renderContent();
    }
    $all(".view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { setView(btn.dataset.view); });
    });

    /* 筛选重置 */
    $("#resetFilters").addEventListener("click", function () {
      state.source = "all";
      state.pickOnly = false;
      $("#pickOnly").checked = false;
      renderFilters();
      renderContent();
    });

    /* 仅看推荐 */
    $("#pickOnly").addEventListener("change", function () {
      state.pickOnly = this.checked;
      renderContent();
    });

    /* 搜索 */
    var input = $("#searchInput");
    input.addEventListener("input", function () {
      clearTimeout(searchTimer);
      var v = input.value;
      searchTimer = setTimeout(function () { runSearch(v); }, 120);
    });
    input.addEventListener("focus", function () { if (input.value.trim()) runSearch(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = $(".search-item", $("#searchResults"));
        if (first) first.click();
      } else if (e.key === "Escape") {
        closeSearch();
        input.blur();
      }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".search-box")) $("#searchResults").hidden = true;
    });

    /* 键盘 */
    document.addEventListener("keydown", function (e) {
      if (!$("#modal").hidden) {
        if (e.key === "Escape") closeModal();
        if (e.key === "Tab") {
          var focusables = $all("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])", $("#modal"));
          if (focusables.length) {
            var activeIndex = focusables.indexOf(document.activeElement);
            if (e.shiftKey && activeIndex <= 0) {
              e.preventDefault();
              focusables[focusables.length - 1].focus();
            } else if (!e.shiftKey && (activeIndex === focusables.length - 1 || activeIndex === -1)) {
              e.preventDefault();
              focusables[0].focus();
            }
          }
        }
        return;
      }
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); input.focus(); return; }
      var idx = SEASONS.findIndex(function (s) { return s.key === state.key; });
      if (e.key === "ArrowRight" && idx < SEASONS.length - 1) setSeason(SEASONS[idx + 1].key, false);
      if (e.key === "ArrowLeft" && idx > 0) setSeason(SEASONS[idx - 1].key, false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
