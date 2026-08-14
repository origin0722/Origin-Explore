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
}

export interface CardRef {
  id: string;
  kind: "child" | "related" | "branch";
  title: string;
}

export interface Turn {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  favorite?: boolean;
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
}

export interface ThemeOption {
  id: string;
  name: string;
}

/** Relationship of a term card to its parent card (recursive knowledge tree) */
export type TermKind = "child" | "related" | "branch";

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
  addedAt: number;
}

/** Personalized per-term understanding state ("越来越懂用户") */
export type TermState = "unseen" | "asked" | "mastered";

export interface UIState {
  isLeftPanelCollapsed: boolean;
  activeProjectId: string | null;
  mindscapeOpen: boolean;
  onboardingDone: boolean;
}
