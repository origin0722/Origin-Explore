# Clone Progress — https://ai.explore.poker/chat

Last updated: 2026-08-14（BYOK 流式 SSE + 相关概念同域修复）

## 目标
克隆 Explore（AI 结构化思维/层级对话工具）界面。定位为**个人工具**：路由 `/`、mock 数据、无后端、数据仅存 localStorage、仅中文文案。
- site-key: `ai-explore-poker-820d0558` / page-key: `chat-6ea4b827`

## 阶段总览
- Phase 1 侦察 — ✅ 完成（下方）
- Phase 2 基础建设 — ✅ 完成（设计令牌/字体/类型/组件规格）
- Phase 3 组件构建 — ✅ 完成（9 个组件：Shell/Sidebar/Welcome/ChatCard/InputArea/Mindscape/Modals/DocReader/MindUniverse）
- R7 像素级 QA — ✅ 完成（见 `docs/specs/.../r7-qa-handoff.md`）
- **R8 功能开发 — ✅ 完成**（见 `docs/specs/.../r8-dev-handoff.md`）

## Phase 1 侦察 — ✅ 已完成（2026-08-13）

**攻克记录**:
1. **Edge 启动回归** → 原因: Edge 151 自重启进程（compat layer）导致 puppeteer 连接失败。修复: 启动参数加 `--edge-skip-compat-layer-relaunch`（两个脚本已更新）
2. **引导向导卡死** → 原因: 向导 Next 按钮在无头环境点击不推进 React 状态；向导打开条件与 storage 无关。解法: CSS 注入隐藏全部弹窗背板（`bg-overlay-modal`/`bg-black/60`/`bg-black bg-opacity-50`）露出底下主 UI —— probe 的 `hideov` 动作 / extract-layout 已内置
3. **zoom 坐标系** → probe 已 seed 完整 settings-storage（含 uiZoom:1、language 等），逻辑=物理 1440×900

**产出**:
- `PAGE_TOPOLOGY.md` — 布局骨架/组件结构/状态机/弹窗栈（结构级，非像素级）
- `BEHAVIORS.md` — 交互行为清单（实测+推断标注）
- `layout-mainui-elements.json`（59 元素+计算样式）、`state-*-legend.txt`（全状态坐标图例）
- `inline-css-all.css`（11KB 运行时 CSS + 20 keyframes）、`inline-styles.json`（markdown 排版）
- `js-chunks/`（20 个 bundle，离线分析用）
- 截图: `docs/design-references/.../state-*.png`（boot/mainui/newproj1/ce/mobile-* 等）

**关键事实**: 登录墙（"Please log in to use built-in models."）— AI 真实回复无法在线提取，克隆用 mock 数据按卡片结构构造。

## 脚本
1. `probe-ai-explore-poker-820d0558.mjs` — 交互探测（--actions= 链、--vp=WxH、hideov/ov/ls/radio/ctrlenter 动作）
2. `extract-layout-ai-explore-poker-820d0558.mjs` — 布局+计算样式提取（内置 hideov）
3. `inspect-ai-explore-poker-820d0558.mjs` — 全量初检
4. `qa-pixel.mjs` / `qa-local.mjs` / `analyze-diff.mjs` / `row-profile.mjs` / `font-check.cjs` — QA 与分析
5. `verify-*.mjs` — 功能回归测试（R8 新增，共 5 个）

## 下一步
见 `docs/specs/ai-explore-poker-820d0558/r8-dev-handoff.md` 第六节「剩余已知差距」。

