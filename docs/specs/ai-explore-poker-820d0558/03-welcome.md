# 03 — WelcomeView（空态欢迎页）

文件: `src/components/sites/ai-explore-poker-820d0558/welcome-view.tsx`（"use client" 不需要, 纯展示 + 回调）

## 结构（桌面, 居中）
```
<div className="w-full h-full flex flex-col items-center justify-center relative">
  ├─ <h1 className="font-bruno-ace font-normal text-center text-content-brand shadow-brand select-none"
  │       style={{fontSize: 'clamp(3rem, 8vw, 7rem)'}}>Explore</h1>
  │    （Bruno Ace 字体大 logo, 品牌绿 + 绿色投影; 移动端缩小）
  ├─ <p className="mt-6 text-text-secondary text-base text-center max-w-md px-6">
  │     AI 结构化思维与知识探索工具 —— 哪里不懂点哪里，一棵属于你的知识树。</p>
  ├─ <div className="flex items-center gap-4 mt-8">
  │     <button className="px-6 py-2 bg-btn-std hover:bg-btn-std-hover text-primary rounded-full transition-colors">
  │       如何使用</button>
  │     <button className="w-10 h-10 rounded-full bg-btn-std hover:bg-btn-std-hover flex items-center justify-center"
  │             aria-label="帮助"><HelpCircle size={20}/></button>
  │   </div>
  └─ （可选）特性卡片行: 层级对话/思维宇宙/文档阅读 3 个小卡（bg-card-std rounded-2xl border border-std p-4）
       提示语: "点击左侧项目开始探索，或输入问题直接开始"
</div>
```
- HelpCircle 点击 → 打开引导向导（openModal('onboarding')）或小型帮助弹层（组件内部 useState 控制, 展示 8 个功能列表: 智能标注/层级对话/文档阅读/思维宇宙/上下文管理/沉浸界面/智能总结/个性化）
- 提示语挂在卡片下方, text-text-tertiary text-sm
- 桌面端该项目可自由发挥（用户允许视觉自定）: 卡片行可选、渐变装饰可选

## 参考
- PAGE_TOPOLOGY §3（原站: Bruno Ace logo + How to Use 按钮组）
- 截图 state-mainui.png / state-newproj1.png（项目态 logo 居中 + 输入区在底部）
