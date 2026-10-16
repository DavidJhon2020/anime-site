/**
 * 季刊新番 · Seasonal Anime Quarterly
 * 期号切换 / 封面特集 / 今日明日放送 / 时刻表·图版·索引三读法 / 全局搜索 / 详情 / 纸本·夜间双主题
 */
(function () {
  "use strict";

  var DATA = window.SEASONAL_DATA;
  var SEASONS = DATA.seasons;

  var COLORS = {
    paper: { 冬: "#3A6EA8", 春: "#C9557E", 夏: "#1E8A7C", 秋: "#B96A22" },
    night: { 冬: "#7FA8D9", 春: "#E39BB8", 夏: "#55C0B0", 秋: "#E0A05C" }
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
  function totalPicks() {
    return SEASONS.reduce(function (n, s) { return n + pickCount(s); }, 0);
  }
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
    var today = today0();
    var feat = featureOfToday(s);
    var f = feat.item;
    var issueNo = SEASONS.indexOf(s) + 1;

    $(".cover").style.setProperty("--sc", colorOf(s));

    $("#coverIssue").textContent =
      "第 " + pad2(issueNo) + " 期 · " + s.year + " " + SEASON_FULL[s.season] + "号 ／ 収録 " + s.items.length + " 部";

    $("#storyLabel").textContent = "本日特集 · " + dateCn(today) + " · DAILY FEATURE";
    $("#storyTitle").textContent = f.cn;
    $("#storyJp").textContent = f.jp || f.type;

    $("#coverSpecs").innerHTML =
      specRow("推荐作品", totalPicks() + " 部（全库）") +
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
        return '<div class="toc-item" data-href="' + it.href + '">' +
          '<span class="toc-num">' + it.n + "</span>" +
          '<span class="toc-label">' + it.label + "</span>" +
          '<span class="leader"></span>' +
          '<span class="toc-note">' + esc(it.note) + "</span>" +
          "</div>";
      }).join("") +
      "</div>";
    $all(".toc-item", $("#toc")).forEach(function (el) {
      el.addEventListener("click", function () {
        var target = $(el.dataset.href);
        if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 70, behavior: "smooth" });
      });
    });
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

    var html = '<button class="filter-chip' + (state.source === "all" ? " active" : "") + '" data-src="all">全部<sup>' + counts.all + "</sup></button>";
    TYPES.forEach(function (t) {
      if (!counts[t]) return;
      html += '<button class="filter-chip' + (state.source === t ? " active" : "") + '" data-src="' + t + '">' + t + "<sup>" + counts[t] + "</sup></button>";
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
          '<img src="' + item.cover + '" alt="' + esc(item.cn) + ' 官方视觉图" loading="lazy" decoding="async">' +
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
      body.innerHTML = items.map(function (it, i) { retu