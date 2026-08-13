# 组件规格 — Explore 克隆（ai-explore-poker-820d0558 / chat-6ea4b827）

> 视觉要求（2026-08-13 更新）：**像素级对比原站截图**（用户："要做就做最好最完美"）。结构、间距、颜色尽量贴近原站；原站不可见区域（登录墙后的 3D 宇宙）按拓扑+空态截图合理还原。

## 技术栈
- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + lucide-react（已装）
- 3D: three + @react-three/fiber + @react-three/drei（已装）；文档解析: unpdf + mammoth（已装）
- 组件目录: `src/components/sites/ai-explore-poker-820d0558/`（每个构建者只写自己的文件）

## 共享契约

### 类型 & Mock 数据（已存在，直接 import，不要重写）
- `src/types/sites/ai-explore-poker-820d0558.ts` — 全部类型：Project/Turn/Message/ChatProject/ChatSettings/ModelInfo/ThoughtNode(pending|validated)/TermNode(kind: child|related|branch + children 递归)/ThemeOption{id,name}/Profile/DocumentItem/TermState("unseen"|"asked"|"mastered")
- `src/lib/sites/ai-explore-poker-820d0558/mock.ts` — MODELS(全部解锁) / THEMES({id,name}[] 9 个) / DEFAULT_SETTINGS / MOCK_REPLY_MARKDOWN / TERM_TREE(3 层递归术语树) / findTerm() / genericTermSummary() / GLOSSARY(30 条中英对照) / themeId(name)→data-theme key / isThemeImplemented(name) / makeDemoProject / makeDemoTurn / MINDSCAPE_EMPTY / EMPTY_THOUGHTS
- `src/lib/sites/ai-explore-poker-820d0558/doc-parser.ts` — extractTextFromFile(file)→{kind,content}（pdf/docx/md/txt/html 客户端解析）、kindFromName、kindLabel、isParseable
- `src/lib/sites/ai-explore-poker-820d0558/term-detect.ts` — detectTerms(text, limit?)→TermCandidate[]{term,score,kind:"glossary"|"heuristic"}（词典+启发式）

### 语义类名（globals.css @theme 已生成，直接用）
- 颜色: `bg-bg`(页底，主题变量) / `bg-brand` `text-brand` `text-brandtw`(品牌绿，主题变量) / `bg-btn-std` `bg-btn-std-hover` / `bg-btn-control` `bg-btn-control-hover` / `bg-btn-selector` / `bg-btn-inputarea`(绿) `bg-btn-inputarea-transparent-hover` / `bg-card-std` / `bg-card-floating` / `bg-modal-std` / `bg-modal-floating` / `bg-item-std` `bg-item-std-active` `bg-item-std-hover` / `bg-usermsg` / `bg-inputarea` / `bg-overlay-modal`
- 文本: `text-primary` `text-text-secondary` `text-text-tertiary` `text-text-quaternary` `text-text-header-secondary` `text-text-turn-title` `text-text-icon-secondary` `text-text-content`
- 边框: `border-std` `border-divider` `border-turn-std`
- 阴影: `shadow-card` `shadow-brand` `shadow-brandtw` `shadow-selector` `shadow-usermsg` `shadow-btn`
- 圆角: `rounded-usermsg`(14px) + 任意值
- 滚动条: `scrollbar-card-std` `scrollbar-inputarea` `scrollbar-card-neon` `nav-scroll` `no-scrollbar`
- markdown 渲染: `.markdown-content`（全局已定义排版）+ `.mind-md`（紧凑版）
- 卡片动画: `.card-container` + `entering-from-bottom`/`exiting-fly-*` 等（globals.css 已定义）
- **注意**：`text-content-brand` 不存在，用 `text-brand`

### AppContext（app-context.tsx 已实现，直接 import { useApp }）
useApp() 提供: settings/setSettings / projects/activeProjectId/createProject/selectProject/deleteProject / collapsed/toggleSidebar / mindscapeOpen/setMindscapeOpen / universeOpen/setUniverseOpen / modals/openModal/closeModal / turns/activeTurn / sendMessage/busy / **openBranchTurn(title, aiContent?)**（分支卡片开新 turn）/ **profile/setProfile** / **thoughtNodes/addThoughtNode(subject,content,category?)/validateThoughtNode(id)/removeThoughtNode(id)** / **termStates/markTermState(term,state)** / **documents/addDocument/removeDocument/activeDocId/setActiveDocId** / **openDocQuestion(term, docName)**（文档问答→自动建"论文：xxx"项目+新 turn）

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
