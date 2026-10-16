# 季刊新番 · Seasonal Anime Quarterly

> 一份按季度发刊的日本电视动画档案。全量收录，不做删选。

**在线预览**：https://davidjhon2020.github.io/anime-site/

## 这是什么

「季刊新番」是一份个人志形式的动画档案，目前收录 **2025 夏季至 2026 秋季六期、393 部**日本 TV 动画。

| 栏目 | 说明 |
| --- | --- |
| 封面 | 刊名、期号、「本日特集」封面故事与图版 |
| 01 特集 | 每日轮换一部作品，附编辑手写评语 |
| 02 放送日程 | 本周节目单，点选任一日查看当日放送清单 |
| 03 片单 | 时刻表、图版、索引三种视图，支持原作类型筛选与「仅看推荐」 |
| 04 过刊 | 六期文字索引，点击切期 |
| 05 奥付 | 数据来源与「号色」说明 |

其他功能包括全局搜索、作品详情、键盘左右切期、`/` 聚焦搜索，以及纸本和夜间双主题。

## 目录结构

```
anime-site/
├── index.html
├── .gitattributes            # 统一文本文件为 LF，避免 Windows 换行噪音
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── data.js          # 季度片单数据
│   │   ├── features.js      # 人工编辑层：特集池与手写评语
│   │   └── app.js            # 页面交互
│   ├── covers/               # 作品官方视觉图
│   └── thumbs/               # 200px 宽缩略图
├── tools/
│   ├── seasons.js            # 季度、来源页、编辑推荐和安全阈值的唯一配置
│   ├── snapshots/            # 可追溯的 yuc.wiki HTML 快照，纳入版本管理
│   ├── id-map.json            # 标题到稳定作品 ID 的映射
│   ├── fetch-source.js        # 安全抓取来源页并原子保存快照
│   ├── parse.js               # 解析快照，输出候选片单与候选 ID 映射
│   ├── build-data.js           # 构建候选 data.js
│   ├── download.js             # 下载新作品封面
│   ├── update-schedule.js      # 补充星期与时段字段
│   ├── make-thumbs.js          # 生成 200px 缩略图
│   ├── update-season.js        # 可断点续跑的总管线
│   └── verify.js               # 数据、差异、DOM 与线上文件校验
└── .github/workflows/          # 定时自检与手动抓取
```

## 本地运行

网站是原生 HTML、CSS 和 JavaScript，没有前端构建步骤。可以直接打开 `index.html`，也可以启动静态服务器：

```bash
python -m http.server 8080
```

数据工具需要 Node.js 20 或更新版本。校验和缩略图工具的开发依赖已固定版本：

```bash
npm install
npx playwright install chromium
```

这些依赖只用于仓库维护，不会被静态网站加载。

## 季度更新

正常更新会按顺序执行：抓取快照 → 解析 → 构建候选数据 → 下载封面 → 更新放送时段 → 生成缩略图 → 校验 → 发布候选数据和 ID 映射。

抓取失败时最多尝试 3 次，每次会打印失败原因，并按 2 秒、4 秒递增等待后重试。

```bash
# 更新所有已配置季度
node tools/update-season.js

# 只更新一个季度，--only 也接受逗号分隔的多个季度
node tools/update-season.js --only 2026-autumn

# 已有快照时从解析阶段继续
node tools/update-season.js --only 2026-autumn --from parse

# 对照线上文件，并验证本地页面
node tools/verify.js --url https://davidjhon2020.github.io/anime-site/
```

若当前环境无法启动浏览器，可显式加 `--no-dom` 只跑静态数据校验；常规本地更新和 Actions 校验会运行浏览器 DOM 断言。

可用的续跑阶段为 `fetch`、`parse`、`build`、`download`、`schedule`、`thumbs`、`verify`、`publish`。从某阶段开始时，该阶段前的中间文件必须已经存在。完整流程不会覆盖 `features.js`。

### 安全校验与 ID

- 季度配置、页面编号、编辑推荐、每季最低条数、数量容差和最多允许消失的条数都在 `tools/seasons.js`。新增季度在这里加一项即可。
- `tools/snapshots/yuc*.html` 是解析器的输入快照，纳入 Git，方便复现和追查来源变化。解析器检查页面标题节点数、来源公告条数和每季最低条数；任一校验不通过都会停止。
- `tools/id-map.json` 以标准化的日文标题和中文标题映射到作品 ID。源站调整排序不会改变 ID；识别不到的新作品才分配新 ID，旧映射保留。
- 校验会比较新旧条数与逐条 ID 差异。每季条数变化超出配置容差，或消失作品超过上限时，默认拒绝替换。人工审阅确认后可显式加 `--approve-changes`。
- 数据与 ID 映射先写入候选文件。候选数据通过静态检查及三种视图 DOM 检查后，才替换 `assets/js/data.js` 和 `tools/id-map.json`；重复执行不会只因日期不同而产生数据变更。
- 临时解析结果、候选数据与缩略图中间文件由 `.gitignore` 忽略；原始来源快照不会忽略。

当前工作区已保存 `202507`、`202510`、`202601`、`202604`、`202607`、`202610` 六个来源快照。`202610` 快照公告并解析出 69 部作品；离线重建 2026 秋季数据时可直接从 `parse` 阶段开始。

### GitHub Actions

- **Verify site** 每周只检查仓库数据、三种片单视图及 Pages 发布文件的一致性。失败时按固定标题创建或更新一个 Issue。此工作流不抓取 yuc.wiki，也不提交更改。
- **Capture source snapshots** 只能通过 `workflow_dispatch` 手动触发。抓取结果作为 Actions artifact 保存 30 天，不自动提交；下载 artifact 后可检查并纳入本地快照。

定时校验覆盖的是代码库与已发布站点。它不会在不抓取来源页的情况下判断 yuc.wiki 是否改版；如需检查来源页，请手动运行 **Capture source snapshots**，再审阅快照和解析结果。

## 编辑层：features.js

每日特集池与评语集中在 `assets/js/features.js`，按季度分组：

```js
"2026-autumn": [
  { match: "药屋少女", blurb: "猫猫的推理从后宫走进了朝堂……" }
]
```

- `match` 是作品标题片段，需在当期片单中唯一命中；
- `blurb` 用于封面故事、特集评语与详情弹窗，并决定该作是否带 ★；
- 特集按日期轮换，作品在开播当日自动进入轮换。

## 设计说明

- **纸本印刷语言**：和纸底色、墨色文字、拉丁小字 EB Garamond、点线引导和图版图注。
- **号色**：每期一色，仅用于目录编号、图版标签、激活筛选和时刻表的「今日」栏。
- **减法原则**：页面保留排版、图版与数据，不添加漂浮动效和意象装饰。

## 数据来源与版权

- 片单数据整理自 **長門番堂 季度新番一览**（yuc.wiki），用于个人整理与索引；
- 封面为各作品官方视觉图，版权归各自权利人所有；
- 放送时间与平台信息可能随官方调整，请以各作品官方渠道为准。

本项目为个人非商业项目。转载或二次使用图片素材前，请自行确认权利人授权。
