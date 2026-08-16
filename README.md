# OriginExplore — AI 结构化思维与知识探索工具

> 哪里不懂点哪里，把一次对话长成一棵属于你的知识树。

**OriginExplore** 是一款个人知识探索工具：基于 AI 的多层级对话，把「提问 → 深挖 → 发散 → 分支 → 收录」串成可视化的知识网络。支持浏览器直接使用，也支持打包为 Windows 桌面应用（Electron，免安装 Node 环境，双击即用）。

- **纯前端 + 本地存储**：所有数据仅保存在本机（localStorage），无后端、无账号、无订阅
- **自带密钥（BYOK）**：在设置中添加任意 OpenAI 兼容接口的模型（DeepSeek / OpenAI / Claude / Gemini / Qwen / GLM / Kimi / MiniMax 等 11 个预设），密钥仅存本机，请求由浏览器直连你的 API 地址
- **双形态**：Web（Next.js 16）+ 桌面（Electron 便携版/安装版）

---

## ✨ 功能特性

| 能力 | 说明 |
|---|---|
| 🧠 层级对话 | AI 回答中的**加粗术语**可点击：↗️ 深挖背景 · ➡️ 横向对比 · ⬇️ 另起炉灶，答案连成树 |
| 🪢 发散对话 | 平行会话与主对话同级展开、互不打断；平行视图内可继续提问（消息级顺延） |
| ⛓ 分支卡片 | 基于某个理解另起炉灶，可调整分支点、生成上游总结 |
| 🌲 卡片树 | 对话右侧常驻导航地图：点击跳转、右键已读/未读、关系曲线引导 |
| 🌌 思维宇宙 | 全屏 3D 视图，把「懂了」的概念收录成星球，俯瞰自己的理解网络 |
| 📄 文档阅读 | 上传 PDF / Word / Markdown / TXT / HTML，AI 语义分块 + 双语对照解读，划词即问 |
| ⭐ 收藏与智能摘要 | 收藏重要轮次，AI 一键生成要点摘要 |
| ✨ 智能模式 | 常驻聊天结合你的档案、思维宇宙与术语掌握度个性化回答 |
| 🔎 联网搜索 | 不确定的问题先实时检索网页再回答，附来源链接 |
| 🖼 视觉模式 | 发送图片让 AI 看图：多模态主模型直传原图，纯文本主模型由视觉模型识图（支持粘贴/拖拽，同图缓存） |
| 📦 数据备份 | 一键导出/导入完整备份（项目+思维宇宙+文档+设置），按 id 合并还原 |
| 🎨 9 套主题 | 赛博青 / 白蓝 / 暗紫霓虹 / 琥珀暖橙 / 纸墨风 / 品红 / 森林绿 / 海洋蓝 / 玫瑰金 |
| ⚡ BYOK 连通性测试 | 添加模型前可「测试连接」，配置错误即时发现 |
| 📖 使用文档 | 侧边栏内置完整图文教程（9 章），新手上路零门槛 |

## 🖥 桌面应用

Windows 桌面版把 Next.js standalone 服务器与 UI 一起打包进单个 exe（Electron + utilityProcess 运行，**朋友机器无需安装 Node**）：

- **便携版**（`OriginExplore-<version>-portable.exe`）：双击即用，免安装，适合分发
- **安装版**（`OriginExplore-<version>-setup.exe`）：NSIS 安装器，支持自定义安装目录与桌面快捷方式，安装后启动更快（零解压）

> 桌面版与网页版是同一套 UI；数据都存本机（桌面版在 `%APPDATA%\OriginExplore` 下，网页版在浏览器 localStorage，互不互通）。

## 🚀 快速开始

### 网页版

```bash
npm install
npm run dev          # 开发模式 http://localhost:3000
# 或
npm run build
npm run start:web    # 生产模式预览 http://127.0.0.1:3210（自动补拷 static，避免黑屏）
```

首次使用：打开应用 → 设置 → AI 模型 → **添加 BYOK 模型**（可一键填充预设）→ 「测试连接」确认可用 → 开始提问。

### 打包桌面应用

```bash
npm run package:app  # 生成 release/OriginExplore-<version>-portable.exe
npx electron-builder --win nsis   # 额外生成安装版 setup.exe
```

> 国内网络打包时若 GitHub 资源下载超时，先设置镜像：
> ```powershell
> $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> ```

### 更换应用图标

```bash
node scripts/use-icon.mjs <图片路径>   # 处理为 build/icon.png（512×512，透明适配）
npm run package:app                    # 重新打包（检测到自定义图标后不再覆盖）
```

图标同时作用于：exe 文件图标、任务栏、快捷方式、网站 favicon（`src/app/icon.png`）。

## 🛠 技术栈

- **框架**：Next.js 16（App Router, Turbopack）+ React 19 + TypeScript strict
- **样式**：Tailwind CSS v4 + shadcn/ui 设计令牌（oklch 主题变量，9 套运行时换肤）
- **3D**：three.js + @react-three/fiber + @react-three/drei（思维宇宙）
- **文档解析**：unpdf（PDF）+ mammoth（Word）+ 客户端解析
- **桌面**：Electron 43（utilityProcess 运行 Next standalone）+ electron-builder
- **AI 接入**：OpenAI 兼容 Chat Completions 流式接口（SSE），浏览器直连 BYOK

## 📁 项目结构

```
src/
  app/                     # Next.js 路由（/ 主应用，/api/search 联网搜索代理）
  components/sites/ai-explore-poker-820d0558/
    app-context.tsx        # 全局状态中心（项目/对话/文档/思维宇宙/设置，localStorage 持久化）
    shell.tsx              # 主布局（侧边栏 + 对话区 + 思维宇宙面板 + 弹窗）
    sidebar.tsx            # 侧边栏（项目/文件夹/本地文档/收藏/使用文档/设置/账户）
    chat-card.tsx          # 对话卡片（术语树递归深挖 + 发散/分支 + 平行视图）
    input-area.tsx         # 输入区（模型选择/联网开关/引用/三态发送）
    modals.tsx             # 设置（含 BYOK 测试连接）/ 新手引导 / 使用文档 / 账户
    doc-reader.tsx         # 文档库 + AI 解读阅读器
    mind-universe.tsx      # 全屏 3D 思维宇宙
    mindscape-panel.tsx    # 思维宇宙侧栏（收录验证）
    turn-graph.tsx         # 卡片树导航图
    welcome-view.tsx       # 欢迎页
  lib/sites/ai-explore-poker-820d0558/
    mock.ts                # 模型预设/术语树/词典/项目工厂
    doc-parser.ts          # 文档解析与分段
    term-detect.ts         # 术语检测
  types/                   # 共享类型
electron/main.js           # Electron 主进程（GPU 策略 + 崩溃兜底 + 本地服务器）
scripts/                   # 打包/图标/预览/验证脚本
docs/                      # 规格、研究、设计参考文档
```

## 📚 文档

- `docs/specs/ai-explore-poker-820d0558/` — 组件规格（shell/sidebar/chatcard/…）与设计决策（平行视图、文档解读、发散分支）
- `docs/research/` — 原站逆向研究材料
- `docs/design-references/` — 设计基准截图
- `CHANGELOG.md` — 版本历史

## 📦 版本

当前版本：**v1.0.0**（首个正式版）

v1.0 里程碑：
- 移除离线知识库，全面转向 BYOK 真实模型（含 11 个最新厂商预设 + 连通性测试）
- 新增「使用文档」教程（侧边栏入口，合并原如何使用/使用指南）
- 桌面端性能修复：启用 GPU 硬件加速（含崩溃自动降级）、瘦身 63%（解压体积 899MB → 331MB）
- 自定义应用图标（exe + favicon 统一）

## 📄 License

MIT
