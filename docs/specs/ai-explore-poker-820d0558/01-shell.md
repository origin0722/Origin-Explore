# 01 — Shell（状态容器 + 布局组装）

文件: `src/components/sites/ai-explore-poker-820d0558/app-context.tsx` + `shell.tsx`
最终由 `src/app/page.tsx` 渲染 `<AppShell/>`（Phase 4 组装时改 page.tsx）。

## AppContext（app-context.tsx）
`"use client"`。React Context + useState，导出:
```ts
interface AppState {
  settings: ChatSettings; setSettings(partial: Partial<ChatSettings>): void;
  projects: ChatProject[]; activeProjectId: string | null;
  createProject(): void;                 // 一键创建 "Untitled" 项目并激活
  deleteProject(id: string): void;
  collapsed: boolean; toggleSidebar(): void;   // 手动折叠/展开
  mindscapeOpen: boolean; setMindscapeOpen(v: boolean): void;
  modals: { settings: boolean; onboarding: boolean; subscribe: boolean; login: boolean };
  openModal(k: keyof AppState["modals"]): void; closeModal(k: keyof AppState["modals"]): void;
  turns: Turn[];                          // 当前激活项目的 turn 列表（无项目时 []）
  activeTurn: Turn | null;
  sendMessage(text: string): void;        // 追加用户消息 + 延迟 1.2s mock AI 回复(MOCK_REPLY_MARKDOWN)
  busy: boolean;                          // AI 回复中（输入区显示流式边框）
}
```
- 初始: settings=DEFAULT_SETTINGS, projects=[makeDemoProject()], activeProjectId=null（初始显示欢迎页）
- sendMessage: 无项目时先 createProject；turn 标题 = 首条消息前 18 字；AI 回复用 MOCK_REPLY_MARKDOWN（带 setTimeout）
- 布局响应: `window.matchMedia('(max-width: 640px)')` 监听，移动端 collapsed 视为抽屉（见 Shell）

## Shell（shell.tsx）— 布局骨架（桌面 1440）
```
<div className="fixed inset-0 flex bg-slate-900 overflow-hidden overscroll-none">
  <Sidebar collapsed={collapsed} onToggle={toggleSidebar} ... />   // 02
  <main className="relative flex-1 overflow-hidden">
    <canvas 铺底（装饰性, 可不画）/>
    {activeProject ? <ChatCard .../> : <WelcomeView .../>}          // 04 / 03
    <InputArea .../>                                                // 05（底部, 桌面 p-4 区域）
    {mindscapeOpen && <MindscapePanel .../>}                        // 06（右侧 225px 面板）
  </main>
  <Modals .../>                                                     // 07（所有弹窗）
</div>
```
- 侧边栏宽度: 展开 225px / 折叠 56px（宽度过渡 transition-all duration-200），主区随之变化
- **发消息后自动折叠侧边栏**（sendMessage 成功时若桌面宽度>640 且未折叠 → collapsed=true）
- 移动端(<640): 侧边栏 position fixed 在屏幕外(-100%)，汉堡/抽屉开关切换；主区全宽
- 背景 canvas: 可选装饰（径向渐变 + 微弱网格），保持深色 #101010 基调
- 底部 ICP 备案号横条（"沪ICP备2025147118号 · 沪公网安备31010102008430号"，12px text-text-quaternary 居中）——文案可自定
