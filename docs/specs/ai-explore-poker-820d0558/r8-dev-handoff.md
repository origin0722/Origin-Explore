# R8 功能开发 — 交接文档（2026-08-13 续）

> 本文件记录 R7 像素级 QA 之后的功能开发与 bug 修复，供新 agent 无缝接手。
> 上一阶段：`r7-qa-handoff.md`（像素级 QA，全部待办已收尾）。
> 运行中的 dev server: `npm run dev`（localhost:3000，Turbopack 热更新）。

## 一、当前状态总览

Explore 克隆（ai.explore.poker/chat）已从"纯 UI"演进为**可交互的个人工具**（mock 数据、无后端、数据仅存 localStorage）。

**已可用的完整闭环**：新建项目 → 提问 → AI 流式回复（按提问术语动态生成）→ 点击加粗术语展开子卡片（递归知识树）→ 收录进思维宇宙 / 分支另起炉灶 → 文档导入阅读 → 划词问 AI。

## 二、R8 完成的功能（按时间序）

### 核心交互
1. **术语卡片修复**（原 bug：位置错 + 关不掉）——根因：原站 `entering-from-bottom` 动画结尾 `translate(-50%,-50%)` 是为居中卡片设计的，克隆卡片是右锚定（`right-2`），被整体平移出屏。修复：新增右锚定的 `entering-from-right` / `exiting-to-right` 动画（`globals.css`）。
2. **卡片关闭退场动画** + 关闭按钮 z-index 修复（原被轮次导航面板 z-15 盖住，提到 z-20）。
3. **轮次导航开关可点**（开关按钮 `relative z-20` 提到面板之上）。
4. **思维宇宙按钮改为开关式**（点一下开、再点关，aria-label 随状态切换）。

### 内容灵魂（mock AI）
5. **`generateReply(question)`**（`mock.ts`）：按提问匹配知识树/词典术语，动态生成带可点击术语的回复；相关概念按领域聚类（物理↔ML 邻近词）。
6. **流式输出**：回复逐字打字机式出现（`app-context.tsx` sendMessage 内 setInterval 分块更新）+ 聊天区自动滚底。
7. **自动标题**：给 "Untitled" 项目用首条消息命名（受设置"自动标题"开关控制）。

### 侧边栏 & 按钮全部接线（原为 toast 占位）
8. 重命名（项目行内联 + 卡片头部内联）、新建文件夹（内联输入 + 按文件夹分组 + 悬停删除）、导入项目（JSON 文件）、导出为 JSON、智能模式开关（常驻聊天）。
9. **卡片头部**：收起/展开（含高度过渡）、复制（带反馈 toast）、更多菜单（重命名/导出/删除）。

### 设置面板
10. 移除订阅/协作相关：`ModelInfo` 删除 `tier`/`multiplier`/`locked`；侧边栏删除"云端项目/仅会员"；设置删除"编辑权限/API 密钥"分节；模型档位徽章（Free/Pro/Max）全部移除。
11. **BYOK 真实调用**（R8 续；再续：升级为流式 SSE，见第 24 条）：
    - 表单 4 字段：模型名称 / API 地址（OpenAI 兼容 baseUrl）/ 模型 ID / API Key；密钥仅存本机。
    - 选中 BYOK 模型后，`sendMessage` 走真实 `POST {baseUrl}/chat/completions`（非流式，15s 超时，带最近 12 条消息上下文）。
    - 成功 → 真实回复按打字机效果展示；失败（CORS/网络/非 200/超时/空响应）→ 自动回退离线 `generateReply`，回复开头注明原因。
    - 注意：浏览器直连受 **CORS 限制**——提供方需允许跨域（`Access-Control-Allow-Origin`），否则必然回退离线；这是设计上的优雅降级。
    - 测试：`scripts/verify-byok.mjs`（puppeteer 请求拦截模拟 OPTIONS 预检 + 200/500）。

### 文档库
12. 文档问答/分支卡片改用 `generateReply`（划词问任意术语都得到词典/知识树讲解，不再是"未收录"占位）。

### 欢迎页
13. 标题改为 Bruno Ace 品牌绿大字 + 光晕；「?」按钮改为载入示例项目。

### 术语卡片布局（R8 续，用户指定）
14. **居中 + 向下级联**：卡片从"右侧锚定"改为**页面居中**（`left-1/2 top-1/2 translate(-50%,-50%)`，尺寸 `w-[85%]/70% × min(680px, calc(100%-96px))`）。
15. 每深一层向右下偏移 **+8px / +16px**（`translate(calc(-50%+8i px), calc(-50%+16i px))`），像桌面窗口级联，底层卡片的顶边露出来；每层自带 `bg-card-floating`（不透明，防文本重叠）+ 边框阴影。
16. 进场 = `card-enter-cascade`（淡入 + 上浮 26px + 缩放 0.97→1，320ms，偏移走 CSS 变量 `--cx/--cy`）；退场 = `exiting-cascade`（纯淡出 280ms）。
17. **交互（用户指定）**：去掉头部左上"返回上一层"箭头；右上 ✕ = **只关当前这一张卡**（连同其上层一起弹出，露出下面那张，可逐层关完）。
18. 测试：`scripts/verify-cascade.mjs`（居中+级联+不透明）、`scripts/verify-popclose.mjs`（逐层关闭+无返回箭头）。

### 知识库内容扩充（R8 续）
19. **TERM_TREE 从"仅量子物理 5 根"扩到 3 大领域 8 根**：新增「机器学习」（监督学习/神经网络/深度学习，含感知机/反向传播→梯度消失/CNN/Transformer→注意力机制）、「算法与数据结构」（时间复杂度→大O/P与NP、排序→快排/归并、哈希表→冲突）、「数学基础」（线性代数→特征向量、概率论→贝叶斯定理/大数定律、微积分→梯度）。共约 +26 个节点、最深 4 层。
20. **GLOSSARY 从 35 → 60 条**：新增监督学习/分类/决策树/随机森林/损失函数/学习率/幻觉/提示词工程/思维链/RAG/导数/向量/矩阵/方差/中心极限定理/递归/动态规划/栈/二叉树/快排/哈希表等。
21. 内容自动流入 `generateReply`（术语命中+相关概念）与文档划词高亮（detectTerms），无需改组件逻辑。测试：`scripts/verify-content.mjs`。

### 常驻聊天（R8 续）
22. **常驻聊天从"死按钮"变为真功能**：固定项目（id=`resident`，`ChatProject.resident` 标记），首次启动自动创建；点击侧边栏"常驻聊天"行进入（选中高亮），消息跨项目保留；不出现在"本地项目"列表、不可删除（context `deleteProject` 守卫 + 卡片菜单隐藏"删除"）；发消息后侧边栏自动折叠不影响（折叠态显示图标）。
23. 测试：`scripts/verify-resident.mjs`（打开/发送/跨项目持久/列表排除/删除隐藏）。

### BYOK 流式 SSE + 相关概念同域（R8 续²，2026-08-14）
24. **BYOK 升级为流式**：`streamOpenAICompatible`（`app-context.tsx`）以 `stream: true` 请求并解析 SSE（`data:` 行 -> `choices[0].delta.content`，`[DONE]` 结束，心跳/半包静默跳过），逐 delta 直写 assistant 消息。少数网关忽略 stream 仍回整段 JSON -> 按整体输出兜底。超时改为**首增量 15s**（出字后不再限时，流可能很长）。
25. **流式中断优雅降级**：已收到部分内容时保留原文，续打字机补离线回复（`> ⚠️ BYOK 流式中断…`）；一个字都没收到才整段回退（`streamReply` 增加 `append`/`prefix` 选项，拆出 `appendAssistantMessage` + `setLastAssistantContent` 供打字机/SSE 共用）。
26. **相关概念同域修复**（`mock.ts`）：原 treeHit 分支的「相关概念」写死取 `GLOSSARY.slice(0,3)`（前 3 条全是量子物理词）--问「梯度下降」会在相关概念里列「量子纠缠」。修复：优先词典邻近词（同域聚类），否则取树内兄弟节点；不再列术语自身。
27. `verify-byok.mjs` 改为拦截 SSE 响应（校验 `stream:true` + 流式渲染 + 失败回退）；`verify-termstack.mjs` 更新到居中级联新结构（`.card-container` 平铺兄弟 + `--cx/--cy` 偏移，旧的 `inset-0` 断言已过时）。

### UX 细节（R8 续³，2026-08-14）
28. **轮次标题去重**：单轮次对话隐藏轮次大标题（卡片顶部 + 消息气泡已足够），多轮次/分支时保留用于定位。测试：`scripts/verify-turntitle.mjs`。
29. **文档删除键常显**：文档库卡片删除键从"悬停才显示"改为常显；阅读页工具栏新增删除键（删完自动回文档库）。测试：`scripts/verify-docdelete.mjs`（fixture：`scripts/fixtures/ml-notes.md`）。
30. **文档库可退出**：库工具栏新增"返回聊天"按钮（`setActiveDocId(null)`）——此前点进文档库就出不来；侧边栏"本地文档"旁的 **+ 改为直接上传文档**（侧边栏自带隐藏 file input + 解析，上传后进入文档库）。测试：`scripts/verify-library.mjs`。
31. **侧边栏字体统一**：本地文档/常驻聊天/本地项目/文件夹名全部统一为 `text-sm font-medium`（原 12px/14px 混排）。

### AI 对话完善（R8 续⁴，2026-08-14，用户将接入真实 API）
32. **模型列表清洗**：8 个真实、无重复的模型（DeepSeek Chat/Reasoner、GPT-4o、Claude Sonnet、Gemini 2.5 Flash、Qwen-Max、GLM-4、Kimi K2），替换原虚拟名（deepseek-v4-flash-0731 等重复/过时名）；`DEFAULT_SETTINGS.activeModelId` 同步更新。用户接入 API 时按 BYOK 流程映射即可。
33. **离线回复上下文记忆**：`generateReply(question, history?)` 新增历史参数；未命中新术语但像是追问（短句或以"那/它/继续/为什么…"开头）时，从历史里找**正在讨论的话题**（取消息中出现位置最早的术语，避免被"相关概念"词抢走；词典词兜底）续写回复。离线路径与 BYOK 失败回退均传最近 12 条历史。测试：`scripts/verify-chat.mjs`（模型列表 + 追问接话题）。

### 卡片内对话（R8 续⁵，核心需求补齐）
34. **卡片就是对话**：术语卡片从"静态说明卡"改为**可对话卡片**——卡片底部有输入条（Enter 发送），在卡片里向 AI 提问，回复直接写进该卡片（用户气泡 + AI markdown）。这是产品的核心交互："点进卡片 = 在这个概念里和 AI 继续对话"。
35. **卡内回复可继续深挖**：卡片摘要与卡内回复里的 **加粗术语** 都是可点击按钮 → 开子卡片（继承深挖路径 `根 → … → 本卡`，路径作为上下文传给 AI）。旧的"显式子概念列表"已移除（加粗术语点击即深挖，↗️/➡️/⬇️ 类型由术语树数据决定）。
36. **卡内问答双通道**：BYOK 激活时走真实流式 API（复用 `streamOpenAICompatible`，上下文含术语+路径+卡内历史），失败回退离线；离线走 `generateReply`（带卡内上下文，打字机写入）。回复期间卡内输入禁用 + 呼吸光标 + 自动滚底。
37. **模型体系重构**：内置模型列表移除（用户用不到的摆设）→ 唯一内置是 **「离线知识库」**（id=`offline`）；`MODEL_PRESETS`（7 个 OpenAI 兼容预设：DeepSeek×2/GPT-4o/Gemini/Qwen/GLM/Kimi）在 BYOK 表单一键填充地址+模型 ID；模型选择器 = 离线知识库 + 用户 BYOK 模型；`genericTermSummary` 文案更新（不再提"接入 BYOK 后才能解释"）。
38. **回复提速**：离线延迟 1200→500ms，打字机步长 12→16 字/帧。测试：`scripts/verify-cardchat.mjs`（选择器/卡片输入/卡内回复/卡内深挖）。

### 轮次探索路径 + 思维宇宙真实连线（R8 续⁶，2026-08-14，用户需求）
39. **轮次探索路径**：`Turn.explored`（`{term, kind, at, parentTerm}`）按轮次记录点开的术语卡片。`recordExploration(turnId, term, kind, parentTerm)`（`app-context.tsx`，按 turn id 全局定位项目，不依赖 activeProjectId）；主对话点词条、卡内点词条都会记入来源轮次；**分支卡片另起炉灶**时新 turn 的路径自动以该分支术语起步（`appendTurn` 现在返回 turn id，`openBranchTurn` 接着记录）。
40. **探索路径链 UI**（`chat-card.tsx`）：轮次底部"🧭 本轮探索路径"chips——`explorationChains` 按 `parentTerm` 把扁平记录重组为链条（根 → ➡️ 关联 → ↗️ 子卡片，每条链一个根）；点击 chip 重开卡片（`reopenFromTrail`，`record:false` 不重复记录、不打乱链条）。
41. **思维宇宙只连真实关系**（`mind-universe.tsx`）：`buildRelationEdges` 替换原贪心最近邻连线——只有 `parentSubject` 真实父子关系才画线，父术语不在可见节点里则不连（不再误导用户）；线透明度 0.15→0.3（线少了更醒目）。详情浮层新增**连接链**（根 → … → 本节点，可沿链跳转）；思维宇宙面板节点卡显示"🔗 深挖自「父术语」"；卡内收录时 `addThoughtNode(..., parentSubject)` 传父卡术语（`chat-card.tsx` handleCollect 改收整个 StackItem）。
42. Canvas 加 `gl={{ preserveDrawingBuffer: true }}`（供像素级验证 + 未来截图功能）。测试：`scripts/verify-exploration.mjs`（路径记录/链条箭头/收录父术语/重开不重复/分支继承/面板深挖自）、`scripts/verify-universe.mjs`（种子 3 节点 → 读 GL 帧缓冲：3 节点定位 + 沿节点对连线采样——仅 A–B 有连线像素 + 点击节点弹连接链且不含无关节点）。

### 借鉴原站「应用介绍」（R8 续⁷，2026-08-14，用户指定）
原站 /chat 的 How to Use 介绍（已用 puppeteer 抓取）核心要点：摆脱线性聊天框/多层级对话、智能标注（点击**带下划线**文字）、层级对话 ↗→↓ 语义（下游卡片读取上游卡片标题）、分支卡片继承"主题 + 分支点之前的对话历史"、文档阅读、思维宇宙、**选中 AI 回复文本引用（支持多条）**、个性化。本轮落地：
43. **智能标注**：可点击术语从"仅加粗"改为**加粗 + 下划线**（`underline decoration-brand/50`，主对话与卡内两处 `term-chip`）。
44. **全局「使用指南」弹窗**：`modals.guide` 新增 `GuideModal`（`modals.tsx`，中文版 9 条核心特性 + 原站开篇定位语）；欢迎页/聊天空态"使用指南"按钮、欢迎页"查看完整引导"全部改开指南（原开设置向导）；欢迎页 tagline 加"摆脱线性聊天框…"；FEATURES 文案改为与实际功能一致的准确描述（智能总结→探索路径）。
45. **引用回答（上下文管理）**：AI 回复区可选中文本（去掉 `select-none`）→ 浮动"引用"按钮 → `pendingQuote`（AppContext）→ 输入框上方引用 chips（多条、可删）→ 发送时以 `> …` 引用行并入消息；自动标题剥掉引用行。
46. **分支卡片继承上游历史**：`openBranchTurn(title, history)` 不再静态贴摘要——继承上游卡片主题 + 分支点之前卡内对话历史（含深挖路径节点），AI 回复走 `deliverReply` 双通道（BYOK 真实 API / 离线回退）。测试：`scripts/verify-borrow.mjs`（欢迎文案/指南弹窗/下划线/引用全流程/BYOK 拦截断言分支请求体含上游卡内历史）。

### 未读指示 + 收藏区智能摘要 + UI 调教（R8 续⁸，2026-08-14，用户指定收尾）
47. **轮次未读指示 + 右键切换**（原站"卡片树导航未读指示"）：`Turn.unread`；新回复完成时若目标轮次不在视野内（用户上滚阅读）→ 自动标未读；轮次导航节点显示品牌绿圆点，**右键手动切换**（导航面板顶部有提示文案）；点击节点/收藏区跳转自动清除。配套：流式期间自动滚底改为"仅在已接近底部时跟随"（用户上滚不再被拉回，未读判定才有意义）。
48. **收藏区**：轮次时间戳行新增 ⭐ 收藏按钮；侧边栏新增「收藏」分组（跨项目聚合，显示项目名+轮次名，点击跳转 `focusTurn`（切项目 + `focusRequest` 滚动定位 + 清未读），⛌ 取消收藏）。
49. **智能摘要**（原站"收藏区智能摘要"）：收藏行 ✨ 按钮 → `summarizeTurn`：BYOK 激活走真实 API 流式生成要点，否则本地启发式摘要（主题/消息数/核心问题/涉及术语/时间，`heuristicSummary`，术语来自 TERM_TREE+GLOSSARY 扫描）；摘要内联展示在收藏行下方，生成中显示加载态。
50. **UI 调教**：术语卡头部新增第二行「🧭 深挖路径」面包屑（主线始终清晰）；轮次容器边框 2px 实线 → 1px 柔和（`border border-std/80` + rounded-xl）；导航节点加收藏星标与未读圆点；全局 `::selection` 品牌绿淡染（配合引用回答）；收藏行/摘要/导航 hover 态统一。
51. 测试：`scripts/verify-fav-unread.mjs`（收藏行/摘要内容/右键切换/收藏跳转清未读/滚动离开时自动未读/卡片路径面包屑）。

### 轮次有向图 + 收藏区常驻 + 探索路径放大（R8 续⁹，2026-08-14，用户反馈）
52. **轮次导航升级为有向图**：新组件 `turn-graph.tsx`（SVG）——行 = 轮次时间序，列 = 分支深度；边 = `parentTurnId`（分支来源，`Turn.parentTurnId` 新增，`openBranchTurn` 第三参 `sourceTurnId`）?? 顺序上一轮，带箭头 marker。点击节点跳转、右键切换已读/未读、绿点未读、⭐ 收藏、悬停高亮。侧边折叠按钮改为更显眼的「轮次图」竖排文字 + GitBranch 图标 pill；面板 240→300px，标题"轮次导航图 · 有向图 · 点击节点跳转 · 右键切换已读/未读"。
53. **收藏区常驻可见**：侧边栏「收藏」分组不再只在有收藏时出现——无收藏时显示引导文案（"在轮次右上角点 ⭐ 收藏…"）。
54. **探索路径放大**：轮次内探索路径从细分割线小字升级为独立卡片块（`rounded-xl border-brand/20 bg-brand/[0.05] p-3.5`，标题行 + 更大 chips（text-[13px] + 悬浮放大）+ 醒目箭头，chip title 显示卡片类型徽章）。
55. 测试更新：`verify-fav-unread.mjs`（图节点右键/自动未读）、`verify-borrow.mjs` 新增 D4（parentTurnId 持久化 + 图节点 3/边 2 渲染断言）。

### 轮次图常驻 + 卡片入图 + 收藏区挪底 + 侧边栏换序（R8 续¹⁰，2026-08-14，用户反馈）
56. **轮次导航图右侧常驻**：从"折叠条 + 开关"改为 shell 右侧**常驻面板**（flex 布局列 `hidden lg:flex w-[270px]`，`TurnGraphPanel`，不再需要点击展开；文档阅读模式显示提示）。旧 rail 开关与 `navOpen` 移除；面板提示保留"点击跳转 · 右键切换未读"。
57. **术语卡片入图（重点借鉴原站卡片树）**：`TurnGraph` 在轮次节点之外渲染**卡片节点**——来自 `Turn.explored` 探索链条：↗️ 子卡片向右分支、➡️ 关联卡片向左分支、⬇️ 分支卡片向右（每条链从所属轮次出发、沿 parentTerm 连续分支）；点击卡片节点经 `cardOpenRequest`（AppContext 新增）重新打开该卡片（不重复记录）；`explorationChains` 上移到 `turn-graph.tsx` 供 chat-card 与图共用。
58. **收藏区挪到侧边栏底部**：与设置同款大按钮格式（Star 图标块 + 「收藏」+ 计数徽章 + 展开箭头，`favOpen` 默认展开），列表在设置之上；空态引导文案保留。轮次 ⭐ 按钮加大为带边框圆钮（更易发现）。
59. **侧边栏换序**：常驻聊天移到本地文档之上（折叠态同样：常驻图标 → 文档图标），符合"先聊天后资料"的逻辑。
60. 测试：`verify-ui-fixes.mjs` 重写 1a/1b（常驻面板可见 + 无旧开关）+ 侧边栏顺序断言；`verify-features.mjs` 移除旧开关步骤；`verify-borrow.mjs` D4 断言卡片节点（玻姆诠释）入图；`verify-fav-unread.mjs` 面板免开关 + 0 号面板可见断言。

### 轮次图改为卡片树样式（R8 续¹¹，2026-08-14，用户反馈）
61. **轮次导航图回到对话框右侧、思维宇宙与对话框之间**：撤销 shell 最右侧整列（`<aside>` 移除），改为 ChatCard 内**停靠面板**（`absolute right-0 top-[52px] bottom-4 w-[232px]` 圆角卡片 `bg-card-floating/95 border-std shadow-card`，z-14 在术语卡片之下）；聊天滚动区右留白 `lg:pr-[248px]` 防止文字被面板遮挡；无轮次/最小化时隐藏。面板样式：GitBranch 图标标题栏 + "有向图 · 点击节点跳转 · 右键切换未读" + 底部图例（↗️ 子卡片 / ➡️ 关联卡片 / ⬇️ 分支）。
62. **收藏区空态文案移除**：底部收藏按钮无收藏时不显示引导文案与展开箭头，**点击 ⭐ 收藏后列表才出现**（计数徽章同时出现）。
63. **轮次图去框架**（2026-08-14，用户反馈）：`TurnGraphPanel` 去掉卡片边框/标题栏/图例，只保留透明 SVG 有向图直接浮在页面背景上（容器 `absolute right-0 top-[52px] bottom-4 w-[232px]` 无背景无边框，悬停 title 提示"点击节点跳转 · 右键切换已读/未读"）；聊天区右留白保留。测试同步改为只断言图节点（不再查面板文案）。
64. **轮次图排版重做 + 居中偏下**（用户反馈"杂乱/不要放上面"）：容器改为 `absolute right-0 top-[55%] -translate-y-1/2 w-[232px] max-h-[62%]`（垂直居中偏下，超出可滚动）；布局重排——行距 62→88px（防重叠）、主干列固定左 90px、关联卡片向左分支/子与分支卡片向右分支（根偏移 64px、逐层 56px）、轮次间改细直线箭头、卡片分支平滑弧线（向左分支虚线区分）、卡片图标移入圆内、标签截断缩短（轮次 7 字/卡片 5 字）。测试：`verify-borrow` 边断言改为 `svg [marker-end]`（含 line 元素）。
65. **节点文字悬停浮现**（用户反馈）：图内不再常显文字——轮次/卡片只显示圆球（卡片圆内含方向图标、未读绿点常显），**鼠标悬停节点时文字标签 + ⭐ 收藏标记 150ms 淡入**（`group-hover:opacity-100`），悬停同时球体高亮填充；热区调整（轮次整行 / 卡片局部），点击跳转、右键切换未读不变。

## 三、R8 关键 bug 修复

| bug | 根因 | 修复 |
|---|---|---|
| 术语卡片位置错+关不掉 | 居中动画用在右锚定卡片 | 新增右锚定进出场动画 |
| 轮次导航关不掉 | 面板(z-10)盖住开关按钮 | 开关按钮 `relative z-20` |
| 卡片重命名"看不见" | 头部显示轮次标题、重命名的是项目 | 头部改显项目标题 + 自动标题 |
| **桌面端侧边栏完全点不动** | 侧边栏 `sm:z-auto`，主内容列 `relative z-10` 在 DOM 后 → 主内容盖住侧边栏 | 侧边栏保持 `z-40` |
| 全站文字是绿色 | shadcn `--primary: var(--brand)` 使 `text-primary` 变绿 | `@theme inline` 覆盖 `--color-primary: var(--text-primary)` |

> 教训：用 `.click()`（绕过命中检测）测不出"元素被盖住"类问题；必须用真实鼠标事件（`page.mouse.click`）或 `document.elementFromPoint` 验证。

## 四、验证脚本（scripts/，全部可复用）

| 脚本 | 用途 |
|---|---|
| `qa-pixel.mjs` | 像素级 diff（8 场景，需 Edge） |
| `qa-local.mjs` | 结构化 + 交互冒烟测试 |
| `analyze-diff.mjs` / `row-profile.mjs` / `font-check.cjs` | diff/布局分析工具 |
| `verify-term-card.mjs` | 术语卡片位置+关闭 |
| `verify-cascade.mjs` | 居中级联布局+不透明+逐层关闭 |
| `verify-popclose.mjs` | 逐层关闭+无返回箭头 |
| `verify-sidebar.mjs` | 重命名/建文件夹/智能模式 |
| `verify-features.mjs` | 上下文回复/轮次导航/BYOK |
| `verify-ui-fixes.mjs` | 轮次导航开关/FAB 开关/订阅 UI 移除 |
| `verify-polish.mjs` | 流式输出/退场动画/头部重命名/设置精简/欢迎页 |
| `verify-byok.mjs` | BYOK 真实调用（SSE 拦截模拟 200/500/中断） |
| `verify-content.mjs` | 知识库扩充回复+深挖 |
| `verify-resident.mjs` | 常驻聊天（打开/持久/列表排除/删除隐藏） |
| `verify-turntitle.mjs` | 轮次标题去重 |
| `verify-docdelete.mjs` | 文档删除键（库+阅读页） |
| `verify-library.mjs` | 库返回按钮/侧边栏加号上传/字体统一 |
| `verify-exploration.mjs` | 轮次探索路径（记录/链条/收录父术语/重开不重复/分支继承） |
| `verify-universe.mjs` | 思维宇宙真实连线（GL 像素分析 + 连接链浮层） |
| `verify-borrow.mjs` | 借鉴原站介绍（指南弹窗/术语下划线/引用回答/分支继承历史） |
| `verify-fav-unread.mjs` | 收藏区/智能摘要/未读圆点右键切换/自动未读/路径面包屑 |

**所有脚本运行需 `danger-full-access`**（puppeteer 启动 Edge 会触发文件沙箱的 spawn EPERM）。

## 五、当前像素 diff 快照（2026-08-14，BYOK 流式 + 相关概念同域后）

| 场景 | diff% |
|---|---|
| d-welcome | 4.15% |
| d-welcome-main | 5.22% |
| d-settings | 6.19% |
| d-newproj | 6.56% |
| d-chat | 6.79% |
| d-chat-reply | 9.41% |
| m-main | 4.17% |
| m-fab | 5.86% |

## 六、剩余已知差距（下一步候选，按价值排序）

1. **右侧思维宇宙面板**——⚠️ 已实测：原站所有截图里右侧 225px 区域是**纯背景**（DOM 有面板但视觉为空），克隆保持"20px 折叠条"反而更贴近；若要默认展开面板是 UX 取舍，会牺牲像素 diff。
2. **卡片/设置面板内容向原站像素级对齐**（中文文案是刻意保留，不会到 0%）。
3. **文档库划词提问体验**（划词浮条目前固定在底部，可改为跟随选区）。
4. **卡片进出场动画**——已接进入场+关闭退场；"返回上一层/分支"的中间态动画未接。
5. **移动端细节**——用户明确"移动端最后做，个人用不常用"。

## 七、命令速查

| 用途 | 命令 |
|---|---|
| dev server | `npm run dev`（localhost:3000） |
| 类型检查 | `npx tsc --noEmit` |
| 生产构建 | `npm run build` |
| 像素 diff | `node scripts/qa-pixel.mjs [scene...]` |
| 功能验证 | `node scripts/verify-*.mjs` |
