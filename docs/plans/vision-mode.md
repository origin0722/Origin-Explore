# Origin-Explore 视觉模式（Vision Mode）实施计划

> 借鉴 dsh-vision-router（DSH 插件）「主模型当大脑、独立视觉模型当眼睛」的思路，为 Origin-Explore（网页 + Electron 桌面）增加图片理解能力。

## 一、目标与设计理念

- 任何主模型（含纯文本的 DeepSeek）都能「看图」；图片入口三合一：文件选择 / 剪贴板粘贴 / 拖拽。
- 混合模式（auto 判定）：
  - 主模型标记 vision → OpenAI 多模态 content parts 直传原图；
  - 主模型纯文本但已配置视觉模型 → 视觉模型先把图转为结构化描述再注入提示词（即 dsh-vision-router 的路由模式）；
  - 两者皆无 → toast 提示并阻止发图。
- 借鉴的核心机制：降采样（画布重编码，兼顾质量与 localStorage 配额）、内容哈希缓存（同图不重复识别）、历史旧图自动降级为文字描述（控制每轮请求体量与费用）。
- 「插件」落地方式：本应用无 cordis/插件系统，等价实现为高内聚模块 `src/lib/sites/ai-explore-poker-820d0558/vision.ts` + 少量接入点，宿主改动最小化。

## 二、架构与改动点（基于现状逐点落地）

### 1. 数据模型（`src/types/sites/ai-explore-poker-820d0558.ts`）

- 新增 `AttachedImage { id, name, mime, thumbDataUrl(≤512px JPEG q0.75，持久化), fullDataUrl?(≤1280px q0.8，仅内存), width, height, hash(SHA-256) }`
- `Message.images?: AttachedImage[]`——content 保持 string 不动，避免波及标题提取、总结、分支切片等全部 string 假设
- `ModelPreset.vision?: boolean`（`ModelInfo.vision` 已存在，接活即可）；`ChatSettings` 新增 `visionMode: "auto"|"native"|"router"|"off"`（默认 auto）、`visionModelId: string | null`

### 2. 新模块 `src/lib/sites/ai-explore-poker-820d0558/vision.ts`（核心）

- `fileToAttachedImage(File)`：读取 → 画布双档降采样（full/thumb）→ SHA-256 哈希
- `describeImage(byok, image, signal)`：调视觉模型产出结构化中文描述（主体/场景/文字转录/布局/颜色），失败重试 1 次
- 视觉缓存：独立 localStorage key `explore-vision-cache-v1`，`hash → {desc, model, at}`，LRU 上限 50
- `toWireParts(images, mode)`：生成 image_url parts 或描述文本

### 3. 请求管线（`app-context.tsx`）

- `streamOpenAICompatible`（:50）messages 参数放宽为 `content: string | parts[]`——唯一网络改动点，函数体不变
- 新 `toWireMessages()` 收敛现存 5 处历史拼装（sendMessage:1287 / sendInTurn:1330 / branchContext:1399,1422 / askInCard:888）：最近一条带图用户消息 → parts（原生）或描述注入（路由）；更早的图 → 缓存描述降级
- `sendMessage` / `sendInTurn` 增加 images 参数：路由模式先「正在看图…」预处理（查缓存 → miss 调视觉模型）再进 `deliverReply` 常规流程；Message 落盘前剥离 `fullDataUrl`
- `useVisionDecision()` helper：按 `activeModel.vision` / `visionMode` / `visionModelId` 三要素判定走原生、路由还是拦截

### 4. 输入 UI（`input-area.tsx`）

- 工具栏新增 `ImagePlus` 按钮 + hidden input（`accept="image/*" multiple`）；textarea `onPaste`；输入卡 `onDrop`/`onDragOver` + 拖入高亮
- 缩略图条（仿既有 quote-chip :166）：64px 圆角缩略图 + X 移除；上限 4 张、单张源文件 ≤10MB，超限 `setAppNotice`
- 发送条件放宽为 `text || quotes || images`；三态路由不变；文档视图发图 → notice「文档解读暂不支持图片」
- 卡片内对话（术语卡/分支续问）v1 不接入图片（列为后续方向）

### 5. 消息渲染（`chat-card.tsx` + `globals.css`）

- 用户气泡 content 下方渲染 images 缩略图网格；点击简易 lightbox（fixed 遮罩，Esc/点击关闭）
- 路由识别过的图片附小字「已由 {视觉模型} 识图」
- `.markdown-content img` 补样式（rounded、max-width:100%）；TermCard 内聊天（:244）复用同一 Message 自然获得渲染

### 6. 设置（`modals.tsx` + `mock.ts`）

- BYOK 表单新增「视觉模型」复选框 → 写入 `vision`，激活既有 Vision 徽章（:338）；`addByokModel`（app-context.tsx:782）透传
- `MODEL_PRESETS`（mock.ts:24）：多模态预设补 `vision:true`（实现时按官方文档核实）；新增视觉专用预设 GLM-4V-Flash（智谱免费档）、Qwen-VL-Max（DashScope）
- 「AI 模型」区新增「视觉模式」卡片：模式四选（默认 auto）+ 视觉模型下拉（vision=true 列表 + 去添加快捷入口）+ 一句话说明

### 7. 持久化与桌面端

- `Message.images` 只落缩略图（约 30-60KB/张），随既有 `explore-state-v1` 序列化与备份自然携带；配额告警路径已有（app-context.tsx:565）
- Electron 零改动（渲染进程即纯网页，粘贴/拖拽/file input 均可用），打包后冒烟验证一次

### 8. 文档

- `UsageDocModal`（modals.tsx:1308）新增章节「视觉模式」（两种路线说明 + 建议：DeepSeek 用户配 GLM-4V-Flash 免费档当眼睛）
- README 功能表、CHANGELOG 条目；`docs/specs/ai-explore-poker-820d0558/` 新增 `10-vision.md` 组件规格

## 三、实施步骤（并行友好，按仓库惯例 worktree 分支）

| 步骤 | 内容 | 方式 |
|---|---|---|
| **T1 地基** | types 扩展 + vision.ts + streamOpenAICompatible 类型放宽 + toWireMessages 收敛 + ChatSettings 字段 | 串行，主干 |
| **T2 输入 UI** | 附件按钮 / 粘贴 / 拖拽 / 缩略图条 | worktree |
| **T3 设置 UI** | 复选框 / 预设 / 视觉模式卡片 | worktree |
| **T4 渲染** | 气泡图片 + lightbox + img CSS | worktree |
| **T5 串联** | sendMessage/sendInTurn/deliverReply 接入预处理、auto 判定、缓存、历史降级 | 主干 |
| **T6 收尾** | 文档四处更新 + `npm run check`（lint+typecheck+build）+ Electron 打包冒烟 | 主干 |

## 四、验收清单

- [ ] 原生：GPT-5.4 / Gemini 2.5 Flash 直传 image_url，回复正确描述图片细节
- [ ] 路由：DeepSeek V4 主模型 + GLM-4V-Flash 眼睛，描述注入后能回答图中相关问题
- [ ] 粘贴 / 拖拽 / 按钮三入口可用；第 5 张、>10MB 被 toast 拦截
- [ ] 同图二次发送命中缓存（不发视觉请求）；追问轮次历史图降级为描述、请求体不含历史 base64
- [ ] 未配置任何视觉能力时发图 → 明确 toast 引导设置
- [ ] 旧数据（无 images 字段）兼容；备份导出/导入带图往返成功
- [ ] 桌面打包版粘贴与拖拽可用

## 五、v1 明确不做（后续方向）

- dsh 式工具化视觉（vision_ocr/detect 按需调用，需工具循环）、多视觉模型 fallback 链、OCR 专用入口
- IndexedDB 图片库、文档视图发图、卡片内对话发图

## 六、本次交付物

本计划文档（`docs/plans/vision-mode.md`）。不写功能代码、不改其他文件。
