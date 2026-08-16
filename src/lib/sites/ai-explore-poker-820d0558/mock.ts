/**
 * Explore — mock data (site: ai.explore.poker/chat)
 * Content is freely adapted; structure mirrors the live site.
 * Personal tool: no subscription, all models unlocked, zh-only UI.
 */
import type {
  ChatProject,
  ChatSettings,
  DocumentItem,
  ModelPreset,
  TermNode,
  ThemeOption,
  ThoughtNode,
  Turn,
} from "@/types/sites/ai-explore-poker-820d0558";

/**
 * BYOK 预设（OpenAI 兼容接口）：一键填充 API 地址 + 模型 ID。
 * 模型 ID 与地址按 2026-08 各厂商官方文档核实：
 * DeepSeek V4（deepseek-chat / deepseek-reasoner 已于 2026-07-24 退役）、
 * GPT-5.4 系列、Claude Sonnet 4.6（Anthropic 官方 OpenAI SDK 兼容端点）、
 * Gemini 3.1 / 2.5、Qwen3 Max、GLM-4.6、Kimi K2.5、MiniMax M2.7。
 */
export const MODEL_PRESETS: ModelPreset[] = [
  { name: "DeepSeek V4 Pro", provider: "DeepSeek", description: "旗舰推理，1M 上下文", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-v4-pro" },
  { name: "DeepSeek V4 Flash", provider: "DeepSeek", description: "高性价比，低延迟", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-v4-flash" },
  { name: "GPT-5.4", provider: "OpenAI", description: "OpenAI 当前旗舰", baseUrl: "https://api.openai.com/v1", modelId: "gpt-5.4", vision: true },
  { name: "GPT-5.4 mini", provider: "OpenAI", description: "轻量快速，成本低", baseUrl: "https://api.openai.com/v1", modelId: "gpt-5.4-mini", vision: true },
  { name: "Claude Sonnet 4.6", provider: "Anthropic", description: "平衡性能与成本（多模态）", baseUrl: "https://api.anthropic.com/v1", modelId: "claude-sonnet-4-6", vision: true },
  { name: "Gemini 3.1 Pro", provider: "Google", description: "最新旗舰（预览）", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: "gemini-3.1-pro-preview", vision: true },
  { name: "Gemini 2.5 Flash", provider: "Google", description: "快速多模态", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: "gemini-2.5-flash", vision: true },
  { name: "Qwen3 Max", provider: "阿里云", description: "通义千问旗舰", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelId: "qwen3-max" },
  { name: "GLM-4.6", provider: "智谱 AI", description: "中文友好", baseUrl: "https://open.bigmodel.cn/api/paas/v4", modelId: "glm-4.6" },
  { name: "Kimi K2.5", provider: "月之暗面", description: "超长上下文", baseUrl: "https://api.moonshot.cn/v1", modelId: "kimi-k2.5" },
  { name: "MiniMax M2.7", provider: "MiniMax", description: "新一代推理模型（多模态）", baseUrl: "https://api.minimax.io/v1", modelId: "MiniMax-M2.7", vision: true },
  // 视觉专用预设（路由模式"眼睛"，主模型纯文本时配一个即可）
  { name: "GLM-4V-Flash", provider: "智谱 AI", description: "视觉理解（免费档，适合当眼睛）", baseUrl: "https://open.bigmodel.cn/api/paas/v4", modelId: "glm-4v-flash", vision: true },
  { name: "Qwen-VL-Max", provider: "阿里云", description: "通义千问视觉旗舰", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelId: "qwen-vl-max", vision: true },
];

/** 九种颜色主题：赛博青（默认）、白蓝、暗紫霓虹、琥珀暖橙、纸墨风、品红、森林绿、海洋蓝、玫瑰金。 */
export const THEMES: ThemeOption[] = [
  { id: "default", name: "赛博青" },
  { id: "white-blue", name: "白蓝" },
  { id: "midnight-purple", name: "暗紫霓虹" },
  { id: "sunset-amber", name: "琥珀暖橙" },
  { id: "paper-ink", name: "纸墨风" },
  { id: "magenta-pink", name: "品红" },
  { id: "forest", name: "森林绿" },
  { id: "ocean", name: "海洋蓝" },
  { id: "rose-gold", name: "玫瑰金" },
];

/** settings.theme stores the theme *name*; map it to a data-theme key. */
export function themeId(name: string): string {
  return THEMES.find((t) => t.name === name)?.id ?? "default";
}

/** 全部主题均已实现（globals.css 有对应 [data-theme=…] 块）。 */
export function isThemeImplemented(name: string): boolean {
  return THEMES.some((t) => t.name === name);
}

/** 浏览器地址栏主题色（meta theme-color），与各主题的 --bg 一致。 */
export const THEME_META_COLORS: Record<string, string> = {
  default: "#0a0e1a",
  "white-blue": "#f5f7fb",
  "midnight-purple": "#0d0a1a",
  "sunset-amber": "#14100c",
  "paper-ink": "#faf7f0",
  "magenta-pink": "#150b18",
  forest: "#0b1210",
  ocean: "#070d1c",
  "rose-gold": "#faf3ef",
};

export const DEFAULT_SETTINGS: ChatSettings = {
  theme: "赛博青",
  language: "zh",
  activeModelId: "",
  isWebSearchEnabled: false,
  autoCitationEnabled: true,
  autoTitleInterval: 5,
  autoTitleEnabled: true,
  sendShortcut: "ctrl-enter",
  uiZoom: 1,
  visionMode: "auto",
  visionModelId: null,
};

/** A demo conversation used to showcase the knowledge-tree card (mock AI reply). */

/**
 * Recursive knowledge tree (3 levels).
 * 子卡片 = 深挖背景 · 关联卡片 = 横向对比 · 分支卡片 = 继承上下文另起炉灶
 * Each card's `children` are the clickable terms inside it (recursive).
 */
export const TERM_TREE: TermNode[] = [
  {
    id: "superposition",
    term: "叠加态",
    kind: "child",
    summary: `**叠加态**（Superposition）是量子力学最核心的概念之一：一个量子系统可以同时处于多个经典状态的"叠加"之中。

\`\`\`
|ψ⟩ = α|0⟩ + β|1⟩
\`\`\`

处于叠加态的粒子，其状态不是一个确定的取值，而是一个概率分布——直到被测量时，"塌缩"为其中一个确定状态。

> 类比：旋转的硬币既不是正面也不是反面，而是"正面+反面的叠加"，直到它被拍到桌面上。`,
    children: [
      {
        id: "qubit",
        term: "量子比特",
        kind: "child",
        summary: `**量子比特**（Qubit）是量子计算的基本单位，对应经典计算机的比特（0 或 1）。

与经典比特不同，量子比特可以处于叠加态：\`α|0⟩ + β|1⟩\`，因此单个量子比特能同时携带 0 和 1 的信息。n 个量子比特可以同时表示 2ⁿ 个状态——这是量子计算指数级加速的根源。

> 物理实现：超导电路、离子阱、光子都可以承载量子比特。`,
        children: [
          {
            id: "bloch-sphere",
            term: "布洛赫球",
            kind: "related",
            summary: `**布洛赫球**（Bloch Sphere）是可视化单个量子比特状态的几何模型：球面上的每一点对应量子比特的一个可能状态。

- 北极 = \`|0⟩\`，南极 = \`|1⟩\`
- 赤道上的点 = 等权叠加态
- 量子门的操作 = 球面上的旋转

它把抽象的复数振幅变成了直观的几何图像。`,
          },
        ],
      },
      {
        id: "measurement-collapse",
        term: "测量坍缩",
        kind: "child",
        summary: `**测量坍缩**是叠加态消失的过程：对叠加态中的量子系统进行测量时，系统会以概率 α²/β² 随机"选择"一个本征态作为结果。

坍缩是瞬时且不可逆的——你无法通过测量"看到"叠加态本身，只能看到它的一个抽样结果。

> 这正是薛定谔的猫悖论的来源：猫在打开盒子前"既是死的又是活的"。`,
        children: [
          {
            id: "observer-effect",
            term: "观测者效应",
            kind: "related",
            summary: `**观测者效应**指"测量行为本身改变了被测量系统"。

在经典世界里测量是"记录"，在量子世界里测量是"干扰"——测量装置必须与系统相互作用，而这种相互作用本身就是量子过程。

> 注意：这不是"意识影响物质"，而是任何测量装置（无论有没有人看）都会引起坍缩。`,
          },
        ],
      },
    ],
  },
  {
    id: "wavefunction-collapse",
    term: "波函数坍缩",
    kind: "child",
    summary: `**波函数坍缩**（Wavefunction Collapse）指量子系统的波函数（描述所有可能状态的概率幅）在测量瞬间"收缩"为单一确定状态。

它是量子力学中争议最大的概念之一：

- **哥本哈根诠释**：坍缩是真实过程，测量前系统"没有"确定状态
- **多世界诠释**：没有坍缩，只是观察者"分支"到其中一个世界

无论哪种诠释，数学预测完全相同——坍缩是描述测量结果的最简洁语言。`,
    children: [
      {
        id: "von-neumann-measurement",
        term: "冯·诺依曼测量",
        kind: "child",
        summary: `**冯·诺依曼测量**（Von Neumann Measurement）是测量坍缩的数学形式化：用一组投影算子 \`P_k\` 把态矢量投影到本征子空间。

测量结果 \`k\` 出现的概率 = \`⟨ψ|P_k|ψ⟩\`，测量后系统状态变为归一化的投影态。

它是量子信息理论里所有协议（包括隐形传态）的数学基础。`,
        children: [
          {
            id: "projection-operator",
            term: "投影算子",
            kind: "child",
            summary: `**投影算子**（Projection Operator）是线性代数中把向量"压"到某个子空间上的算子：\`P² = P\`，应用两次等于应用一次。

在量子力学中，每次测量对应一组投影算子，每个算子的本征空间对应一个可能的测量结果。`,
          },
        ],
      },
      {
        id: "decoherence",
        term: "退相干",
        kind: "related",
        summary: `**退相干**（Decoherence）解释了"为什么宏观世界看起来是经典的"：量子系统与环境不可避免的相互作用，会迅速抹平叠加态中的量子相干性。

一个量子比特的叠加态在真空中可以保持很久；一个宏观物体（与环境有海量接触）的叠加态在 10⁻³⁰ 秒内就消失。退相干让"经典世界"从量子力学中涌现出来——不需要引入"测量者"这个特殊角色。`,
      },
    ],
  },
  {
    id: "bell-inequality",
    term: "贝尔不等式",
    kind: "child",
    summary: `**贝尔不等式**（Bell's Inequality）是量子纠缠的实验判据：它给出"任何局域隐变量理论"必须满足的统计约束。

实验事实：纠缠粒子对的相关性统计**违反**贝尔不等式，且与量子力学预测完全吻合。

> 结论：纠缠粒子的关联无法用"预先设定好的隐藏属性"解释——量子力学确实是非局域的。`,
    children: [
      {
        id: "chsh",
        term: "CHSH 不等式",
        kind: "child",
        summary: `**CHSH 不等式**是贝尔不等式最常用的实验版本，由 Clauser、Horne、Shimony、Holt 四人提出。

它用一个简单的关联函数 \`S = E(a,b) + E(a,b') - E(a',b) + E(a',b')\` 检验纠缠：

- 局域隐变量理论：\`|S| ≤ 2\`
- 量子力学最大违反：\`S = 2√2 ≈ 2.828\`
- 实验实测：\`2.828\`（2022 年诺贝尔物理学奖）

CHSH 是量子通信与量子密钥分发安全性的理论基石。`,
      },
      {
        id: "hidden-variables",
        term: "隐变量理论",
        kind: "related",
        summary: `**隐变量理论**（Hidden Variables）主张：量子力学的概率性只是因为我们看不到更深层的确定参数。

爱因斯坦是代表人物："上帝不掷骰子"。贝尔不等式证明：如果存在隐变量且局域（光速内传递），必然满足不等式——实验违反它，说明**局域隐变量不存在**。

> 非局域隐变量理论（如玻姆诠释）仍然自洽，但付出的代价是"超光速的幽灵作用"。`,
      },
    ],
  },
  {
    id: "epr-paradox",
    term: "EPR 悖论",
    kind: "child",
    summary: `**EPR 悖论**（Einstein-Podolsky-Rosen Paradox）是爱因斯坦等人 1935 年提出的思想实验，试图证明量子力学不完备。

核心论据：两个纠缠粒子分开很远后，测量 A 能立即"知道"B 的状态——要么存在超光速影响（违背相对论），要么 B 的状态在测量前就已确定（意味着量子力学不完备）。

> 贝尔不等式后来的实验裁决：EPR 的两个前提不能同时成立——量子力学是完备的，且确实是"非局域的"。`,
    children: [
      {
        id: "local-realism",
        term: "局域实在论",
        kind: "child",
        summary: `**局域实在论**（Local Realism）包含两个可分离的假设：

- **实在性**：物理属性在测量前就有确定值
- **局域性**：相互作用以光速为上限传递

贝尔不等式证明：这两个假设联合起来与实验矛盾。你只能放弃其一——物理学家普遍选择保留相对论（放弃"实在性"），因为非局域关联无法传递信息。`,
      },
      {
        id: "bohm",
        term: "玻姆诠释",
        kind: "branch",
        summary: `**玻姆诠释**（Bohmian Mechanics）是唯一保留"粒子有确定位置"的量子理论：粒子沿着确定性轨道运动，由"量子势"引导。

代价：波函数必须被视为真实物理场，且粒子间的关联是非局域的（瞬时作用）。

> 这是一个**分支**卡片——如果你对玻姆诠释感兴趣，我们可以把它单独开一个对话，继承当前上下文继续深挖。`,
        children: [
          {
            id: "guidance-equation",
            term: "引导方程",
            kind: "child",
            summary: `**引导方程**（Guidance Equation）是玻姆诠释的运动方程：\`v = ∇S/m\`，粒子的速度由波函数的相位 S 的梯度决定。

它把薛定谔方程的确定性重新注入量子力学——粒子永远有确定的轨迹，只是我们不知道初始条件。`,
          },
        ],
      },
    ],
  },
  {
    id: "quantum-teleportation",
    term: "量子隐形传态",
    kind: "child",
    summary: `**量子隐形传态**（Quantum Teleportation）是利用纠缠和经典通信，把一个未知量子态"传"到另一个粒子上——不传输物质，只传输状态。

协议三要素：1 对共享纠缠对 + 1 个贝尔基测量 + 2 个经典比特。

> 1997 年首次实验验证，2022 年实现卫星级距离（1200 公里）传输。不是"超光速传输"——经典比特必须以光速传递，所以总过程不超光速。`,
    children: [
      {
        id: "bell-measurement",
        term: "贝尔基测量",
        kind: "child",
        summary: `**贝尔基测量**（Bell Measurement）是同时测量两个量子比特在贝尔基（四个最大纠缠态）上的投影。

它是隐形传态的"中间环节"：测量结果（4 种可能）通过经典信道传给接收方，接收方根据结果做相应的幺正变换即可恢复原始态。

> 有意思的是：测量本身不包含任何关于原态的信息——这正是它不能用于超光速通信的原因。`,
        children: [
          {
            id: "bell-states",
            term: "贝尔态",
            kind: "related",
            summary: `**贝尔态**（Bell States）是两比特系统的四个最大纠缠态：

\`Φ⁺ = (|00⟩+|11⟩)/√2\`，\`Φ⁻ = (|00⟩-|11⟩)/√2\`，\`Ψ⁺ = (|01⟩+|10⟩)/√2\`，\`Ψ⁻ = (|01⟩-|10⟩)/√2\`

它们构成二维两比特空间的完备正交基——任何两比特态都可以展开为贝尔基的线性组合。`,
          },
        ],
      },
      {
        id: "entanglement-swapping",
        term: "纠缠交换",
        kind: "related",
        summary: `**纠缠交换**（Entanglement Swapping）是"纠缠可以传递"的现象：对两个从未相互作用过的粒子做贝尔测量，可以"创造"出它们之间的纠缠。

它让量子通信网络的"中继"成为可能——不需要直接传递粒子，只需要共享纠缠链。`,
      },
    ],
  },
  {
    id: "machine-learning",
    term: "机器学习",
    kind: "child",
    summary: `**机器学习**（Machine Learning）是让程序从数据中自动学习规律、而不需要显式编程的技术。

它把"找规律"变成"优化"：定义一个损失函数度量预测与真实的差距，再用数据驱动地调整参数把损失降到最低。

> 机器学习的三大范式：**监督学习**、**无监督学习**、**强化学习**。`,
    children: [
      {
        id: "supervised-learning",
        term: "监督学习",
        kind: "child",
        summary: `**监督学习**（Supervised Learning）使用带标签的数据训练模型：每条样本都有输入 \`x\` 和期望输出 \`y\`。

- **回归**：预测连续值（房价、温度）
- **分类**：预测离散类别（垃圾邮件、图片里是猫还是狗）

模型学到的本质是"输入 → 输出"的映射 \`f(x) ≈ y\`。`,
        children: [
          {
            id: "regression",
            term: "回归",
            kind: "child",
            summary: `**回归**（Regression）预测连续数值：输出是实数。

最简单的线性回归：\`y = w·x + b\`，训练就是找最合适的权重 \`w\` 与偏置 \`b\`，让预测与真实值的均方误差最小。`,
          },
          {
            id: "overfitting-ml",
            term: "过拟合",
            kind: "child",
            summary: `**过拟合**（Overfitting）是模型在训练数据上表现完美、在新数据上表现糟糕——它把噪声也"背"下来了。

- 信号：训练误差很低、验证误差高
- 对策：正则化、更多数据、早停、Dropout

> 类比：死记硬背的学生，换一道题就不会了。`,
          },
        ],
      },
      {
        id: "neural-network",
        term: "神经网络",
        kind: "child",
        summary: `**神经网络**（Neural Network）由大量简单的"神经元"分层连接而成，每层对输入做加权求和 + 非线性变换。

- 输入层 → 隐藏层（可多层）→ 输出层
- 训练 = 调整每条连线的权重
- 非线性激活函数让网络能逼近任意复杂函数

> 灵感来自生物神经元，但今天的网络更像"可微分的参数化函数"。`,
        children: [
          {
            id: "perceptron",
            term: "感知机",
            kind: "child",
            summary: `**感知机**（Perceptron）是 1958 年提出的最简神经网络：单层神经元，加权求和后过阶跃函数。

它只能解决**线性可分**的问题（如 AND/OR），解不了异或（XOR）——这个局限让神经网络研究沉寂近 20 年，直到多层网络 + 反向传播出现。`,
          },
          {
            id: "backpropagation",
            term: "反向传播",
            kind: "child",
            summary: `**反向传播**（Backpropagation）是训练神经网络的核心算法：用链式法则从输出层向输入层逐层计算损失对每个权重的梯度。

- 前向：算预测
- 反向：算梯度
- 更新：\`w ← w - η·∂L/∂w\`（η 是学习率）

> 本质是"把错误从输出端倒着传回去，告诉每个权重该往哪调"。`,
            children: [
              {
                id: "vanishing-gradient",
                term: "梯度消失",
                kind: "related",
                summary: `**梯度消失**（Vanishing Gradient）是深层网络训练困难的原因：反向传播时梯度逐层相乘，越靠前的层梯度指数级变小，几乎学不动。

对策：ReLU 激活、残差连接（ResNet）、批归一化——深度学习能"深"起来全靠这些技巧。`,
              },
            ],
          },
        ],
      },
      {
        id: "deep-learning",
        term: "深度学习",
        kind: "child",
        summary: `**深度学习**（Deep Learning）是"深"神经网络的统称：层数多到能自动从原始数据学习从低层到高级的抽象特征。

- 卷积网络：图像（局部特征）
- Transformer：语言与序列
- 数据 + 算力 + 算法改进是它的三根支柱

> 它让"手工特征工程"成为历史——模型自己学特征。`,
        children: [
          {
            id: "cnn",
            term: "卷积神经网络",
            kind: "child",
            summary: `**卷积神经网络**（CNN）用卷积核在图像上滑动，提取局部特征（边缘 → 纹理 → 形状）。

三个关键思想：
- **局部连接**：只看感受野内
- **权值共享**：同一卷积核扫描全图
- **池化**：下采样压缩，增强平移不变性

2012 年 AlexNet 在 ImageNet 夺冠后统治了计算机视觉。`,
          },
          {
            id: "transformer",
            term: "Transformer",
            kind: "child",
            summary: `**Transformer**（2017）是当前大语言模型的基石架构，核心是**自注意力**：每个 token 都能直接"看到"序列里所有其他 token，并按相关性加权。

相比 RNN 的串行处理，它完全并行、可以训练得很深，还自带长程依赖能力。

> 它最初为翻译设计，后来统治了 NLP——GPT 系列就是"只有解码器的 Transformer"。`,
            children: [
              {
                id: "attention",
                term: "注意力机制",
                kind: "child",
                summary: `**注意力机制**（Attention）让模型动态聚焦输入中最相关的部分：对每个位置与其他位置算相关性分数，加权汇总。

公式：\`Attention(Q,K,V) = softmax(QKᵀ/√d)·V\`——Q 查询、K 键、V 值都来自输入本身。

> 类比：读论文时你会把注意力集中在关键段落，而不是逐字等权。`,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "algorithms",
    term: "算法与数据结构",
    kind: "child",
    summary: `**算法与数据结构**是计算机科学的"语法与词汇"：算法解决"怎么做"，数据结构决定"怎么存"——两者共同决定程序效率。

评价算法的核心指标是**时间复杂度**；常见设计范式有分治、贪心、动态规划。

> 好的程序 = 合适的数据结构 + 高效的算法。`,
    children: [
      {
        id: "time-complexity",
        term: "时间复杂度",
        kind: "child",
        summary: `**时间复杂度**描述算法运行时间随输入规模 \`n\` 增长的趋势，用大 O 记号表示。

常见量级（快 → 慢）：\`O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)\`

> 它忽略常数与低阶项，只关心"规模翻倍时时间怎么变"。`,
        children: [
          {
            id: "big-o",
            term: "大 O 记号",
            kind: "child",
            summary: `**大 O 记号**（Big-O）给出复杂度的渐进上界：\`f(n) = O(g(n))\` 表示存在常数 \`c, n₀\`，当 \`n > n₀\` 时 \`f(n) ≤ c·g(n)\`。

- \`O(1)\`：哈希表查找
- \`O(n)\`：线性扫描
- \`O(n log n)\`：归并/快排平均
- \`O(n²)\`：冒泡排序
- \`O(2ⁿ)\`：暴力枚举子集`,
          },
          {
            id: "p-vs-np",
            term: "P 与 NP",
            kind: "related",
            summary: `**P 与 NP** 是理论计算机科学最重要的未解问题之一：

- **P**：能在多项式时间 \`O(nᵏ)\` 内求解的问题
- **NP**：能在多项式时间内验证解的问题（不要求能快速求解）

显然 \`P ⊆ NP\`。\`P = NP?\` 至今未决——若成立，现代加密体系将崩溃。`,
          },
        ],
      },
      {
        id: "sorting",
        term: "排序算法",
        kind: "child",
        summary: `**排序算法**把一组元素按序排列，是算法入门必修，也是各种复杂算法的构件。

- 比较排序的信息论下界：\`Ω(n log n)\`
- 快速排序：分治、平均 \`O(n log n)\`、工程首选
- 归并排序：稳定、最坏 \`O(n log n)\`
- 计数/基数排序：非比较，可到 \`O(n)\``,
        children: [
          {
            id: "quicksort",
            term: "快速排序",
            kind: "child",
            summary: `**快速排序**（Quicksort）：选一个基准（pivot），小于它的放左边、大于的放右边，再递归两边。

平均 \`O(n log n)\`、原地排序、常数小，是实际使用最多的排序；最坏退化为 \`O(n²)\`（已排序输入 + 固定基准），用随机化或三数取中规避。`,
          },
          {
            id: "mergesort",
            term: "归并排序",
            kind: "related",
            summary: `**归并排序**（Mergesort）：先把数组对半拆分到底，再两两合并有序子数组。

- 稳定、最坏 \`O(n log n)\`
- 需要 \`O(n)\` 额外空间
- 典型分治：分 → 治 → 合

> 常用于外部排序（数据太大放不进内存）。`,
          },
        ],
      },
      {
        id: "hash-table",
        term: "哈希表",
        kind: "child",
        summary: `**哈希表**（Hash Table）通过哈希函数把键映射到数组下标，实现平均 \`O(1)\` 的插入、查找、删除。

- 哈希函数：\`key → index\`
- 冲突处理：链地址法 / 开放寻址
- 负载因子过高 → 扩容重哈希

> JavaScript 的对象、Python 的 dict、数据库索引底层都有它的身影。`,
        children: [
          {
            id: "hash-collision",
            term: "哈希冲突",
            kind: "child",
            summary: `**哈希冲突**：不同键映射到同一个下标。两种经典解法：

- **链地址法**：同一桶里挂链表（如 Java HashMap）
- **开放寻址法**：冲突后探测下一个空位（线性探测等）

设计良好的哈希函数让冲突概率足够低，摊还复杂度保持 \`O(1)\`。`,
          },
        ],
      },
    ],
  },
  {
    id: "math-foundations",
    term: "数学基础",
    kind: "child",
    summary: `**数学基础**是理解机器学习与算法的语言：线性代数描述高维空间，概率论刻画不确定性，微积分提供优化工具。

> 深度学习里的每一个公式，拆到底都是这三门课的组合。`,
    children: [
      {
        id: "linear-algebra",
        term: "线性代数",
        kind: "child",
        summary: `**线性代数**研究向量与线性变换：神经网络的一次前向传播 \`h = Wx + b\` 就是矩阵乘法。

- 向量：数据点、特征
- 矩阵：线性变换、权重
- 特征值：变换的"不动轴"与伸缩比`,
        children: [
          {
            id: "eigenvector",
            term: "特征向量",
            kind: "child",
            summary: `**特征向量**（Eigenvector）：矩阵 \`A\` 作用后方向不变的向量，只被缩放：\`Av = λv\`，\`λ\` 是特征值。

- 主成分分析（PCA）找的就是协方差矩阵的特征向量
- 谱聚类、PageRank、量子力学都围绕特征分解展开

> 可以理解为"这个变换最本质的方向"。`,
          },
        ],
      },
      {
        id: "probability",
        term: "概率论",
        kind: "child",
        summary: `**概率论**度量不确定性：\`P(A)\` 表示事件 A 发生的可能性。

机器学习本质是概率推断——模型输出 \`P(答案 | 问题)\`；**贝叶斯定理**则是"看到数据后更新信念"的规则。`,
        children: [
          {
            id: "bayes-theorem",
            term: "贝叶斯定理",
            kind: "child",
            summary: `**贝叶斯定理**（Bayes' Theorem）：\`P(A|B) = P(B|A)·P(A) / P(B)\`。

- \`P(A)\`：先验（看到数据前的信念）
- \`P(A|B)\`：后验（看到数据后的信念）
- 垃圾邮件过滤、医学诊断、模型推断都在用它

> 一句话：用新证据更新旧信念。`,
          },
          {
            id: "law-of-large-numbers",
            term: "大数定律",
            kind: "related",
            summary: `**大数定律**（Law of Large Numbers）：试验次数越多，样本均值越趋近期望值：\`(X₁+…+Xₙ)/n → E[X]\`。

它是统计学的基石——为什么抽样调查能代表整体，为什么训练数据越多模型越稳。`,
          },
        ],
      },
      {
        id: "calculus",
        term: "微积分",
        kind: "child",
        summary: `**微积分**提供"变化"的语言：导数描述瞬时变化率，积分描述累积量。

机器学习只用其中一小部分——**求导**：因为"训练 = 沿梯度下山"，梯度就是损失函数对参数的导数向量。`,
        children: [
          {
            id: "gradient",
            term: "梯度",
            kind: "child",
            summary: `**梯度**（Gradient）是多元函数对每个变量求偏导组成的向量，指向函数**增长最快**的方向。

- 梯度下降：\`θ ← θ - η·∇L(θ)\`，沿负梯度"下山"
- 深度学习训练 = 反复计算损失对千万个参数的梯度

> 类比：浓雾里下山，每一步都朝最陡的方向迈。`,
          },
        ],
      },
    ],
  },
];

/** Look up a term anywhere in the tree (by display name). */
export function findTerm(name: string): TermNode | null {
  const walk = (nodes: TermNode[]): TermNode | null => {
    for (const n of nodes) {
      if (n.term === name) return n;
      const hit = n.children ? walk(n.children) : null;
      if (hit) return hit;
    }
    return null;
  };
  return walk(TERM_TREE);
}

/**
 * Built-in academic glossary (zh + en forms) used for document highlighting
 * and quick explanations. ~30 common terms across physics / CS / ML.
 */
export interface GlossaryEntry {
  en: string;
  zh: string;
  explain: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { en: "Quantum Entanglement", zh: "量子纠缠", explain: "多个粒子间无法独立描述的量子关联：测量一个粒子会瞬间影响另一个。" },
  { en: "Superposition", zh: "叠加态", explain: "量子系统同时处于多个经典状态的线性组合，直到被测量才塌缩为确定状态。" },
  { en: "Wavefunction Collapse", zh: "波函数坍缩", explain: "测量使量子系统的波函数收缩为单一确定状态的过程，瞬时且不可逆。" },
  { en: "Bell's Inequality", zh: "贝尔不等式", explain: "局域隐变量理论必须满足的统计约束；实验违反它证明量子非局域性。" },
  { en: "EPR Paradox", zh: "EPR 悖论", explain: "爱因斯坦等人质疑量子力学完备性的思想实验，后被贝尔实验裁决。" },
  { en: "Quantum Teleportation", zh: "量子隐形传态", explain: "利用纠缠与经典通信把未知量子态转移到另一个粒子上的协议。" },
  { en: "Decoherence", zh: "退相干", explain: "系统与环境相互作用导致量子相干性消失，解释了宏观世界的经典性。" },
  { en: "Hidden Variables", zh: "隐变量", explain: "假设量子概率背后存在确定参数的学说；局域版本已被实验排除。" },
  { en: "Bayes' Theorem", zh: "贝叶斯定理", explain: "根据新证据更新信念概率的公式：P(A|B) = P(B|A)·P(A)/P(B)。" },
  { en: "Gradient Descent", zh: "梯度下降", explain: "沿损失函数负梯度方向迭代更新参数以最小化损失的优化算法。" },
  { en: "Attention Mechanism", zh: "注意力机制", explain: "让模型根据相关性加权聚焦输入不同部分的机制，Transformer 的核心。" },
  { en: "Convolutional Neural Network", zh: "卷积神经网络", explain: "用卷积核提取局部特征的神经网络，图像处理的主力架构。" },
  { en: "Transformer", zh: "Transformer", explain: "基于自注意力机制的全序列并行架构，现代大语言模型的基础。" },
  { en: "Overfitting", zh: "过拟合", explain: "模型在训练数据上表现好但在新数据上泛化差的现象。" },
  { en: "Regularization", zh: "正则化", explain: "通过惩罚复杂度（如 L1/L2 范数）抑制过拟合的技术。" },
  { en: "Large Language Model", zh: "大语言模型", explain: "在海量文本上预训练、可生成与理解自然语言的巨规模神经网络。" },
  { en: "Embedding", zh: "嵌入", explain: "把词/实体映射为稠密向量，使语义相近的项在向量空间中靠近。" },
  { en: "Tensor", zh: "张量", explain: "多维数组的数学推广：标量、向量、矩阵都是特殊情形。" },
  { en: "Eigenvector", zh: "特征向量", explain: "线性变换下仅被缩放不改变方向的非零向量，对应特征值。" },
  { en: "Self-Supervised Learning", zh: "自监督学习", explain: "从数据自身构造监督信号（如掩码预测）进行预训练的学习范式。" },
  { en: "Reinforcement Learning", zh: "强化学习", explain: "智能体通过与环境试错互动、最大化累积奖励的学习框架。" },
  { en: "Markov Chain", zh: "马尔可夫链", explain: "状态转移只依赖当前状态（无记忆性）的随机过程模型。" },
  { en: "Entropy", zh: "熵", explain: "度量系统不确定性或信息量的概念：不确定性越高熵越大。" },
  { en: "Mutual Information", zh: "互信息", explain: "度量两个随机变量共享信息的量：I(X;Y) = H(X) - H(X|Y)。" },
  { en: "Likelihood Function", zh: "似然函数", explain: "给定参数下观测到当前数据的概率函数，极大似然估计最大化它。" },
  { en: "Maximum Likelihood Estimation", zh: "最大似然估计", explain: "选择使观测数据出现概率最大的参数的统计推断方法。" },
  { en: "Principal Component Analysis", zh: "主成分分析", explain: "通过正交变换把高维数据投影到方差最大的方向上的降维方法。" },
  { en: "Support Vector Machine", zh: "支持向量机", explain: "寻找最大化分类间隔超平面的监督学习模型。" },
  { en: "Clustering", zh: "聚类", explain: "无监督地把相似样本分组，使组内相似度最大、组间差异最大。" },
  { en: "Regression", zh: "回归", explain: "建模连续变量之间关系的统计方法（如线性回归）。" },
  { en: "Backpropagation", zh: "反向传播", explain: "通过链式法则从输出层向输入层逐层计算梯度以训练神经网络。" },
  { en: "Activation Function", zh: "激活函数", explain: "为神经网络引入非线性的函数（ReLU、Sigmoid、Tanh 等）。" },
  { en: "Tokenization", zh: "分词", explain: "把文本切分为模型处理的最小单元（token）的过程。" },
  { en: "Fine-tuning", zh: "微调", explain: "在预训练模型基础上用特定任务数据继续训练以适应目标任务。" },
  { en: "Semantic Segmentation", zh: "语义分割", explain: "对图像每个像素标注类别标签的计算机视觉任务。" },
  { en: "Supervised Learning", zh: "监督学习", explain: "用带标签数据（输入-期望输出对）训练模型的学习范式。" },
  { en: "Unsupervised Learning", zh: "无监督学习", explain: "在无标签数据中发现结构的学习范式，如聚类、降维。" },
  { en: "Classification", zh: "分类", explain: "把输入分到离散类别的监督学习任务，如垃圾邮件识别。" },
  { en: "Decision Tree", zh: "决策树", explain: "用一系列特征判断规则（if-else 树）做预测的可解释模型。" },
  { en: "Random Forest", zh: "随机森林", explain: "训练多棵决策树并投票集成，降低单棵树的过拟合与方差。" },
  { en: "K-Means", zh: "K均值聚类", explain: "把样本分成 K 簇的无监督算法：迭代地把每个点归到最近的簇中心。" },
  { en: "Loss Function", zh: "损失函数", explain: "度量模型预测与真实值的差距，训练就是最小化它。" },
  { en: "Learning Rate", zh: "学习率", explain: "梯度下降每次更新的步长 η；太大震荡不收敛，太小收敛极慢。" },
  { en: "Inference", zh: "推理", explain: "用训练好的模型对新输入做预测的过程（区别于训练）。" },
  { en: "Hallucination", zh: "幻觉", explain: "大模型生成看似合理但事实错误/虚构内容的现象。" },
  { en: "Prompt Engineering", zh: "提示词工程", explain: "设计输入提示词以引导大模型输出更准确结果的技巧。" },
  { en: "Chain of Thought", zh: "思维链", explain: "引导模型分步推理再作答的提示技巧，显著提升复杂推理表现。" },
  { en: "RAG", zh: "检索增强生成", explain: "先从外部知识库检索相关内容，再拼进提示让模型作答的架构。" },
  { en: "Derivative", zh: "导数", explain: "函数在某点的瞬时变化率，梯度下降的核心工具。" },
  { en: "Vector", zh: "向量", explain: "有大小和方向的对象；在 ML 中一个样本通常表示为一个向量。" },
  { en: "Matrix", zh: "矩阵", explain: "二维数组；神经网络的权重 W 就是矩阵，前向传播是矩阵乘法。" },
  { en: "Variance", zh: "方差", explain: "度量数据离散程度：与均值的平方偏差的平均。" },
  { en: "Central Limit Theorem", zh: "中心极限定理", explain: "大量独立随机变量的均值近似正态分布，与原始分布无关。" },
  { en: "Recursion", zh: "递归", explain: "函数调用自身解决问题的编程范式，配合基准条件终止。" },
  { en: "Dynamic Programming", zh: "动态规划", explain: "把问题拆成重叠子问题并缓存结果，避免重复计算的优化方法。" },
  { en: "Stack", zh: "栈", explain: "后进先出（LIFO）的数据结构；函数调用栈、撤销操作都靠它。" },
  { en: "Binary Tree", zh: "二叉树", explain: "每个节点最多两个子节点的树结构；二叉搜索树的查找为 O(log n)。" },
  { en: "Quicksort", zh: "快速排序", explain: "选基准分治排序，平均 O(n log n)，工程上最常用的排序算法。" },
  { en: "Hash Table", zh: "哈希表", explain: "键经哈希函数映射到桶下标，平均 O(1) 增删查的数据结构。" },
];

export function makeDemoProject(): ChatProject {
  return {
    id: "untitled-1",
    title: "Untitled",
    folder: null,
    cloud: false,
    createdAt: Date.now() - 3600_000,
    updatedAt: Date.now(),
    turns: [],
  };
}

export function makeDemoTurn(title: string): Turn {
  return {
    id: "turn-" + Math.random().toString(36).slice(2, 9),
    title,
    createdAt: Date.now(),
    messages: [],
    favorite: false,
  };
}

export const MINDSCAPE_EMPTY = {
  title: "Mindscape",
  paragraphs: [
    "这是你的思维宇宙，目前还没有思维节点。",
    "在对话中，你可以用自己的话描述对某个概念的理解。",
    "如果 AI 也认可，它就会把你的理解变成一颗思维节点，存入这里。",
  ],
};

export const EMPTY_THOUGHTS: ThoughtNode[] = [];

export function makeDemoDocument(name: string, kind: DocumentItem["kind"], content: string): DocumentItem {
  return { id: "doc-" + Math.random().toString(36).slice(2, 10), name, kind, content, addedAt: Date.now() };
}
