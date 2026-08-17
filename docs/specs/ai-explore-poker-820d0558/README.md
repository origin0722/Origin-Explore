# 组件规格 — Explore 克隆（ai-explore-poker-820d0558 / chat-6ea4b827）

> 视觉要求（2026-08-13 更新）：**像素级对比原站截图**（用户："要做就做最好最完美"）。结构、间距、颜色尽量贴近原站；原站不可见区域（登录墙后的 3D 宇宙）按拓扑+空态截图合理还原。

## 技术栈
- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + lucide-react（已装）
- 3D: three + @react-three/fiber + @react-three/drei（已装）；文档解析: unpdf + mammoth（已装）
- 组件目录: `src/components/sites/ai-explore-poker-820d0558/`（每个构建者只写自己的文件）

## 共享契约

### 类型 & Mock 数据（已存在，直接 import，不要重写）
- `src/types/sites/ai-explore-poker-820d0558.ts` — 全部类型：Project/Turn/Message/ChatProject/ChatSettings/ModelInfo/ThoughtNode(pending|validated)/TermNode(kind: child|related|branch + children 递归)/ThemeOption{id,name}/Profile/DocumentItem/TermState("unseen"|"asked"|"mastered")
- `src/lib/sites/ai-explore-poker-820d0558/mock.ts` — MODEL_PRESETS(11 个厂商预设，2026-08 已更新) / THEMES({id,name}[] 9 个) / DEFAULT_SETTINGS / TERM_TREE(3 层递归术语树) / findTerm() / GLOSSARY(中英对照词典) / themeId(name)→data-theme key / isThemeImplemented(name) / makeDemoProject / makeDemoTurn / MINDSCAPE_EMPTY
- `src/lib/sites/ai-explore-poker-820d0558/doc-parser.ts` — extractTextFromFile(file)→{kind,content}（pdf/docx/md/txt/html 客户端解析）、kindFromName、kindLabel、isParseable、splitParagraphs（短块合并）
- `src/lib/sites/ai-explore-poker-820d0558/term-detect.ts` — detectTerms(text, limit?)→TermCandidate[]{term,score,kind:"glossary"|"heuristic"}（词典+启发式）

> **无离线知识库**：AI 能力全部走 BYOK（用户自带 OpenAI 兼容 API）；未配置 API 时输入禁用并提示。已移除：`OFFLINE_MODEL`、`generateReply`、`heuristicInterpret`、`genericTermSummary`、启发式智能摘要。

### 语义类名（globals.css @theme 已生成，直接用）
- 颜色: `bg-bg`(页底，主题变量) / `bg-brand` `text-brand` `text-brandtw`(品牌绿，主题变量) / `bg-btn-std` `bg-btn-std-hover` / `bg-btn-control` `bg-btn-control-hover` / `bg-btn-selector` / `bg-btn-inputarea`(绿) `bg-btn-inputarea-transparent-hover` / `bg-card-std` / `bg-card-floating` / `bg-modal-std` / `bg-modal-floating` / `bg-item-std` `bg-item-std-active` `bg-item-std-hover` / `bg-usermsg` / `bg-inputarea` / `bg-overlay-modal`
- 文本: `text-primary` `text-text-secondary` `text-text-tertiary` `text-text-quaternary` `text-text-header-secondary` `text-text-turn-title` `text-text-icon-secondary` `text-text-content`
- 边框: `border-std` `border-divider` `border-turn-std`
- 阴影: `shadow-card` `shadow-brand` `shadow-brandtw` `shadow-selector` `shadow-usermsg` `shadow-btn`
- 圆角: `rounded-usermsg`(14px) + 任意值
- 滚动条: `scrollbar-card-std` `scrollbar-inputarea` `scrollbar-card-neon` `nav-scroll` `no-scrollbar`
- markdown 渲染: `.markdown-content`（全局已定义排版）+ `.mind-md`（紧凑版）
- 卡片动画: `.card-container` + `entering-cascade`/`exiting-cascade`（globals.css 已定义；其余旧变体已清理）
- **注意**：`text-content-brand` 不存在，用 `text-brand`

### AppContext（app-context.tsx 已实现，直接 import { useApp }）
useApp() 提供: settings/setSettings / projects/activeProjectId/createProject/selectProject/deleteProject / collapsed/toggleSidebar / mindscapeOpen/setMindscapeOpen / universeOpen/setUniverseOpen / modals/openModal/closeModal / turns/activeTurn / sendMessage/busy / **appNotice/setAppNotice**（全局底部轻提示）/ **openBranchTurn(title, history?, sourceTurnId?): {id, created}**（分支卡片开新 turn）/ **openDivergeTurn(title, sourceTurnId, anchor?): {id, created}**（发散卡片，anchor 注入来源语境）/ **sendInTurn(turnId, text)**（平行对话内消息级顺延）/ **sendDocQuestion(text)**（基于文档全文提问）/ **interpretDocument(docId, force?)**（AI 解读：分块+双语+整理，流式）/ **docInterpretingIds: string[]** / **parallelSendTarget/setParallelSendTarget**（输入框三路发送目标）/ **treeFocus/setTreeFocus**（卡片树"你在这里"高亮）/ **profile/setProfile** / **thoughtNodes/addThoughtNode(subject,content,category?)/validateThoughtNode(id)/removeThoughtNode(id)** / **termStates/markTermState(term,state)** / **documents/addDocument/removeDocument/activeDocId/setActiveDocId** / **openDocQuestion(term, docName)**（文档问答→自动建"论文：xxx"项目+新 turn）

> 交互重设计与文档解读的完整设计见 **r10-parallel-view-doc-interpret.md**（平行视图 / 卡片树 v2 / 文档 AI 解读）。

### 语言
界面文案用**中文**（个人工具，仅中文，无语言切换）。

### 参考材料
- 布局/结构: `docs/research/ai-explore-poker-820d0558/chat-6ea4b827/PAGE_TOPOLOGY.md`
- 交互: `.../BEHAVIORS.md`
- 原站截图: `docs/design-references/ai-explore-poker-820d0558/chat-6ea4b827/state-*.png`（像素级基准）

## 组件清单（每个构建者一个文件/一组文件，勿动他人文件）
| # | 组件 | 文件 | 规格 |
|---|---|---|---|
| 01 | Shell（状态+布局+组装） | shell.tsx, app-context.tsx（已存在） | 01-shell.md |
| 02 | Sidebar（含账户区+文档库分组） | sidebar.tsx | 02-sidebar.md |
| 03 | WelcomeView | welcome-view.tsx | 03-welcome.md |
| 04 | ChatCard（递归术语树） | chat-card.tsx | 04-chatcard.md |
| 05 | InputArea | input-area.tsx | 05-inputarea.md |
| 06 | MindscapePanel（节点列表+验证+入口） | mindscape-panel.tsx | 06-mindscape.md |
| 07 | Modals（设置/引导/档案） | modals.tsx | 07-modals.md |
| 08 | DocReader（文档库+分栏阅读器） | doc-reader.tsx | 08-docreader.md |
| 09 | MindUniverse（全屏 3D） | mind-universe.tsx | 09-minduniverse.md |
| 10 | Vision（图片理解：直传/路由识图/缓存） | app-context.tsx, input-area.tsx | 10-vision.md |
| R9 | 发散 + 分支卡片（卡片树） | — | r9-divergence-branch-cards.md |
| R10 | 平行视图 + 文档 AI 解读 + 卡片树 v2 | — | r10-parallel-view-doc-interpret.md |

## 运行 / 打包桌面应用

### 开发
- `npm run dev` → http://localhost:3000（独立浏览器调试）
- `npm run build` / `npm run lint` / `npm run typecheck` / `npm run check`

### 打包给朋友（无需 Node 的桌面应用）
- `npm run package:app` → 生成 `release/` 下的可分发包
  - `OriginExplore-<version>-setup.exe`：NSIS 安装版（带桌面快捷方式）
- 打包流程：`next build`（standalone）→ 组装运行目录 → electron-builder
- 架构（`electron/main.js`）：Electron 主进程用 `utilityProcess` 内置运行 Next.js standalone 服务 → 打开窗口加载
  `http://127.0.0.1:<port>`。数据全存本机（桌面版以文件形式持久化于 userData，浏览器版存 localStorage）。
- 桌面版端口固定复用（`userData/explore-port.json`），保证 origin 稳定、重启后数据不丢；
  状态数据由主进程原子写入 `userData/explore-state-v1.json`（老数据首次启动自动从 localStorage 迁移）。
- 崩溃/运行日志：`%APPDATA%\OriginExplore\explore.log`

### 联网搜索
- 服务端代理 `src/app/api/search/route.ts`（`GET /api/search?q=`）：主源 Bing RSS、回退 DuckDuckGo；
  开启后 BYOK 回答基于实时结果并附来源链接（离线模式已于 v1.0.0 移除，AI 能力全部走 BYOK）。
