# 10-vision.md — 视觉模式（Vision Mode）组件规格

> 借鉴 dsh-vision-router「主模型当大脑、独立视觉模型当眼睛」。为 Origin-Explore（网页 + Electron）增加图片理解能力。

## 路线与判定

| 模式 | 行为 |
|---|---|
| `native`（原生） | 主模型多模态（`ModelInfo.vision`）→ OpenAI 多模态 content parts 直传原图 |
| `router`（路由） | 主模型纯文本 + 已配置视觉模型 → 视觉模型先识图（结构化中文描述）再注入提示词 |
| `blocked` | 两者皆无 / `visionMode=off` → toast 提示并阻止发图 |

`decideVision({ mainVision, visionMode, hasVisionModel })`（vision.ts）：
- `off` → blocked；`native` → 主模型多模态否则 blocked；`router` → 有视觉模型否则 blocked
- `auto`（默认）：主模型多模态 → native；否则有视觉模型 → router；都没有 → blocked

## 数据模型（types）

```ts
AttachedImage {
  id; name; mime;
  thumbDataUrl: string;      // ≤512px JPEG q0.75，持久化
  fullDataUrl?: string;      // ≤1280px q0.8，仅内存（落盘前剥离）
  width; height;
  hash: string;              // SHA-256（视觉缓存 key）
}
Message.images?: AttachedImage[]   // content 保持 string 不动
ChatSettings: visionMode ("auto"|"native"|"router"|"off"), visionModelId: string|null
ModelPreset.vision?: boolean       // 多模态标记（BYOK 表单复选框写入）
```

## 核心模块（src/lib/.../vision.ts）

- `fileToAttachedImage(File)`：读文件 → 画布双档降采样 → SHA-256 哈希（crypto.subtle，localhost 安全上下文可用）
- `describeImage(byok, image, signal)`：`GET {baseUrl}/chat/completions` 非流式，image_url parts → 结构化中文描述；失败重试 1 次
- 视觉缓存：localStorage `explore-vision-cache-v1`，`hash → {desc, model, at}`，LRU 上限 50
- `toNativeParts(text, images)` / `toRouterText(text, descs)`：wire 内容组装
- `decideVision(...)`：模式判定

## 请求管线（app-context）

- `streamOpenAICompatible` messages 类型放宽为 `content: string | WireContent[]`（唯一网络改动点）
- `deliverReply(question, history, targetId, onDone?, turnId?, images?)`：
  - 无图 → 原逻辑；有图 → `decideVision` 判定
  - native：最后一条 user 消息 content → parts（文本 + image_url）
  - router：`setAppNotice("🔍 正在看图…")` → 逐图 `describeImage`（缓存命中跳过）→ 描述拼进问题
  - blocked：toast 引导配置，不发送
  - 历史消息图片：命中缓存 → `[图片描述] ...` 文本降级；未命中 → 原文（不含 base64）
- `sendMessage(text, images?)` / `sendInTurn(turnId, text, images?)`：透传 images；落盘剥离 `fullDataUrl`
- 文档视图发图 → notice「文档解读暂不支持图片」；卡片内对话（askInCard）v1 不接入

## 输入 UI（input-area）

- 🖼 ImagePlus 按钮 + hidden input（image/* multiple）；textarea `onPaste`；输入卡 `onDrop`/`onDragOver` 拖入高亮
- 缩略图条：64px 圆角 + X 移除；上限 4 张、单张 ≤10MB（超限 `setAppNotice`）
- 发送条件 `text || quotes || images`

## 渲染（chat-card + globals）

- `UserMessageBubble`（共享组件）：用户气泡文本 + 图片网格（80px 缩略图）→ 点击 lightbox（fixed 遮罩，Esc/点击关闭，显示 fullDataUrl）
- `.markdown-content img`：rounded、max-width:100%

## 设置（modals + mock）

- BYOK 表单「这是一个视觉（多模态）模型」复选框 → `addByokModel(..., vision)`
- 视觉模式卡片：四选一（默认 auto）+ 视觉模型下拉（`byokModels.filter(m => m.vision)` 胶囊选择）
- `MODEL_PRESETS`：多模态预设补 `vision:true`；新增 GLM-4V-Flash（智谱免费档）、Qwen-VL-Max

## 持久化与桌面

- `Message.images` 只落缩略图（30-60KB/张），随 `explore-state-v1` 序列化与备份自然携带
- Electron 零改动（渲染进程纯网页，粘贴/拖拽/file input 均可用）

## 验收

- [ ] 原生：GPT-5.4 / Gemini 2.5 Flash 直传 image_url 正确描述
- [ ] 路由：DeepSeek V4 + GLM-4V-Flash 识图后能回答图中问题
- [ ] 粘贴/拖拽/按钮三入口；第 5 张、>10MB 被拦截
- [ ] 同图命中缓存；历史图降级为描述、请求体不含历史 base64
- [ ] 未配置视觉能力发图 → toast 引导
- [ ] 旧数据兼容；备份带图往返
- [ ] 桌面版粘贴/拖拽可用

## v1 不做

工具化视觉（vision_ocr/detect）、多视觉模型 fallback 链、OCR 入口、IndexedDB 图片库、文档视图发图、卡片内对话发图。
