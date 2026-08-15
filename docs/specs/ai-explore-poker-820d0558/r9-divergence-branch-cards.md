# R9 发散卡片 + 分支卡片（卡片树）— 设计文档

> 需求来源：用户参考 ai.explore.poker/chat 的两种卡片机制，要求在当前克隆的卡片树中实现。
> 前置：R8 已有 `openBranchTurn`（分支轮次 + `parentTurnId` 有向边）与 `related` 术语卡，本阶段补齐语义。

## 一、需求语义（对照原站）

| 卡片 | 原站语义 | 本克隆落地 |
|---|---|---|
| **发散卡片** | 想到关联想法想探讨、又不想影响当前对话 → 开平行会话；与来源卡片**同一层级**、位于来源卡片**右侧**；卡片树中节点也在来源卡片节点右侧 | 新轮次 `kind="diverge"` + `divergeSourceId=来源轮次`；树中紧跟来源轮次之后、同深度、横向右移一档（🪢 虚线引导） |
| **分支卡片** | 继承上游卡片**分支点前**的对话历史 + 上游卡片主题；顶部有**分支提示按钮**可查看/调整分支点（一条明显的分割线）；可对分支点前的对话做总结梳理 | 新轮次 `kind="branch"` + `parentTurnId` + `branchPointIndex`；分支轮次头部 ⛓ 按钮进入调整模式（上游每条消息旁"✂️ 在此分支"），分割线渲染在分支点之后；📋 按钮生成启发式总结 |
| **验证话术** | 可问 AI"当前的相关主题是什么？" / "目前为止进行了哪些对话内容？请分条陈述。" | 离线 `generateReply` 识别两个意图直接作答（BYOK 由真实模型自然回答） |

## 二、数据模型（`src/types/.../types.ts`，全部可选，向后兼容旧 localStorage）

```ts
type TurnKind = "root" | "branch" | "diverge";

// Turn 新增：
//   kind?: TurnKind            // 缺省 root
//   branchPointIndex?: number  // 分支点：上游 messages 中"这条消息之后"分叉；缺省=创建时上游最后一条
//   preBranchSummary?: string  // 分支点前上游对话总结缓存（懒生成）
//   divergeSourceId?: string   // 发散卡片的来源轮次 id
```

## 三、状态层（`app-context.tsx`）

- `openBranchTurn` 增强：写 `kind:"branch"`，`branchPointIndex` 默认 = 创建时上游轮次 `messages.length - 1`。
- `openDivergeTurn(title, sourceTurnId)`：新建 `kind:"diverge"` 轮次（种子消息 + 双通道回复）；**不清空卡片栈**（不打断当前对话）。
- `setBranchPoint(turnId, index)`：调整分支点。
- `summarizePreBranch(turnId)`：`buildPreBranchSummary(source, branch, slice)` 生成启发式总结（主题/分支点/涉及术语/逐条陈述），写入 `turn.preBranchSummary`。

## 四、对话区（`chat-card.tsx`）

- 术语卡片底部新增 **"🪢 发散对话 · 平行会话"** 按钮（与"⬇️ 另起炉灶"并列）；点击 → `openDivergeTurn` + toast，卡片栈保留。
- 分支轮次头部：
  - **⛓ 分支点** 按钮 → 进入调整模式（上游轮次顶部提示条 + 每条消息右侧"✂️ 在此分支"）；点击某条 → `setBranchPoint` → 分割线移动。
  - **📋 总结** 按钮 → `summarizePreBranch` → 轮次顶部折叠的总结面板（可复制）。
- 分支点分割线：上游轮次中，`branchPointIndex` 对应消息之后渲染虚线分隔条 "⛓ 分支点：从这里分出「{title}」分支"。
- 轮次标题行：分支 = `⛓ 分支` 徽章，发散 = `🪢 发散` 徽章（紫色 `#ba8eff`）。

## 五、卡片树（`turn-graph.tsx`）

- `buildRows`：新增 `divergeSourceId → Turn[]` 映射；发散轮次在来源轮次行之后、**同 depth** 入列（`diverge: true`），并从根遍历中排除（来源存在时）；渲染时横向再右移（paddingLeft +22 / marginLeft +16）、紫色虚线左边框 + `Waypoints` 图标。
- 分支轮次嵌套（depth+1）与术语卡片链保持原样。

## 六、离线意图识别（`mock.ts` `generateReply`）

- `/当前.*主题/ && /是什么/` → 用 `topicFromHistory` 作答当前主题。
- `/目前为止.*对话|进行了哪些对话|分条陈述/` → 分条列出最近 8 条消息 + 主题 + 消息数。

## 七、涉及文件

`types.ts` · `app-context.tsx` · `chat-card.tsx` · `turn-graph.tsx` · `mock.ts` · `modals.tsx`（使用指南补两条）

## 八、验证

- `npx tsc --noEmit` + `npm run build`。
- 手测路径：主对话点术语 → 卡片内"🪢 发散对话"→ 树中出现同层右侧发散节点、当前卡片栈未关；分支卡片 → ⛓ 调整分支点（分割线移动）→ 📋 总结出现；离线问"当前主题/分条陈述"两个话术得到应答。
