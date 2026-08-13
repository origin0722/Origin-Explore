# Clone Progress — https://ai.explore.poker/chat

Last updated: 2026-08-13

## 目标（2026-08-13 更新）
克隆 Explore（AI 结构化思维/层级对话工具）界面。**视觉要求已放宽**：结构与交互一致，颜色/文案/图形可自由更换（用户明确）。
- 路由 `/`、mock 数据、无后端
- site-key: `ai-explore-poker-820d0558` / page-key: `chat-6ea4b827`

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

## 下一步（Phase 2 基础建设）
1. **设计令牌** → globals.css（用提取的色值做基础，可自定配色；参考 PAGE_TOPOLOGY §0）
2. **字体** → next/font: Inter + Noto Sans SC + Bruno Ace（logo 用）
3. **图标** → lucide-react 已有依赖确认（zap/brain/sparkles/help-circle/plus/lock/chevron-right/eye/quote/copy/settings 等）
4. **类型** → src/types/sites/ai-explore-poker-820d0558.ts（Project/Turn/Message/ChatSettings）
5. **favicon/资源** → 下载站点 favicon 或自定
6. Phase 3: 组件规格（Sidebar/Canvas/ChatCard/InputArea/Mindscape/Modals/OnboardingWizard）→ 并行构建者
