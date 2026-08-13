# BEHAVIORS — https://ai.explore.poker/chat 交互行为清单

> [实测] = 运行时验证过；[推断] = 代码分析（325.js 等 chunk），待 QA 复核。

## 首次访问流
1. [实测] Splash: "Initializing Explore..." 全屏（2~14s 不等，网络决定）
2. [实测] 引导向导自动弹出（z-[100]，3 步）：Choose Theme → Choose Language → Log In/Sign Up → Finish
   - 向导完成无需登录：Finish 按钮直接关闭（onComplete → 关弹窗）
   - 向导打开条件实测：即使 seed 完整 settings-storage 也弹出（触发条件与 storage 内容无关，推测与登录态/首次标志有关）
   - 注意：向导的 Next/Finish 按钮在无头环境中点击不推进 React 状态（可能是动画/事件问题）——克隆版需确保正常推进
3. [推断] 设置弹窗有"设置引导"按钮可随时重开向导

## 主界面
- [实测] 侧边栏（225px）+ 欢迎区 + 底部备案号
- [实测] Toggle Sidebar 折叠侧边栏 → 56px 图标条
- [实测] New Project 一键创建 "Untitled" 项目并进入项目视图（无确认弹窗、无命名步骤）
- [推断] New Folder 创建文件夹分组；Import Project 导入文件；Document Reading 上传文档做标注

## 项目视图
- [实测] 发消息后侧边栏**自动折叠**（给卡片腾空间）
- [实测] 发送消息：聚焦 textarea → Ctrl+Enter 发送（sendShortcut 默认 ctrl-enter，可配置）
- [实测] 未登录发送 → AI 卡片内显示 "Please log in to use built-in models."（登录墙）
- [实测] turn 标题 = 首条消息预览 + 时间戳（"Aug 13, 2026, 15:36" 格式, 11px）
- [推断] 登录后：AI 回复 markdown 渲染，术语可点击 → 子卡片/关联卡片/分支卡片在旁展开（产品核心，未登录无法实测）
- [推断] 选中 AI 消息文本 → 浮出操作条（预览/引用/复制）
- [推断] 卡片右上 3 个圆按钮（36px）= 卡片操作（展开/收起/菜单类）

## 输入区
- [实测] 模型选择器 pill（显示当前模型名）→ 点击打开模型列表（Settings 的 AI Models 面板同款列表）
- [推断] 发送按钮绿色圆（品牌色）；左附件按钮、右辅助按钮
- [推断] textarea 自动增高（transition-[height] 300ms）

## Mindscape（思维宇宙）
- [实测] 桌面右侧面板 / 移动端底部 FAB 打开
- [实测] 空态 3 段文案
- [推断] 有节点时 3D 网络渲染（Three.js）；节点 hover 显示 tooltip（时间戳+内容摘要）
- [推断] "如何理解"交互：用户在对话中用自己的话总结 → AI 认可 → 存入 Mindscape

## 弹窗行为
- [实测] Settings（z-50）: 左侧 8 项导航切换右面板；"设置引导"按钮开向导
- [实测] 向导（z-[100]）: 步骤点指示器（3 点）；Prev/Next 圆按钮（36-48px）；Finish 绿色圆按钮
- [推断] 弹窗点击背板关闭（onMouseDown 兜底）；Escape 关闭（部分弹窗）
- [实测] 订阅/登录/同步冲突弹窗内容（文本已提取）

## 响应式
- [实测] <600px: 侧边栏变抽屉（屏幕外），主区全屏，底部中央 FAB（32px）开 Mindscape，顶部功能按钮组隐藏（入口移入抽屉/其他位置，待 QA 复核）
- [推断] 移动端输入区与卡片布局独立处理（移动 2 列网格用于 Mindscape 列表）

## 快捷键
- [实测] Ctrl+Enter 发送
- [推断] 其余见 Settings → Shortcuts 面板（内容在 text-content.json）
