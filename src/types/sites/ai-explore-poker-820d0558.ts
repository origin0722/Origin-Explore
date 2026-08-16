/**
 * Explore — data model & UI state types (site: ai.explore.poker/chat)
 * Mock-data driven clone; no real backend.
 */

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  vision?: boolean;
}

/**
 * User-added BYOK model (bring-your-own-key). Extends ModelInfo with the
 * connection details; the API key never leaves the local machine (the browser
 * calls the provider endpoint directly).
 */
export interface ByokModel extends ModelInfo {
  /** OpenAI-compatible base URL, e.g. "https://api.deepseek.com/v1" */
  baseUrl: string;
  /** provider model id, e.g. "deepseek-chat" */
  modelId: string;
  apiKey: string;
}

/** BYOK 一键填充预设（OpenAI 兼容接口）。 */
export interface ModelPreset {
  name: string;
  provider: string;
  description: string;
  baseUrl: string;
  modelId: string;
  /** 多模态（支持图片输入）——设置里显示 Vision 徽章，视觉模式 auto 判定用 */
  vision?: boolean;
}

/** 对话中附加的图片（视觉模式）。
    thumbDataUrl 持久化（≤512px JPEG q0.75）；fullDataUrl 仅内存（≤1280px q0.8，落盘前剥离）。 */
export interface AttachedImage {
  id: string;
  name: string;
  mime: string;
  /** 缩略图 data URL（持久化） */
  thumbDataUrl: string;
  /** 原图降采样 data URL（仅内存，发送后剥离） */
  fullDataUrl?: string;
  width: number;
  height: number;
  /** SHA-256 内容哈希（视觉缓存 key） */
  hash: string;
}

export interface Project {
  id: string;
  title: string;
  folder?: string | null;
  cloud?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** term-linked expansion (child/related/branch cards) */
  linkedCards?: CardRef[];
  /** 视觉模式：本条消息附带的图片（持久化只含缩略图） */
  images?: AttachedImage[];
}

export interface CardRef {
  id: string;
  kind: "child" | "related" | "branch";
  title: string;
}

/** 轮次类型：root = 普通轮次 · branch = 分支卡片轮次 · diverge = 发散卡片轮次。
    发散卡片 = 关联想法的平行会话（不影响当前对话），树中与来源卡片同层、位于其右侧；
    分支卡片 = 继承上游分支点前的对话历史 + 上游卡片主题的平行分支。 */
export type TurnKind = "root" | "branch" | "diverge";

export interface Turn {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  favorite?: boolean;
  /** 未读（新回复到达时未在视野内）；轮次导航节点圆点 + 右键手动切换 */
  unread?: boolean;
  /** 轮次类型（缺省 = root，旧数据兼容） */
  kind?: TurnKind;
  /** 分支来源轮次 id（另起炉灶的上游）；缺省 = 顺序上一轮。用于轮次有向图 */
  parentTurnId?: string | null;
  /** 分支卡片：分支点下标——上游轮次 messages 中"这条消息之后"开始分叉。
      缺省 = 创建分支时上游轮次的最后一条消息下标。分割线画在该消息之后。 */
  branchPointIndex?: number;
  /** 分支卡片：上游分支点前对话的本地总结缓存（懒生成，summarizePreBranch 写入） */
  preBranchSummary?: string;
  /** 分支卡片：续问上下文缓存——创建时 = 分支点前的上游消息切片 + 深挖路径对话；
      调整分支点（setBranchPoint）时按新分支点重算 slice、保留 trail。
      sendInTurn 对分支卡用它作上下文（分割线位置 = 实际继承边界）。 */
  branchContext?: {
    /** 分支点前的上游消息（按 branchPointIndex 切片，调整分支点时重算） */
    slice: { role: string; content: string }[];
    /** 创建分支时的深挖路径对话（术语卡消息，调整分支点不变） */
    trail: { role: string; content: string }[];
  };
  /** 发散卡片：来源轮次 id（树中渲染在来源卡片节点右侧、同一层级） */
  divergeSourceId?: string;
  /** 发散卡片：来源锚点上下文（来源主题 + 术语所在段落）——追问时注入保持父语境，
      与 branchContext 对齐（发散对话的"持久化锚点"）。 */
  divergeContext?: {
    sourceTitle: string;
    anchorText?: string;
  };
  /** 本轮对话中点击过的术语卡片（探索路径），按点击顺序；
      parentTerm = 打开这张卡片时所在的父卡片术语（null = 从主对话点开） */
  explored?: { term: string; kind: TermKind; at: number; parentTerm: string | null }[];
}

export interface ChatProject extends Project {
  turns: Turn[];
  /** 常驻聊天标记：固定的跨项目会话，不可删除、不进项目列表 */
  resident?: boolean;
}

export interface ChatSettings {
  theme: string;
  language: "zh" | "en" | "tw";
  activeModelId: string;
  isWebSearchEnabled: boolean;
  autoCitationEnabled: boolean;
  autoTitleEnabled: boolean;
  autoTitleInterval: number;
  sendShortcut: "ctrl-enter" | "enter";
  uiZoom: number;
  /** 视觉模式：auto（按主模型能力判定）/ native（强制直传原图）/ router（强制视觉模型描述）/ off（禁用图片） */
  visionMode: "auto" | "native" | "router" | "off";
  /** 路由模式使用的视觉模型 id（须为 vision=true 的 BYOK 模型） */
  visionModelId: string | null;
}

/** Mindscape thought node (user-authored understanding, AI-validated) */
export interface ThoughtNode {
  id: string;
  subject: string;
  content: string;
  createdAt: number;
  category: string;
  /** pending = collected from chat/doc, awaiting mock AI validation */
  status?: "pending" | "validated";
  validatedAt?: number;
  /** 深挖来源（父术语 subject）；null/缺省 = 独立节点。用于思维宇宙的真实连线 */
  parentSubject?: string | null;
}

export interface ThemeOption {
  id: string;
  name: string;
}

/** Relationship of a term card to its parent card (recursive knowledge tree) */
export type TermKind = "child" | "related" | "branch" | "diverge";

export interface TermNode {
  id: string;
  term: string;
  /** relationship to the parent card the user clicked from */
  kind: TermKind;
  /** card content in markdown */
  summary: string;
  children?: TermNode[];
}

/** Local profile ("login" for a personal tool — data stays on device) */
export interface Profile {
  name: string;
  email: string;
  avatarColor: string;
}

export type DocKind = "pdf" | "docx" | "md" | "txt" | "html";

export interface DocumentItem {
  id: string;
  name: string;
  kind: DocKind;
  /** extracted plain text (client-side parsing only) */
  content: string;
  /** AI 解读缓存：理解内容 → 语义分块 + 翻译 + 格式工整后的 markdown
      （BYOK 流式生成）。有值 = 已解读。 */
  interpreted?: string;
  interpretedAt?: number;
  addedAt: number;
}

/** Personalized per-term understanding state ("越来越懂用户") */
export type TermState = "unseen" | "asked" | "mastered";

/** 个人记忆条目：AI 应记住的"关于我"的事实。
    source = manual（用户在设置里手动添加）/ auto（系统从档案/掌握度/概念自动汇总）。 */
export interface MemoryItem {
  id: string;
  text: string;
  /** 可选分类：职业 / 兴趣 / 背景 / 其他 */
  category?: string;
  source: "manual" | "auto";
  createdAt: number;
}

export interface UIState {
  isLeftPanelCollapsed: boolean;
  activeProjectId: string | null;
  mindscapeOpen: boolean;
  onboardingDone: boolean;
}

/** 全量备份包（导出/导入：所有项目 + 思维宇宙 + 文档 + 术语状态 + 文件夹 + 档案 + 记忆 + 设置）。
    与旧的"项目级"导出（{ title, turns }）并存：导入时两种格式都识别。 */
export interface BackupEnvelope {
  app: "explore-backup";
  version: 1;
  exportedAt: number;
  data: {
    projects: ChatProject[];
    thoughtNodes: ThoughtNode[];
    termStates: Record<string, TermState>;
    documents: DocumentItem[];
    folders: string[];
    profile: Profile | null;
    memories?: MemoryItem[];
    settings: ChatSettings;
  };
}
