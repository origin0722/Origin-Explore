# 06 — MindscapePanel（思维宇宙面板：节点列表 + 添加理解 + 3D 入口）

文件: `src/components/sites/ai-explore-poker-820d0558/mindscape-panel.tsx`（"use client"，导出 `MindscapePanel`）
3D 场景是独立组件 `MindUniverse`（09-minduniverse.md），面板负责列表/验证/入口。

## props
`{ thoughts?: ThoughtNode[]; onClose?: () => void }` — thoughts 缺省从 useApp().thoughtNodes 取（有就覆盖, 无则用 context）

## 结构
```
桌面（h-full w-full flex flex-col）:
├─ 头部: px-4 py-3 flex items-center justify-between border-b border-divider
│    <h3 className="text-sm font-semibold text-text-header-secondary">思维宇宙</h3>
│    <button "进入 3D 宇宙"（Sparkles size 14 + text-xs text-brand border border-brand/40 rounded-full px-2.5 py-1 hover:bg-brand/10）
│      → useApp().setUniverseOpen(true)>
│    {移动端 && 关闭 X size 16}
├─ 节点区（flex-1 overflow-y-auto scrollbar-card-std px-3 py-2 space-y-2）:
│   nodes.map（pending 排前, 其他按时间倒序）:
│   <div className="bg-card-std rounded-xl border border-std p-3">
│     <div className="flex items-center justify-between gap-2">
│       <span className="text-sm font-semibold truncate">{subject}</span>
│       <span 状态徽章 text-[10px] rounded-full px-1.5 py-0.5>
│         pending: "待验证" bg-btn-std text-text-tertiary / validated: "已验证" bg-brand/15 text-brand</span>
│     </div>
│     <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{content}</p>
│     <div className="flex items-center justify-between mt-2">
│       <span className="text-[10px] text-text-quaternary">{时间}</span>
│       <div className="flex gap-1">
│         {pending && <button "验证" text-[10px] text-brand hover:underline onClick={validate(id)}>}
│         <button 删除 Trash2 size 12 text-text-quaternary hover:text-destructive onClick={remove(id)}>
│       </div>
│     </div>
│   </div>
│   空态（无节点）: BrainCircuit size 28 text-brand + MINDSCAPE_EMPTY.paragraphs（text-xs text-text-tertiary leading-5, 居中）
│   验证动画: 点击"验证" → 卡片内显示 "AI 验证中…"（Loader2 animate-spin size 12 + text-xs text-text-tertiary）1.2s
│     → useApp().validateThoughtNode(id) + toast"✓ 验证通过, 节点已点亮"（自实现小型 toast 或复用现有）
│     （mock: 小于 6 字的内容在"验证中"后显示"内容太短, 验证失败" — 可删）
├─ 添加理解区（border-t border-divider p-3）:
│   <textarea rows={2} className="w-full bg-inputarea border border-std rounded-xl px-3 py-2 text-sm resize-none outline-none
│                   focus:border-brand/50 placeholder:text-text-quaternary scrollbar-inputarea"
│             placeholder="描述你对某个概念的理解…"/>
│   <div className="flex items-center justify-end gap-2 mt-2">
│     <button "验证并添加"（bg-brand text-black text-sm font-medium rounded-full px-4 py-1.5 disabled:opacity-40）
│       disabled={!input.trim()||validating} onClick={submit}>
│   </div>
│   submit: 1.2s validating（按钮内 Loader2 animate-spin）→ addThoughtNode(subject=首词(≤12字), content=全文) + toast"已收录, AI 验证通过"
│   （mock 验证失败规则: 内容 < 8 字 → 显示失败 toast, 不添加）

移动端: fixed inset-0 z-40 bg-bg/95 backdrop-blur-sm + X 关闭（同原实现, 保留）
```

## 行为
- 桌面由 shell 渲染（225px 容器）; 移动端由 FAB 触发, 面板自身全屏
- 时间格式: 今天 HH:mm, 否则 M/D
- 中文文案; 像素级贴近原站空态截图 state-mobfab.png / state-mindscape*.png（若只有空态, 以空态为准）

## 参考
- PAGE_TOPOLOGY §6；截图 state-mobfab.png
