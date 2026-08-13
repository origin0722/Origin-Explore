# PAGE_TOPOLOGY — https://ai.explore.poker/chat

> 克隆参考：**结构与交互一致**，颜色/文案/图形可自由更换（用户要求）。
> 完整坐标/计算样式留档: `layout-mainui-elements.json`、`state-*-legend.txt`、`inline-css-all.css`（11KB 运行时 CSS + 20 keyframes）。
> 截图: `docs/design-references/ai-explore-poker-820d0558/chat-6ea4b827/state-*.png`

## 0. 产品定位（决定界面设计）

**Explore = AI 结构化思维与知识探索工具**（层级对话）:
- 提问 → AI 回答中的术语可点击 → 新卡片在旁边展开（子卡片深挖 / 关联卡片对比 / 分支卡片另起炉灶）→ 无限向下钻取，主线清晰 → 知识树
- "思维宇宙"（Mindscape）: 用户用自己的话总结概念，AI 认可后存入 3D 空间知识锚点网络

## 1. 布局骨架（桌面 1440×900）

```
┌──────────────┬───────────────────────────────────────┬──────────┐
│ 左 侧边栏     │            主 区（画布）                 │ 右 Mindscape│
│ 225px        │  空态: "Explore" logo + How to Use      │ 面板      │
│ (折叠态 56px) │  项目态: 知识卡片（居中大卡片）           │ 225px     │
│              ├───────────────────────────────────────┤ (可收起)  │
│              │  底部: 聊天输入区（rounded-[28px] 卡片）  │          │
└──────────────┴───────────────────────────────────────┴──────────┘
底部横条: ICP 备案号（居中, 12px, 弱化色）
```

- 发消息后侧边栏**自动折叠**为 56px 图标条（给卡片腾空间）
- 主画布 = 大卡片居中（985×685 圆角 24 卡片，shadow 左上投影），canvas 渲染层铺底
- 移动端(390): 主区全屏；侧边栏为抽屉（屏幕外）；底部中央 FAB(32px) → 打开 Mindscape

## 2. 左侧边栏（225px）

**顶部 5 个功能按钮**（44×44 圆角图标块 + 右侧 16px 文字，纵排 gap 8，间距 16 起）:
1. Toggle Sidebar — 折叠侧边栏
2. New Folder — 新建文件夹（项目分组）
3. **New Project — 一键创建 "Untitled" 项目，无确认弹窗，直接进入项目视图**
4. Document Reading — 导入文档（标注功能）
5. Import Project — 导入项目文件

**项目滚动区**: Resident Chat（常驻聊天，带小分段切换按钮）→ Local Projects 分组（可折叠 header + 项目行：选中态 border-2 + 左展开箭头 + 右更多按钮）→ Cloud Projects 分组（"Members only" 徽章）

**底部**: Settings / Account（头像圈），`mt-auto` 贴底

折叠态: 只剩图标块（56px 宽）。

## 3. 主区状态机

| 状态 | 内容 |
|---|---|
| 空态（欢迎页） | 居中大 logo "Explore"（Bruno Ace 字体、品牌色 + 绿色投影）+ "How to Use" 圆角按钮 + 问号圆按钮；或文案版 "Welcome to Explore / Select a project on the left, or create a new one to begin." |
| 项目态（无消息） | 画布空 + logo 欢迎态 + 底部输入区 |
| 项目态（有消息） | 居中大卡片: turn 标题行 + 时间戳 + 用户气泡（右对齐）+ AI markdown 内容 + 右侧 turn 导航条（20px 收起） |

## 4. 知识卡片（核心组件）

```
卡片容器: rounded-[24px] + shadow（左上投影）+ border
├─ 头部: turn/对话标题（bold 截断）+ 3 个 36px 圆形操作按钮
├─ 滚动区（scrollbar 自定义）:
│  ├─ Turn 组: 标题（h-14, 18px semibold）+ 时间戳（11px 弱化, 右对齐）
│  ├─ 用户消息: 右对齐气泡（圆角自定义 + shadow, px-3 py-2）
│  ├─ AI 消息: markdown 渲染（markdown-content 排版: h1-h6/ul/ol/li 已提取）
│  │   └─ 登录墙提示: "Please log in to use built-in models."
│  └─ 分支点按钮: "Branch From ..."（xs, 圆角 pill, border, hover 品牌色）
└─ 文本选中浮条（选中 AI 文本时）: 3 个 32px 圆形按钮（预览/引用/复制）
```

- turn 虚拟列表渲染（tanstack-virtual）
- 动画: 卡片出入场 keyframes（`card-exit-up-and-grow` 等 20 个, inline-css-all.css）

## 5. 聊天输入区（底部）

```
rounded-[28px] 卡片容器（border-2 + shadow, p-3）
├─ 模型选择器: pill 按钮（220×32, 品牌 icon + 模型名 truncate）"deepseek-v4-flash-0731"
├─ textarea（透明底, 自动增高）— 发送快捷键 Ctrl+Enter
├─ 左工具按钮 34px 圆（透明底 hover）
├─ 右: 辅助按钮 34px 圆 + 绿色发送按钮 34px 圆（品牌色）
```

## 6. Mindscape（思维宇宙）

- 桌面: 右侧 225px 面板（滚动容器 cursor-grab）
- 移动: 底部中央 FAB 打开
- 空态文案 3 段（"This is your Mindscape, but there are no thought nodes yet..."）
- 有节点时: Three.js 3D 节点网络（节点 = 用户自己的话总结的概念, AI 认可后存入）; 节点 hover tooltip（浮层卡, 含时间戳 + 摘要）

## 7. 弹窗栈（z 序: Settings z-50 → Log In z-[60] → 向导 z-[100]）

1. **Settings**（75% 大弹窗）: 左导航 8 项（Model Assignment / API Keys / Color Theme / Edit Permissions / Shortcuts / Auto Behavior / Language / Layout）+ 右内容面板; AI Models 面板: 模型列表（名称+星标+档位徽章 Free/Pro/Max+倍率徽章×0.3+供应商描述）+ "Add BYOK Model" + "Free tier can add 1 BYOK model"; 头部有"设置引导"按钮
2. **引导向导**（首次使用, 3 步）: ① Choose Theme（9 个主题 radio 行）② Choose Language（汉语/繁體中文/English）③ Log In / Sign Up → Finish（品牌绿圆按钮, 底部步骤点指示器）
3. **订阅**（Choose an Explore Plan）: 4 档定价卡（Go $3 / Plus $5 Popular / Pro $9 / Max $20）+ Continue to Payment + Switch to WeChat / Alipay + Join Now + "prefer afdian?"
4. **Log In**（z-[60]）: Welcome Back 文案 + Sign Up / Log In（品牌绿按钮）+ Forgot password?
5. **同步冲突**（云端冲突时）: Load Remote Version / Duplicate as New / Force Overwrite

## 8. 已提取素材清单（供构建参考）

- 运行时 CSS: `inline-css-all.css`（markdown 排版、card 动画、turn 样式、滚动条）
- 全部弹窗/界面文案: `text-content.json`（87KB, 含中英双语字符串表）
- 元素+计算样式: `layout-mainui-elements.json`（59 元素）; 各状态 legend: `state-*-legend.txt`
- 图标: lucide（zap/brain/sparkles/help-circle/plus/lock/chevron-right/eye/quote/copy 等）
- 字体: Inter / Noto Sans SC / Bruno Ace
- 本地化: 应用内文案有 zh/en/tw 三语字符串表（325.js 内 nP 等对象）——克隆可选用中文或自定文案
