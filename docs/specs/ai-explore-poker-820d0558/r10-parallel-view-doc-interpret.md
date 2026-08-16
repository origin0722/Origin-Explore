# R10 平行视图 + 文档 AI 解读 + 卡片树 v2 — 设计文档

> 需求来源：R9（发散/分支卡片）落地后用户的连续反馈链：
> ① 平行对话应该与来源**同级**（左右滑动，而不是堆在主对话下方）；
> ② 只有"来源 ↔ 发散"是左右关系，主对话流继续询问应**向下**出新卡片；
> ③ 发散对话是独立线程，在里面继续提问要**顺延进该对话**，只有点「回到主对话」才回去；
> ④ 上传文件后应该**先 AI 解读**，卡片分配由解读结果决定（不要机械"一段一卡片"）；
> ⑤ 卡片树要有位置感（"你在这里"）并大胆升级视觉（曲线/动效）。

## 一、视图模型（`chat-card.tsx`）

```
ViewSpec = { kind: "stream" } | { kind: "parallel"; sourceId: string; cardId: string }
```

- **主流（stream）**：root + 分支卡片纵向堆叠，发消息 → 新卡片向下出现（`focusTurn` → `goTo(stream)` + 滚动定位）。
- **平行组（parallel）**：来源轮次 + 它的直接发散卡片（`parallelCards(sourceId)`），一次显示一张，组内左右滑动切换。
- **过渡**：`goTo(to)` 统一视图切换——主流 → 平行 = 主流左移出、发散从右滑入（380ms `cubic-bezier(0.22,1,0.36,1)`）；反向镜像；组内按下标差定方向。过渡中再次切换：先提交当前过渡再重放（`slideRef`/`viewRef` 确定性锚点）。`prefers-reduced-motion` 直接切换。
- **渲染**：单层渲染 `renderView(view)`；过渡期双层（from 绝对定位 + to 在流内），`idPrefix: "main" | "old" | "new"` 防锚点 id 冲突。

## 二、状态层（`app-context.tsx` 新增）

| API | 说明 |
|---|---|
| `openDivergeTurn(title, sourceTurnId, anchor?)` | 返回 `{ id, created }`；`anchor = { sourceTitle, anchorText }` 注入 `buildDivergePrompt`（来源主题 + 术语所在段落，模型理解语境）；**不再种探索记录**（防卡片树名词重复） |
| `openBranchTurn(title, history?, sourceTurnId?)` | 返回 `{ id, created }` |
| `sendInTurn(turnId, text)` | 消息级顺延：给指定轮次追加用户消息并流式回复（`deliverReply` 增加 `turnId` 参数，不再只写"最后一个 turn"） |
| `sendDocQuestion(text)` | 文档段落视图底部提问：建/复用「论文：xxx」项目，文档全文（截断 8000 字）注入上下文 |
| `interpretDocument(docId, force?)` | AI 解读：BYOK 流式（250ms 节流写入 `doc.interpreted`，边生成边浮现）+ 离线 `heuristicInterpret` 回退；`docInterpretingIds: string[]` 支持并发；`force` 重新解读 |
| `parallelSendTarget` / `setParallelSendTarget` | 平行视图发送目标（ChatCard 视图切换时同步；InputArea 据此走 `sendInTurn` / `sendDocQuestion` / `sendMessage` 三路） |
| `treeFocus` / `setTreeFocus` | 卡片树聚焦（ChatCard 同步；TurnGraph 高亮 + 自动滚动） |

## 三、文档解读（`doc-reader.tsx` + `doc-parser.ts`）

- **流程**：上传 → `setActiveDocId(firstId)` + `interpretDocument(firstId)` → 解读视图显示"AI 正在理解…"加载态（首块生成前**不显示机械分段**）→ 解读块随流式进度逐块浮现 → 卡片 = AI 语义分块结果。原文段落流仅通过「原文」按钮切换。
- **解读结构**（提示词约束）：① `## 全文概览`（背景/核心问题/方法/结论/创新点 3-6 条）；② 语义分块（3-12 块，`## 标题`，作者/日期/脚注等碎信息并入相邻块或概览）；③ 双语对照（中文为主 + 块末 `> 原文` 引用 + 术语英文括号注释，如"机器学习（Machine Learning）"；中文原文只需润色）；④ 关键信息保留（数据/公式/引文/列表不省略）；⑤ 术语 `**加粗**`。
- **碎块防线**（三层）：`splitParagraphs` 短块（<24 字符）并入相邻块；提示词禁止碎信息单独成块；渲染兜底（解读块正文 <12 字 → `📌 标题：内容` 紧凑附注行）。
- **块操作**：每块下方「🪢 创建发散卡片」（`openDivergeTurn`，锚点 = 块文本 + 文档名）/「⛓ 创建分支卡片」（`openBranchTurn`，历史 = 块文本），随后 `setActiveDocId(null)` 回对话视图。

## 四、卡片树 v2（`turn-graph.tsx`）

- **位置感**：`focus` prop（来自 `treeFocus`）——当前卡片品牌色渐变 + 呼吸辉光（`tree-focus-glow`）；平行视图时来源 + 发散组 `tree-group-bg` 淡染；聚焦变化自动 `scrollIntoView({ block: "nearest" })`。
- **视觉**：`TreeConnector` SVG 贝塞尔曲线（`viewBox 0 0 22 24`，`overflow-visible`）——
  - 发散：`M4 -9 C 4 10, 17 5, 17 13`（横向分流，diverge 色）
  - 分支：`M4 -9 C 4 3, 4 12, 14 12`（纵向弯肘，brand 色）
  - 术语卡：`M4 -4 C 4 4, 13 5, 13 12`（短挂接）
  - 首次出现描线动画（`tree-dash`）；节点逐行错峰浮现（`tree-row-in`，18ms/行，上限 420ms）。
- **去重**：发散行标题加「（平行）」语境化；发散探索链首项 == 标题时渲染跳过（兼容旧种子数据）；发散行 `title` 提示完整信息（「煤炭」平行会话 · 从「工业革命」发散）。
- 全部动效尊重 `prefers-reduced-motion`。

## 五、涉及文件

`types.ts`（DocumentItem.interpreted）· `app-context.tsx` · `chat-card.tsx` · `turn-graph.tsx` · `doc-reader.tsx` · `input-area.tsx` · `sidebar.tsx`（文件夹折叠/计数/空提示）· `doc-parser.ts`（splitParagraphs 短块合并 + heuristicInterpret）· `globals.css`（chat-slide / tree-* 动画）

## 六、验证

- `npx tsc --noEmit` + `next build`（或 dev server 编译日志无 ERROR）。
- 手测路径：
  1. 主对话问「工业革命」→ 继续发问 → 新卡**向下**出现；
  2. 点术语「煤炭」→ 🪢 发散 → 主流滑向左、煤炭平行对话从右滑入；`‹ ›` / 键盘 `←/→` 在组内切换；「回到主对话」滑回；
  3. 平行对话内继续提问 → 消息顺延进煤炭卡片（不弹回主流）；
  4. 卡片树：聚焦卡辉光、发散组淡染、自动滚动；「煤炭」不再重复出现；
  5. 上传英文论文 → "AI 正在理解…" → 全文概览 + 语义块逐块浮现（中文 + `> 原文` 对照）→ 块上 🪢/⛓ 可开对话；「原文」可切换；「⟳ 重新解读」可重跑。
