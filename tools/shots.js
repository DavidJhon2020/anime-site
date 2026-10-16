/**
 * 视觉 QA 脚本（开发用）
 * 用法：node tools/shots.js
 * 依赖：playwright（安装于受管 node 工作区，见 README 说明）
 */
const path = require("path");
const { chromium } = require("playwright");

const SITE = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
const OUT = path.resolve(__dirname, "..") + path.sep;

(async () => {
  /* 使用系统已安装的 Microsoft Edge，不额外下载内核 */
  const browser = await chromium.launch({
    channel: "msedge",
    args: ["--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-extensions"]
  });
  const log = [];

  async function shot(name, opts = {}) {
    const ctx = await browser.newContext({
      viewport: opts.viewport || { width: 1440, height: 1100 },
      deviceScaleFactor: opts.dsf || 1
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
    await page.goto(SITE + (opts.url || ""), { waitUntil: "load" });
    await page.waitForTimeout(1500);
    if (opts.act) await opts.act(page);
    await page.waitForTimeout(opts.after || 500);
    await page.screenshot({ path: OUT + name + ".png", fullPage: !!opts.full });
    log.push(name + (errors.length ? "  ⚠ " + errors.join(" | ") : "  ok"));
    await ctx.close();
  }

  /* 1. 封面（纸本） */
  await shot("shot-1-cover-paper", { url: "?theme=paper" });

  /* 2. 封面（夜间） */
  await shot("shot-2-cover-night", { url: "?theme=night" });

  /* 3. 特集与日程（纸本，滚动一屏） */
  await shot("shot-3-feature", {
    url: "?theme=paper",
    act: async (p) => { await p.evaluate(() => document.querySelector("#feature").scrollIntoView()); }
  });

  /* 4. 片单·时刻表（默认视图） */
  await shot("shot-4-timetable", {
    url: "?theme=paper",
    act: async (p) => { await p.evaluate(() => document.querySelector("#panel").scrollIntoView()); }
  });

  /* 5. 视图切换：图版 → 索引 → 时刻表（验证无残留） */
  await shot("shot-5-view-gallery", {
    url: "?theme=paper",
    act: async (p) => {
      await p.evaluate(() => document.querySelector("#panel").scrollIntoView());
      await p.click('[data-view="gallery"]');
    }
  });
  await shot("shot-6-view-list", {
    url: "?theme=paper",
    act: async (p) => {
      await p.evaluate(() => document.querySelector("#panel").scrollIntoView());
      await p.click('[data-view="gallery"]');
      await p.waitForTimeout(300);
      await p.click('[data-view="list"]');
    }
  });
  await shot("shot-7-view-back-to-timetable", {
    url: "?theme=paper",
    act: async (p) => {
      await p.evaluate(() => document.querySelector("#panel").scrollIntoView());
      await p.click('[data-view="gallery"]');
      await p.waitForTimeout(250);
      await p.click('[data-view="list"]');
      await p.waitForTimeout(250);
      await p.click('[data-view="timetable"]');
    }
  });

  /* 8. 详情弹窗 */
  await shot("shot-8-modal", {
    url: "?theme=paper&view=gallery",
    act: async (p) => { await p.locator(".card").first().click(); }
  });

  /* 9. 搜索 */
  await shot("shot-9-search", {
    url: "?theme=paper",
    act: async (p) => {
      await p.fill("#searchInput", "骨头社");
      await p.waitForTimeout(400);
    }
  });

  /* 10. 过刊 + 奥付（夜间） */
  await shot("shot-10-archive-night", {
    url: "?theme=night",
    act: async (p) => { await p.evaluate(() => document.querySelector("#archive").scrollIntoView()); }
  });

  /* 11. 移动端封面（纸本） */
  await shot("shot-11-mobile-cover", {
    url: "?theme=paper",
    viewport: { width: 390, height: 1000 },
    dsf: 2
  });

  /* 12. 移动端时刻表 */
  await shot("shot-12-mobile-timetable", {
    url: "?theme=paper",
    viewport: { width: 390, height: 1000 },
    dsf: 2,
    act: async (p) => { await p.evaluate(() => document.querySelector("#panel").scrollIntoView()); }
  });

  console.log(log.join("\n"));
  await browser.close();
})();
