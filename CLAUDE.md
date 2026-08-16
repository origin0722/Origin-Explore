# CLAUDE.md — OriginExplore 项目指南

## 项目简介
OriginExplore：AI 结构化思维与知识探索工具。Next.js 16 + React 19 + Tailwind v4 前端，纯本地存储（localStorage），BYOK（用户自带 OpenAI 兼容 API Key，浏览器直连），可选打包为 Windows 桌面应用（Electron）。

## 常用命令
- `npm run dev` — 开发模式（http://localhost:3000）
- `npm run build` — 生产构建（standalone 输出）
- `npm run start:web` — 生产预览（http://127.0.0.1:3210，自动补拷 static）
- `npm run typecheck` / `npm run lint` — 类型检查 / ESLint
- `npm run package:app` — 打包桌面便携版（先确保已 `npm run build`；国内网络可设 ELECTRON_MIRROR 镜像）
- `node scripts/use-icon.mjs <图片>` — 更换应用图标

## 关键约定
- 界面文案全中文；个人工具，无登录/订阅，数据仅存本机
- 全局状态中心：`src/components/sites/ai-explore-poker-820d0558/app-context.tsx`（useApp()），所有组件经它读写状态
- AI 接入：OpenAI 兼容 `/chat/completions` 流式（SSE），`streamOpenAICompatible` 在 app-context.tsx 导出
- **无离线知识库**：所有 AI 能力必须走 BYOK；无 API 时输入区禁用并提示配置
- 设计令牌：globals.css `@theme`（bg-bg/text-primary/border-std 等语义类），换肤靠 `[data-theme]` 变量，勿硬编码颜色
- 术语卡片交互：AI 回复加粗术语可点开深挖（↗️ 深挖/➡️ 对比/⬇️ 另起炉灶），发散（🪢）与分支（⛓）卡片在 chat-card.tsx
- 文档：`docs/specs/` 组件规格；改完代码跑 `npm run typecheck`

## 桌面打包注意
- `electron/main.js`：默认启用 GPU 硬件加速；GPU 进程崩溃自动带 `--disable-gpu` 重启兜底
- 打包产物在 `release/`（gitignore）；`.packaging/next` 为暂存目录
- `build/icon.png` 是自定义图标源（已加入 gitignore 例外，必须入库）；`src/app/icon.png` 为网站 favicon
