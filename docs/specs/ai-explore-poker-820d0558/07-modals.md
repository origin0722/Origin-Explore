# 07 — Modals（设置 / 引导向导 / 本地档案）

文件: `src/components/sites/ai-explore-poker-820d0558/modals.tsx`（"use client"）
导出 3 个组件: `SettingsModal` / `OnboardingWizard` / `ProfileModal`
**已删除: SubscribeModal（个人工具无订阅）**。shell.tsx 若还 import 它会被我修，你不用管。

## 通用弹窗壳（复用）
```
<div className="fixed inset-0 bg-overlay-modal z-50 flex justify-center items-center" onMouseDown={背板关闭}>
  <div className="bg-modal-std rounded-3xl shadow-xl border-2 border-std" onMouseDown={stopPropagation}>...</div>
</div>
```
- onboarding z-[100]（盖住设置）; Escape 关闭; 挂载时 keydown 监听

## SettingsModal（75% 大弹窗; 移动端全屏）
```
左导航（1/4, border-r border-divider, p-4）: 7 项（AI 模型/模型分配/API 密钥/颜色主题/编辑权限/快捷键/自动行为）:
  选中 bg-item-std; li.p-2.rounded.text-primary.cursor-pointer + lucide 图标
右面板（3/4, p-6 overflow-y-auto）:
  ├─ 标题: h2.text-xl.font-bold "设置"（无语言面板! 仅中文）
  ├─ AI 模型面板: "可用模型" + "添加 BYOK 模型"（Plus 按钮, 点击 → toast"BYOK（演示）"）+ 免费档说明
  │   全部模型可选（无锁定! 无订阅跳转）: MODELS.map 行（bg-modal-floating border border-std rounded-xl p-3 px-4）
  │     名称 truncate + Vision 绿徽章 + tier/multiplier pill; 点击 → setSettings({activeModelId}) + "使用中"高亮（bg-item-std-active + Check）
  ├─ 颜色主题面板: THEMES.map（{id,name}）radio 行（选中 bg-item-std-active + 品牌色圆点 + accent-brand）→ setSettings({theme})
  │   未实现的主题（!isThemeImplemented(name)）行尾加小字 "待实现"（仍可选, 效果=默认主题）
  ├─ 自动行为面板: 开关行（autoCitation/isWebSearchEnabled/autoTitle, Switch 风格: bg-brand/disabled） + 说明
  └─ 编辑权限/快捷键/API 密钥: 简单占位面板（一行说明文字 + 可编辑 input 演示）
底部: 保存按钮（右对齐 bg-brand text-black font-bold rounded-full px-5 py-2 "保存"）→ closeModal('settings')
```

## OnboardingWizard（2 步, z-[100], w-[90%] max-w-[500px] h-[400px] 居中）
```
步1（step===0）: "选择主题颜色" + THEMES radio 列表（name="setup_theme", accent-brand, overflow-y-auto scrollbar-card-neon）
步2（step===1）: "个人信息" — 昵称 input + 邮箱 input（bg-inputarea border border-std rounded-xl px-4 py-2.5 focus:border-brand/50）
  + 头像色选择（5 个色圆点 radio: #13e425/#4d9fff/#ffb84d/#e4e4e4/#ff6b6b）
底部 2 个步骤点（当前 bg-brand 其他 bg-btn-std）; 左下 ChevronLeft / 右下 ChevronRight（w-12 h-12 bg-btn-std rounded-full）
完成（步2右下 Check 绿圆按钮 w-12 h-12 bg-brand）→ setSettings({theme}) + setProfile({name, email, avatarColor}) +
  localStorage.setItem('explore-onboarded','1') + closeModal('onboarding')
右上角 "跳过"（text-xs text-text-tertiary）→ 仅写 localStorage + 关闭
```

## ProfileModal（本地档案 = 个人工具的"登录"）
```
w-[90%] max-w-[400px] 居中:
  未登录态:
  ├─ <h1 className="font-bruno-ace text-3xl text-brand shadow-brand">Explore</h1>
  ├─ <h2 className="text-xl font-bold mt-4">欢迎回来</h2>
  ├─ <p className="text-sm text-text-tertiary mt-1">登录以保存你的个人信息。（数据仅存本机）</p>
  ├─ 昵称 input + 邮箱 input（同 onboarding 样式）
  ├─ 头像色 5 圆点 radio
  └─ <button 保存并登录 bg-brand text-black font-bold rounded-full w-full py-2.5>
       → setProfile(...) + closeModal('login') + toast"已登录（本机存档）"
  已登录态:
  ├─ 头像圈（w-16 h-16 rounded-full 背景=avatarColor 居中首字母 text-2xl font-bold text-black）
  ├─ 昵称 + 邮箱（text-text-tertiary text-sm）
  ├─ 编辑按钮 → 切换为表单（同上）; 退出登录按钮（bg-btn-std rounded-full w-full py-2.5）→ setProfile(null)
```
- modals 状态: `{settings, onboarding, subscribe, login}`（login 打开 ProfileModal; subscribe 永远 false, 不再使用）
- 若昵称为空: toast"请填写昵称" 不关闭

## 参考
- 原站截图 state-settings1.png（设置弹窗 75% 布局）、state-onboard*.png（引导）
