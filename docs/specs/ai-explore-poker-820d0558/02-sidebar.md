# 02 — Sidebar（左侧边栏 + 账户区 + 本地文档分组）

文件: `src/components/sites/ai-explore-poker-820d0558/sidebar.tsx`（"use client"，导出 `Sidebar`）
状态全走 useApp()（无 props）: projects/activeProjectId/selectProject/deleteProject/createProject/collapsed/toggleSidebar/openModal/profile/setActiveDocId

## 结构（桌面 225px 展开态）
```
<aside className="h-full flex flex-col text-primary relative z-10 bg-transparent" style={{width}}>
  ├─ 顶部功能按钮区（p-4, space-y-2）— 4 个按钮行:
  │   每个: <button className="group relative flex items-center transition-all rounded-lg shadow-card overflow-hidden w-full">
  │         <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow"> <Icon size={24}/> </span>
  │         {!collapsed && <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3"> 文案 </span>}
  │   ├─ Toggle Sidebar — PanelLeftClose → onToggle
  │   ├─ 新建文件夹    — FolderPlus → toast"文件夹分组（演示）"
  │   ├─ 新建项目      — Plus → createProject()
  │   └─ 导入项目      — Upload → toast"导入项目（演示）"
  │   （"文档阅读"按钮已移除 —— 文档库改为下方分组）
  ├─ 本地文档分组（常驻）:
  │   分组头: [BookOpen size 14] "本地文档"（text-xs text-text-tertiary font-medium px-4 pt-4 pb-1 flex items-center justify-between）
  │     + 右侧 + 按钮（w-6 h-6 rounded-full bg-btn-control hover:bg-btn-control-hover flex items-center justify-center, Plus size 14）
  │     → 触发主区切换文档库视图: setActiveDocId(null) + openModal? 不需要 —— 用 useApp().openDocLibrary()? 否:
  │     约定: 点击分组头/打开按钮 → setActiveDocId("__library__")（文档库视图; 由 shell 处理视图切换）
  │   文档行（documents.map）: <button className="w-full flex items-center gap-2 px-4 py-1.5 rounded-lg hover:bg-item-std-hover text-sm text-text-secondary truncate">
  │     [FileText size 14 text-text-tertiary] {name}（truncate）
  │     点击 → setActiveDocId(doc.id)（主区切到阅读器）
  ├─ 项目滚动区（flex-1 overflow-y-auto scrollbar-card-std, w-full max-w-xs self-center）:
  │  ├─ 常驻聊天行（圆角行 bg-item-std 悬停, 左 18px 图标 + 名称 text-sm + 右侧两个 13px 小图标:
  │  │   MessageSquare 高亮(bg-card-floating) / Sparkles; 点击 → selectProject(常驻聊天项目?? 无 → toast"常驻聊天（演示）")）
  │  ├─ 分组头: 本地项目（ChevronRight 旋转开合 + Folder 图标 + text-xs text-text-tertiary font-medium）
  │  │   └─ 项目行: <button className="group p-1.5 rounded-xl relative border-2 border-transparent hover:bg-item-std-hover w-full"
  │  │               选中: border-brand/40 bg-item-std>
  │  │       [左 24px 圆按钮: ChevronRight/FolderTree, active 高亮] <span className="block w-full min-w-0 truncate text-sm"> 项目名 </span>
  │  │       [右 24px 圆按钮: MoreHorizontal → 菜单 删除/重命名(演示)] — 删除调 deleteProject
  │  │   文件夹 "doc" 的项目（文档问答自动建的"论文：xxx"）显示文件夹图标 + 归入"本地文档"感（只读列表, 不单独分组, 标题前 FolderTree 图标）
  │  └─ 分组头: 云端项目（同构, 右侧 "仅会员" pill: text-xs text-text-tertiary border border-std rounded px-1.5 py-0.5）— 空态 "暂无"
  └─ 底部固定区（mt-auto p-4 py-6 space-y-2）:
     ├─ 设置 — Settings 图标 + "设置" → openModal('settings')
     └─ 账户 — profile ? 头像+昵称 : 空圈+“账户” → openModal('login')
         头像: <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
                  style={{background: profile.avatarColor}}>{profile.name[0]}</span> + 昵称 text-sm
</aside>
```

## 行为
- collapsed（56px）: 隐藏全部文字/小按钮/pill, 按钮保持 44×44 图标块, 分组头只剩图标
- 图标: PanelLeftClose, FolderPlus, Plus, Upload, MessageSquare, Sparkles, ChevronRight, MoreHorizontal, Settings, User, Folder, BookOpen, FileText, Cloud
- 演示 toast: 自实现（fixed 底部居中, 1.8s 自动消失）—— sidebar 内部已有, 保留
- 中文文案, 像素级贴近原站截图 state-newproj1.png / state-sidebar*.png

## 参考
- PAGE_TOPOLOGY §2；截图 state-newproj1.png（Untitled 项目行）
