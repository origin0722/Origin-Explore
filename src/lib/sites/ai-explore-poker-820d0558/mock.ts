/**
 * Explore — mock data (site: ai.explore.poker/chat)
 * Content is freely adapted; structure mirrors the live site.
 * Personal tool: no subscription, all models unlocked, zh-only UI.
 */
import type {
  ChatProject,
  ChatSettings,
  DocumentItem,
  ModelInfo,
  TermNode,
  ThemeOption,
  ThoughtNode,
  Turn,
} from "@/types/sites/ai-explore-poker-820d0558";

export const MODELS: ModelInfo[] = [
  { id: "builtin:aiping/deepseek-v4-flash-0731/chat", name: "deepseek-v4-flash-0731", provider: "AIPing", description: "Built-in model", tier: "free", multiplier: "×0.3" },
  { id: "builtin:aiping/deepseek-v4-flash-0731/reasoner", name: "deepseek-v4-flash-0731", provider: "AIPing", description: "Built-in reasoning model", tier: "free", multiplier: "×0.3" },
  { id: "builtin:aiping/Step-3.5-Flash", name: "Step-3.5-Flash", provider: "AIPing", description: "Enough for simple tasks", tier: "free", multiplier: "×0.2" },
  { id: "builtin:tencent-tokenhub/qwen3.5-flash/chat", name: "qwen3.5-flash", provider: "Tencent TokenHub", description: "Vision-capable chat model", tier: "free", multiplier: "×0.2", vision: true },
  { id: "builtin:tencent-tokenhub/qwen3.5-flash/reasoner", name: "qwen3.5-flash", provider: "Tencent TokenHub", description: "Vision-capable reasoning model", tier: "free", multiplier: "×0.2", vision: true },
  { id: "builtin:grok/grok-4.5", name: "grok-4.5", provider: "Grok / xAI", description: "Good for most STEM tasks & coding", tier: "pro", multiplier: "×4.7" },
  { id: "builtin:grok/grok-4.6", name: "grok-4.6", provider: "Grok / xAI", description: "Good for most STEM tasks", tier: "pro", multiplier: "×4.7" },
  { id: "builtin:tencent-tokenhub/kimi-k3", name: "kimi-k3", provider: "Tencent TokenHub", description: "Just a little less knowledgeable than Gemini, but better at coding", tier: "max", multiplier: "×10.0", vision: true },
  { id: "builtin:zenmux/openai-gpt-5.6-sol", name: "openai/gpt-5.6-sol", provider: "ZenMux", description: "Frontier solver model", tier: "max", multiplier: "×20.4", vision: true },
];

export const THEMES: ThemeOption[] = [
  { id: "default", name: "Default (暗色)" },
  { id: "warm", name: "Warm (温暖)" },
  { id: "midnight-forest", name: "Midnight Forest (午夜深林)" },
  { id: "sakura", name: "Sakura (樱花)" },
  { id: "memphis", name: "Memphis (孟菲斯)" },
  { id: "sunset", name: "Sunset (晚霞)" },
  { id: "default-purple", name: "Default-Purple (暗蓝)" },
  { id: "default-blue", name: "Default-Blue (暗橙)" },
  { id: "default-orange", name: "Default-Orange" },
];

/** settings.theme stores the theme *name*; map it to a data-theme key. */
export function themeId(name: string): string {
  return THEMES.find((t) => t.name === name)?.id ?? "default";
}

/** Palettes currently implemented in globals.css ([data-theme=…] blocks). */
export function isThemeImplemented(name: string): boolean {
  const id = themeId(name);
  return id === "default" || id === "midnight-forest";
}

export const DEFAULT_SETTINGS: ChatSettings = {
  theme: "Default (暗色)",
  language: "zh",
  activeModelId: "builtin:aiping/deepseek-v4-flash-0731/chat",
  isWebSearchEnabled: false,
  autoCitationEnabled: true,
  autoTitleInterval: 5,
  autoTitleEnabled: true,
  sendShortcut: "ctrl-enter",
  uiZoom: 1,
};

/** A demo conversation used to showcase the knowledge-tree card (mock AI reply). */
export const MOCK_REPLY_MARKDOWN = `好的，我们来一步步拆解 **量子纠缠**。

## 核心概念

量子纠缠是指两个或多个粒子之间形成的一种**不可分割的关联**：
无论它们相距多远，对其中一个粒子的测量会瞬间影响另一个粒子的状态。

> 这并非信息传递，而是整体性的体现 —— 纠缠系统不能拆成独立的部分来描述。

### 需要理解的关键术语

1. **叠加态**（Superposition）：粒子同时处于多种状态，直到被测量
2. **波函数坍缩**（Wavefunction Collapse）：测量使叠加态"选择"一个确定结果
3. **贝尔不等式**（Bell's Inequality）：区分量子纠缠与经典隐变量的实验判据
4. **EPR 悖论**（EPR Paradox）：爱因斯坦等人质疑量子力学完备性的思想实验
5. **量子隐形传态**（Quantum Teleportation）：利用纠缠实现信息传输的协议

> 点击任意术语，我可以为你展开更详细的解释卡片。`;

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

/** Generic fallback explanation for terms not in the tree (doc reader etc.). */
export function genericTermSummary(term: string): string {
  return `关于 **${term}**\n\n这是你在阅读中遇到的一个概念。当前处于离线演示模式，内置词典还没有收录它的详细解释。\n\n> 接入 BYOK 模型后，我可以为你生成针对这个概念的完整讲解卡片。你也可以先在对话里追问它，或用自己的话描述你的理解，把它收录进思维宇宙。`;
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
