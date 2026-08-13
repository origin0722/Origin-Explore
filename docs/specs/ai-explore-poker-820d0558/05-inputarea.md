# 05 — InputArea（聊天输入区）

文件: `src/components/sites/ai-explore-poker-820d0558/input-area.tsx`（"use client"）

## 结构（桌面, 底部居中, 最大宽 900）
```
<div className="absolute left-0 bottom-0 z-20 w-full flex justify-center px-4 pb-4">
  <div className="relative bg-inputarea shadow-card border-2 border-std rounded-[28px] p-3 flex flex-col gap-1 w-full max-w-[900px] transition-colors focus-within:border-brand/50">
    ├─ 第一行（flex items-end gap-2）:
    │  ├─ 模型选择器:
    │  │   <button className="flex items-center justify-between gap-1 text-sm bg-btn-selector shadow-selector rounded-full px-3 h-8 min-w-0 max-w-[220px]">
    │  │     <span className="flex items-center gap-1.5 min-w-0 select-none">
    │  │       <Zap size={13} className="text-content-brand flex-shrink-0"/>
    │  │       <span className="truncate">{当前模型名}</span></span>
    │  │     <ChevronDown size={14} className="text-text-tertiary flex-shrink-0"/></button>
    │  │   点击 → 下方弹出模型列表（同 Settings AI Models 面板, 见 07-modals.md）: 选择后更新 settings.activeModelId
    │  ├─ 工具按钮: <button className="h-[34px] w-[34px] rounded-full bg-btn-inputarea-transparent-hover hover:bg-btn-inputarea-transparent-hover/20
    │  │             flex items-center justify-center text-text-icon-secondary"><Paperclip size={16}/></button>
    │  │            （点击 → 提示"文档上传（演示）"）
    │  └─ textarea（flex-1, 自动增高, 最多 8 行）:
    │      <textarea className="block w-full bg-transparent scrollbar-inputarea text-primary text-base leading-6
    │                          resize-none outline-none placeholder:text-text-quaternary"
    │                placeholder="问点什么，开始你的探索…" rows={1}
    │                onChange={自增高: el.style.height='auto'; el.style.height=el.scrollHeight+'px'}/>
    │      发送快捷键: Ctrl+Enter（settings.sendShortcut 默认 ctrl-enter）
    └─ 底行（flex items-center justify-end gap-2, 发送按钮）:
       <button className="h-[34px] w-[34px] rounded-full bg-btn-inputarea text-black flex items-center justify-center
                          hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
               disabled={!text.trim() || busy}>
         <Send size={16} strokeWidth={2.5}/></button>
       发送中 busy → 按钮内换 Loader2 animate-spin（注意: 全局 streaming-border-spin 不与 Loader2 冲突）
</div>
```
- busy 时（AI 回复中）: 输入区边框动画 —— `.streaming-border-effect` + `streaming-border-spin`（给容器加
  `style={{background: 'linear-gradient(90deg, rgba(19,228,37,.25), rgba(19,228,37,.05)) border-box'}}` 简化实现; 或直接
  用 `border-brand/60` + 呼吸动画自定义, 构建者自由选择）

## 行为
- 发送: `sendMessage(text)`（shell context）→ 清空输入框、收起模型弹层
- 输入中 Enter（无 Ctrl）: 换行（textarea 默认）
- 移动端: 模型选择器只显示图标+名称 truncate, 按钮 32px, 底部 pb-2 贴安全区

## 参考
- PAGE_TOPOLOGY §5；截图 state-newproj1.png（完整输入区）
