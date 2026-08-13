# 04 — ChatCard（知识卡片：turn 列表 + 消息 + 递归术语树）

文件: `src/components/sites/ai-explore-poker-820d0558/chat-card.tsx`（"use client"，导出 `ChatCard`）
依赖: react-markdown（已装）、TERM_TREE / findTerm / genericTermSummary（mock.ts）、useApp()

## 结构（桌面: 居中大卡片）
```
<div className="bg-card-std text-primary rounded-[24px] shadow-card relative h-full w-full border border-std"
     style={{maxWidth: 900, height: 'calc(100% - 140px)', margin: '0 auto'}}>
  <div className="relative w-full h-full min-h-0 overflow-hidden rounded-[24px]">
    ├─ 头部（absolute top-0 inset-x-0, h-9, px-4 flex items-center justify-between border-b border-divider）:
    │   <span className="font-bold truncate pr-2 text-[15px]"> 标题 </span>
    │   3× <button className="w-9 h-9 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shadow-card">
    │      （Minimize2 收起 / Copy 复制对话 / MoreHorizontal 菜单: 重命名演示/删除）size 16
    ├─ 滚动区（absolute inset-0 overflow-y-auto scrollbar-card-std, pt-[52px] px-4 pb-6）:
    │   turns.map: <div className="flex flex-col gap-4 px-2 pb-2 rounded-lg relative border-2 border-turn-std mb-4">
    │     ├─ turn 头: h-14 text-lg font-semibold truncate text-text-turn-title（可点击 → 跳转）
    │     ├─ 时间戳: text-[11px] text-text-quaternary（en-US "MMM d, yyyy, HH:mm"）
    │     └─ messages.map:
    │        ├─ 用户气泡: bg-usermsg shadow-usermsg rounded-usermsg px-3 py-2 max-w-[90%] 右对齐 text-text-content whitespace-pre-wrap
    │        └─ AI: <div className="markdown-content w-full">react-markdown 渲染</div>
    └─ 右侧 turn 导航 rail（hidden sm:flex, absolute right-0 top-[52px] w-[20px]）: ChevronLeft 展开 240px turn 列表
  </div>
</div>
```

## 递归术语树（核心行为）
AI 消息中的 **\*\*加粗\*\*** 术语 = 可点击 chip。**点击 → 右侧展开术语卡（递归）**:
```
<TermCard node={findTerm(term)} /> 渲染于: absolute right-2 top-[52px] bottom-2 w-[70%] z-10
  bg-card-floating rounded-2xl border border-std shadow-card card-container entering-from-bottom（350ms）
  内部:
  ├─ 头部: [kind 徽章] + 术语名（text-lg font-bold）+ 右上: 收录按钮 + 关闭(X)
  │   kind 徽章: child=↗️子卡片 / related=➡️关联卡片 / branch=⬇️分支卡片（text-xs text-brand border border-brand/40 rounded-full px-2 py-0.5）
  ├─ 内容: <div className="markdown-content mind-md overflow-y-auto scrollbar-card-std">node.summary</div>
  │   （含 ```代码块``` 渲染 —— react-markdown 默认支持）
  └─ 子术语行（node.children 或 node 不存在时用 findTerm 兜底）:
      node.children?.map(child => <button className="term-chip">[kind 小图标] {child.term}</button>)
      点击 → 递归打开该子节点卡片（同一位置堆叠替换，带进入动画；维护 stack，可返回上一层）
      没有 children 的节点显示提示: "这个概念的展开已经到底了，试试把它收录进思维宇宙"
```
- **收录按钮**（每张术语卡右上, BookmarkPlus/Sparkles 图标 size 16, text-brand）: `addThoughtNode(term, node.summary)` + toast"已收录，待验证" + `markTermState(term, "mastered")`（已掌握）
- **分支卡片**（kind==="branch"）底部额外按钮: "⬇️ 另起炉灶 · 开新对话" → `openBranchTurn(term, node.summary)` → 以术语开新 turn
- 子卡片递归深度不限（数据树 3 层）；子卡片展开时原卡片可保持（分层堆叠, 新卡片盖在上层, z-index 递增, 可返回）
- busy 时 AI 消息尾部: `<span className="inline-block w-2 h-4 bg-brand animate-pulse"/>`
- 无 turns 空态: "还没有消息，从下面输入开始探索吧"（text-text-tertiary 居中）
- 时间戳: `new Date(ts).toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'})`
- 移动端: 卡片全宽、术语卡 w-[85%] 盖在卡片上方（fixed inset 样式自由）、turn 导航隐藏

## 参考
- TERM_TREE 结构: mock.ts（根节点术语 = MOCK_REPLY_MARKDOWN 里的加粗词）
- 原站截图 state-ce.png（用户气泡+turn 头）、state-subcard 系列
