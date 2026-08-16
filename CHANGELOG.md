# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-16

### Added
- **使用文档**：侧边栏新增「使用文档」入口（收藏下方、设置上方），合并原「如何使用」与「使用指南」为完整 9 章图文教程（欢迎/快速开始/层级对话/发散与分支/卡片树/思维宇宙/文档阅读/智能模式/数据与备份），全部旧入口改指向新文档。
- **BYOK 模型预设更新**：按 2026-08 各厂商官方文档核实并更新 11 个预设——DeepSeek V4 Pro/Flash（`deepseek-chat` 已于 2026-07-24 退役）、GPT-5.4/5.4-mini、Claude Sonnet 4.6（Anthropic 官方 OpenAI SDK 兼容端点）、Gemini 3.1 Pro/2.5 Flash、Qwen3 Max、GLM-4.6、Kimi K2.5、MiniMax M2.7。
- **BYOK 连通性测试**：添加模型表单与已保存模型行均支持「测试连接」（`GET {baseUrl}/models`，10s 超时，显示成功/失败原因）。
- **网站图标**：`src/app/icon.png` + `apple-icon.png`（自定义图片），移除脚手架默认 favicon.ico；桌面 exe 图标、任务栏、网站 favicon 统一为同一张自定义图。
- **全局轻提示（appNotice）**：无 API / 请求失败 / 存储失败等状态统一底部 toast 反馈。

### Changed
- **移除离线知识库**：删除内置离线模型与 mock 回复生成（`generateReply`/`OFFLINE_MODEL`/启发式智能摘要/文档解读启发式回退/示例项目按钮）；未配置 API 时输入区完全禁用并引导配置；API 失败直接报错（不再编造离线回复）。
- **桌面端启动与性能**：恢复 GPU 硬件加速（关闭是点击延迟/卡顿主因，附 GPU 崩溃自动 `--disable-gpu` 重启兜底 + 二次崩溃弹窗）；窗口提前显示；移除欢迎页最贵的流体光斑圆角形变动画。
- **桌面打包瘦身 63%**：排除运行时用不到的 node_modules（app.asar 402MB → 几 KB）、裁剪 Electron 语言包；portable 158MB → 86MB、setup 203MB → 97MB、解压体积 899MB → 331MB。
- **桌面健壮性**：单实例锁（重复启动聚焦已有窗口）、utilityProcess 服务器崩溃指数退避自恢复（最多 3 次）、渲染进程崩溃退避重载、端口全忙明确报错、导航/弹窗边界限制（deny window.open + will-navigate 白名单）。
- **持久化防抖**：localStorage 自动保存 500ms 防抖（流式增量不再逐 token 落盘），写失败明确提示而非静默丢数据。
- **删除项目清理失效引用**（parallelSendTarget/streamingTurnId/focusRequest 等）；文档解读失败清掉半成品缓存。
- **UI 修复**：思维宇宙按钮与对话框同轴居中；平板（640-1023px）主区让位侧边栏不再遮挡内容；弹窗补 `role="dialog"`/`aria-modal`；清理 globals.css 约 20 组死动画与过时文案。
- 明确依赖 `sharp`（图标脚本用，防全新 clone 安装失败）。

### Fixed
- 网站黑屏（standalone 预览缺 `.next/static`）：新增 `npm run start:web` 自动补拷。
- 过时模型预设全部替换（原 GPT-4o/GLM-4/Kimi K2 预览等）。

## [Unreleased]

### Added
- **完整备份/恢复**：侧边栏"导出完整备份"把全部数据（项目+思维宇宙+文档+术语状态+文件夹+档案+设置）导出为单个 JSON；"导入项目/恢复备份"按 id 合并还原（备份胜出、不丢新内容），同时兼容旧版项目文件（`{ title, turns }`），无效文件给出明确提示。
- **发散卡片**：术语卡片上的"🪢 发散对话 · 平行会话"开平行会话（`kind="diverge"` + `divergeSourceId`），不打断当前对话（卡片栈保留）；卡片树中发散节点紧跟来源轮次、同一层级并横向右移（紫色虚线引导）。
- **分支卡片增强**：分支轮次记录 `branchPointIndex`（分支点）；头部 ⛓ 按钮进入分支点调整模式（上游每条消息旁"✂️ 在此分支"，分割线随之移动）；📋 按钮生成"分支点前对话总结"面板（`preBranchSummary`，可复制）。
- **验证话术**（离线知识库）："请问当前的相关主题是什么？" 与 "请问我们目前为止进行了哪些对话内容？请分条陈述。" 直接应答。
- 使用指南补充发散卡片 / 分支卡片条目；`scripts/verify-backup.mjs`、`scripts/verify-divergence-branch.mjs` 回归脚本。

### Fixed
- 发散/分支卡片重复创建去重（同来源+同标题复用并跳转），toast 移出卡片栈条件块。
- 未知词条自动问 AI 只问一次（会话级缓存 + 在途去重），探索路径重复点开零 token 消耗。
- AI 回复嵌套加粗导致 button-in-button 非法嵌套错误（strong 渲染器守卫 + 链接上下文）。
- AppShell 挂载门消除数据驱动的水合不匹配警告。
- 聊天卡片顶部不再置顶项目标题（连续对话易偏离首条消息标题）。

### 平行视图（发散同级交互重设计）
- **混合视图**：主对话流保持纵向堆叠（发消息 → 新卡片向下出现）；发散对话进入"平行视图"——主对话流整体滑向左、发散对话从右滑入（380ms 缓动，`prefers-reduced-motion` 直切）；平行组内（来源 ↔ 发散卡）左右滑动切换，键盘 `←/→` 支持。
- **平行导航条**：🪢 平行会话徽标 + `‹ ›` 同级切换 + 组内计数 + 「从「来源」发散」chip（滑回来源）+「回到主对话」。
- **发散锚点上下文**：发散提示词携带来源主题 + 术语所在段落（模型理解"工业革命语境下的煤炭"），不再泛泛而谈。
- **发散对话内继续提问**（`sendInTurn`）：消息级顺延进发散卡片（独立线程），不再弹回主对话流；输入框三态发送（平行 / 文档 / 主流）+ 对应 placeholder 提示。
- **主流 ⇄ 入口**：有发散会话的卡片操作行显示「⇄ N」，点击直接滑入平行视图（双向可达）。

### 文档 AI 解读（论文精读场景）
- **上传后先解读后分卡**：上传即自动触发 AI 解读（"AI 正在理解…"加载态），卡片分配由解读结果决定；原文段落流降级为「原文」按钮切换。
- **解读结构**（`interpretDocument`，BYOK 流式边生成边浮现 / 离线启发式回退 / 并发 / 重新解读 / 缓存 `doc.interpreted`）：① `## 全文概览`（背景/问题/方法/结论/创新点）；② 语义分块（3-12 块，标题概括，作者/日期等碎信息不单独成块）；③ 双语对照（中文为主 + 块末 `> 原文` 引用 + 术语英文括号注释）；④ 关键信息保留（数据/公式/引文/列表不省略）；⑤ 术语 **加粗** 标记。
- **碎块处理**：原文分段不足 24 字符并入相邻块；解读块正文不足 12 字降级为紧凑附注行（`📌 作者：xxx`）。
- **段落/解读块 → 分支/发散卡片**：锚点 = 段落/块文本 + 文档名，AI 基于文档语境解读。
- **基于全文提问**（`sendDocQuestion`）：底部对话框围绕文档提问，自动建/复用「论文：xxx」项目，全文注入上下文。

### 卡片树 v2（turn-graph）
- **位置感**：当前聚焦卡片高亮（品牌色渐变 + 呼吸辉光）+ 平行组淡染 + 自动滚动到可见（`treeFocus` 同步）；主流视图高亮最新卡片。
- **视觉升级**：SVG 贝塞尔曲线引导（发散横向分流 / 分支纵向弯肘 / 术语挂接），首次出现描线绘制动画；节点逐行错峰浮现；发散行「（平行）」语境化后缀；`⇄ N` 平行计数。
- **名词去重**：去除发散种子探索记录 + 渲染兼容跳过旧数据（卡片树不再出现重复术语节点）。

### Changed
- 发散/分支创建返回 `{ id, created }`；创建/复用/跳转统一滑动聚焦（`goTo` 视图切换，过渡中重放确定性锚点）。
- 回复管线支持指定轮次写入（`deliverReply`/`streamReply`/`appendAssistantMessage`/`setLastAssistantContent` 增加可选 `turnId`）。
- 未读标记与流式贴底适配混合视图（仅当流式卡处于当前视图焦点时跟随）。
- 侧边栏文件夹：可折叠 + 项目计数 + 空文件夹提示（移动入口在项目「⋯」菜单）。

### Fixed
- 卡片树名词重复（"三个煤炭"）：去除发散种子 + 渲染去重。
- 平行视图内提问误回主对话流（改为顺延进发散卡片）。
- 发散创建/跳转不再"占用主对话框底部"（改为平行视图滑入）。

## [0.4.0] - 2026-08-10

### Added
- Docker workflows for local development and multi-stage production builds
- Kiro support through a generated workspace `/clone-website` skill
- Complete generated workspace skills for Cline and Roo Code, including a Roo slash-command bridge
- Simplified Chinese and Japanese READMEs with the same onboarding and workflow guidance as the English documentation
- Contributor and security policies, including a private vulnerability-reporting path
- CI enforcement that generated agent rules and skills remain synchronized with their source files
- Compact pipeline diagrams and a static Star History chart in every README

### Changed
- Raised the project Node.js baseline to 24 across local development, CI, Docker, and contributor-facing documentation
- Refreshed Next.js to 16.3, React to 19.2.4, and related dependencies
- Updated `/clone-website` so later runs preserve existing pages and isolate routes, research, components, assets, and downloaders for each target
- Improved multi-origin and query/fragment planning with collision-resistant output namespaces and explicit route verification
- Redesigned README onboarding around the template workflow, Opus 5 recommendation, supported platforms, and community links
- Hardened the rule and skill generators for current platform schemas and deterministic output

### Fixed
- Gemini CLI command validation by adding the required name and flattening the prompt schema
- Cline and Roo Code invocation, frontmatter, and argument handling
- Next.js documentation resolution in generated agent rules
- Vulnerable framework dependencies and generated-file consistency checks

### Removed
- Aider from the officially supported-platform list because its current capabilities cannot run the complete browser and subagent workflow reliably; `.aider.conf.yml` remains available for loading general project context

### Security
- Documented responsible vulnerability disclosure through GitHub private vulnerability reporting
- Updated vulnerable dependencies to patched releases

## [0.3.1] - 2026-03-29

### Fixed
- `sync-agent-rules.sh` failing to resolve `@file` imports on Windows due to CRLF line endings — platform instruction files now correctly inline the Inspection Guide content

## [0.3.0] - 2026-03-29

### Added
- Multi-URL support for `/clone-website` — clone multiple sites in a single command with parallel processing and isolated output
- CI quality gates via GitHub Actions — automated lint, typecheck, and build on every push and PR
- `npm run typecheck` and `npm run check` scripts for local quality validation
- `.gitattributes` for cross-platform line ending normalization
- `.nvmrc` to pin Node.js 20 for contributor consistency

### Changed
- Streamlined PR template — removed redundant checklist items and screenshots section
- Improved project description and README — clearer use cases, limitations, and modern wording
- Refined documentation and agent rules across all platforms for clarity and consistency
- Fixed CRLF handling in `sync-skills.mjs` for reliable Windows operation

### Removed
- Outdated use case from README documentation

## [0.2.0] - 2026-03-28

### Added
- Multi-platform AI agent support: Claude Code, Codex CLI, OpenCode, GitHub Copilot, Cursor, Windsurf, Gemini CLI, Cline/Roo Code, Continue, Amazon Q, Augment Code, Aider
- Platform-specific instruction files and `/clone-website` skill for each supported agent
- `scripts/sync-agent-rules.sh` to regenerate platform instruction files from AGENTS.md
- `scripts/sync-skills.mjs` to regenerate `/clone-website` skill across all platforms
- GEMINI.md for Gemini CLI configuration
- Supported Platforms table in README
- "Updating for Other Platforms" documentation section in README

### Changed
- README now describes the project as multi-agent (Claude Code recommended, not required)
- AGENTS.md updated with sync script reminders

## [0.1.1] - 2026-03-28

### Added
- Bug report and feature request issue templates
- Pull request template with checklist
- CHANGELOG.md following Keep a Changelog format
- Package.json metadata (description, repository, homepage, keywords, engines)

### Fixed
- LICENSE copyright holder now attributed to JCodesMore

## [0.1.0] - 2026-03-28

### Added
- Initial template scaffold for website reverse-engineering with Claude Code
- `/clone-website` skill for full-site cloning pipeline
- `/build-from-spec` and `/customize` skills
- Parallel builder agents with git worktree isolation
- Chrome MCP integration for design token extraction
- Comprehensive inspection guide and project structure documentation
- Next.js 16 + shadcn/ui + Tailwind CSS v4 base scaffold
- MIT license
- README with badges, demo section, quick start, and star history

[Unreleased]: https://github.com/origin0722/Origin-Explore/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/origin0722/Origin-Explore/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/JCodesMore/ai-website-cloner-template/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JCodesMore/ai-website-cloner-template/releases/tag/v0.1.0
