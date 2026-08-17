"use client";

/**
 * Explore — global app state (site: ai.explore.poker/chat clone)
 * Contract hub: every component imports { useApp } from this file.
 * Personal tool: everything persists to localStorage (no backend).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AttachedImage,
  BackupEnvelope,
  ByokModel,
  ChatProject,
  ChatSettings,
  DocumentItem,
  MemoryItem,
  Message,
  Profile,
  StackItem,
  TermKind,
  TermNode,
  TermState,
  ThoughtNode,
  Turn,
} from "@/types/sites/ai-explore-poker-820d0558";
import {
  DEFAULT_SETTINGS,
  GLOSSARY,
  makeDemoProject,
  makeDemoTurn,
  TERM_TREE,
  THEME_META_COLORS,
  themeId,
} from "@/lib/sites/ai-explore-poker-820d0558/mock";
import type { WireContent } from "@/lib/sites/ai-explore-poker-820d0558/vision";
import {
  decideVision,
  describeImage,
  getVisionCache,
  toNativeParts,
  toRouterText,
  type VisionDecision,
} from "@/lib/sites/ai-explore-poker-820d0558/vision";

/**
 * OpenAI 兼容的 chat/completions 流式调用（`stream: true` + SSE，浏览器直连，密钥不落盘到服务器）。
 * 逐 delta 回调 `onDelta`；首个增量到达时触发 `onFirst`（用于解除"首字超时"）。
 * 少数网关忽略 stream:true 仍返回整段 JSON -> 按整体输出兜底。
 * 导出给卡片内对话（chat-card）复用。
 */
export async function streamOpenAICompatible(
  byok: ByokModel,
  messages: { role: string; content: string | WireContent[] }[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
  onFirst?: () => void
): Promise<void> {
  const url = byok.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${byok.apiKey}`,
    },
    body: JSON.stringify({ model: byok.modelId, messages, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // 解析一行 SSE data -> 取 delta.content；心跳/半包静默跳过。
  const handleLine = (line: string, state: { received: boolean }) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (payload === "[DONE]") return;
    let delta: unknown;
    try {
      delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
    } catch {
      return;
    }
    if (typeof delta === "string" && delta) {
      if (!state.received) {
        state.received = true;
        onFirst?.();
      }
      onDelta(delta);
    }
  };

  const ctype = res.headers.get("content-type") ?? "";
  if (!res.body || ctype.includes("application/json")) {
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("空响应");
    handleLine("data: " + JSON.stringify({ choices: [{ delta: { content: text.trim() } }] }), { received: false });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const state = { received: false };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) handleLine(line, state);
  }
  if (buf) handleLine(buf, state);
  if (!state.received) throw new Error("空响应");
}

export interface AppState {
  settings: ChatSettings;
  setSettings(partial: Partial<ChatSettings>): void;
  projects: ChatProject[];
  activeProjectId: string | null;
  /** 新建项目（folder = 目标文件夹名；null/缺省 = 本地项目组）。返回新项目 id（供定位）。 */
  createProject(folder?: string | null): string;
  selectProject(id: string): void;
  /** 打开常驻聊天（跨项目保留的会话）。 */
  selectResident(): void;
  deleteProject(id: string): void;
  renameProject(id: string, name: string): void;
  /** 项目文件夹（分组） */
  folders: string[];
  createFolder(name: string): void;
  removeFolder(name: string): void;
  moveProjectToFolder(id: string, folder: string | null): void;
  /** 常驻聊天 AI 智能模式开关 */
  smartMode: boolean;
  toggleSmartMode(): void;
  /** 导入一个项目（导出/导入为 JSON） */
  importProject(data: { title?: string; turns?: Turn[] }): void;
  /** 全量备份：导出所有数据（项目+思维宇宙+文档+术语状态+文件夹+档案+设置）为单个 JSON 文件并下载；
      includeKeys=true 时额外包含 BYOK 模型（含 API Key），备份包标记 keysIncluded。 */
  exportBackup(includeKeys?: boolean): void;
  /** 全量恢复/导入：识别新版备份包（按 id 合并、备份胜出）与旧版项目文件（{ title, turns }）；
      返回 { ok, message } 供 UI 提示 */
  importBackup(parsed: unknown): { ok: boolean; message: string };
  /** 用户自带的 BYOK 模型（密钥仅存本机）；返回是否添加成功（同名已存在时 false） */
  byokModels: ByokModel[];
  addByokModel(input: { name: string; baseUrl: string; modelId: string; apiKey: string; vision?: boolean }): boolean;
  /** 更新一个 BYOK 模型（名称/地址/Key/模型 ID/视觉标记）；返回是否成功（改名后与其它模型重名时 false）。
      名称变化导致 id 变化时，默认模型/视觉模型的选中引用同步迁移。 */
  updateByokModel(
    id: string,
    input: { name: string; baseUrl: string; modelId: string; apiKey: string; vision?: boolean }
  ): boolean;
  /** 删除一个 BYOK 模型；若删除的是当前默认模型，清除选中（由用户重新配置）。 */
  removeByokModel(id: string): void;
  /** 标记引导已完成（随持久化通道落盘：桌面版写文件、浏览器写 localStorage）。 */
  markOnboarded(): void;
  collapsed: boolean;
  toggleSidebar(): void;
  mindscapeOpen: boolean;
  setMindscapeOpen(v: boolean): void;
  modals: { settings: boolean; onboarding: boolean; login: boolean; docs: boolean };
  openModal(k: keyof AppState["modals"]): void;
  closeModal(k: keyof AppState["modals"]): void;
  /** 选中 AI 回复文本 → 引用（InputArea 消费后清空） */
  pendingQuote: string | null;
  setPendingQuote(q: string | null): void;
  turns: Turn[];
  activeTurn: Turn | null;
  sendMessage(text: string, images?: AttachedImage[]): void;
  /** 平行视图发送目标：当前聚焦的发散轮次 id（null = 发往主对话流）。
      ChatCard 在平行视图聚焦发散卡时设置；InputArea 据此把消息顺延进该平行对话。 */
  parallelSendTarget: string | null;
  setParallelSendTarget(id: string | null): void;
  /** 卡片树聚焦：当前聚焦卡片 id + 平行组来源 id（groupSourceId = null 表示主流视图）。
      ChatCard 视图切换时同步；TurnGraph 据此高亮当前卡片/平行组并滚动到可见。 */
  treeFocus: { cardId: string; groupSourceId: string | null } | null;
  setTreeFocus(f: { cardId: string; groupSourceId: string | null } | null): void;
  /** 文档段落视图底部提问：基于文档内容问 AI（自动建/复用「论文：xxx」项目 + 新 turn），
      切回对话视图看回答。文档全文注入上下文（截断），让 AI 真正基于文件内容解读。 */
  sendDocQuestion(text: string): void;
  /** AI 解读文档：理解内容 → 语义分块 + 双语对照 + 格式工整（markdown）。
      BYOK 流式生成（边生成边在解读视图浮现），失败明确提示；结果缓存到 doc.interpreted。
      force = 忽略已有缓存，重新解读。 */
  interpretDocument(docId: string, force?: boolean): void;
  /** 正在 AI 解读的文档 id 列表（支持并发解读多个文档） */
  docInterpretingIds: string[];
  /** 在指定轮次内继续提问（消息级顺延）：平行对话是独立线程，
      继续在发散卡片下方对话，而不是弹回主对话流。 */
  sendInTurn(turnId: string, text: string, images?: AttachedImage[]): void;
  busy: boolean;
  /** 主对话流（root 轮次）是否在流式——主输入框守卫用（发散卡流式不影响主输入） */
  mainBusy: boolean;
  /** 指定轮次是否在流式（线程级输入锁） */
  isTurnBusy(id: string): boolean;
  /** 停止所有进行中的流式生成（AbortController 贯通） */
  stopStreaming(): void;
  /** 停止指定轮次的流式生成（分目标停止） */
  stopTurn(id: string): void;
  /** 把外部流式请求注册进全局停止表（key 与 stopTurn/stopStreaming 对齐）；
      返回注销函数（流结束/失败时调用；已注销的 controller 不再被 stop 遍历到）。 */
  registerStreamController(key: string, controller: AbortController): () => void;
  /** 当前流式回复的目标轮次 id（null = 无流式；并发时 = 最近启动者）。
      ChatCard 用它做贴底跟随与未读判定，而非假设目标 = 最后一个 turn。 */
  streamingTurnId: string | null;
  /** 分支卡片 → 在当前项目开新 turn（继承上游卡片主题与分支点之前的对话历史，走双通道）；
      sourceTurnId = 发起分支的轮次（有向图边 + parentTurnId）；新 turn 记为 kind="branch"，
      branchPointIndex 默认 = 创建时上游轮次最后一条消息的下标（分割线画在该消息之后）。
      去重：同一 sourceTurnId + 同一标题的分支卡片已存在时复用。
      返回 { id, created }：created=false 表示复用已有卡片。 */
  openBranchTurn(
    title: string,
    history?: { role: string; content: string }[],
    sourceTurnId?: string
  ): { id: string; created: boolean };
  /** 发散卡片 → 在当前项目开新 turn 作为平行会话（kind="diverge"，divergeSourceId=来源轮次）。
      与分支卡片不同：不继承上游完整历史，但携带来源锚点上下文（来源主题 + 术语所在段落），
      让平行会话知道术语的来源语境（如"工业革命语境下的煤炭"）；不打断当前对话——调用方保留卡片栈。
      去重：同一 divergeSourceId + 同一标题的发散卡片已存在时复用。
      返回 { id, created }：created=false 表示复用已有卡片。 */
  openDivergeTurn(
    title: string,
    sourceTurnId: string,
    anchor?: { sourceTitle: string; anchorText?: string }
  ): { id: string; created: boolean };
  /** 调整分支卡片的分支点（上游轮次 messages 下标；分割线画在该消息之后） */
  setBranchPoint(turnId: string, index: number): void;
  /** 生成并缓存分支卡片"分支点前上游对话"的总结（启发式，写入 turn.preBranchSummary） */
  summarizePreBranch(turnId: string): void;
  /** 本地档案（"登录"） */
  profile: Profile | null;
  setProfile(p: Profile | null): void;
  /** 个人记忆（"关于我"的事实，AI 回答时参考；手动添加 + 自动汇总） */
  memories: MemoryItem[];
  addMemory(text: string, category?: string): void;
  removeMemory(id: string): void;
  /** 个人记忆注入用的 system 提示（无记忆时为 null）；所有对话/卡片内提问共用 */
  memorySystemPrompt: string | null;
  /** 术语卡片栈（持久化：刷新/切视图不丢；busy 为 UI 态不落盘） */
  termStack: StackItem[];
  setTermStack(s: StackItem[] | ((prev: StackItem[]) => StackItem[])): void;
  /** 思维宇宙节点 */
  thoughtNodes: ThoughtNode[];
  /** 从对话/文档收录：pending 状态，待面板验证 */
  addThoughtNode(subject: string, content: string, category?: string, parentSubject?: string | null): void;
  /** 记录某轮对话里点击过的术语卡片（探索路径，按轮次划分）；
      parentTerm = 打开时所在的父卡片术语（主对话点开为 null） */
  recordExploration(turnId: string, term: string, kind: TermKind, parentTerm?: string | null): void;
  /** 轮次未读标记（导航节点圆点；右键手动切换，点击节点/跳转清除） */
  setTurnUnread(turnId: string, unread: boolean): void;
  /** 收藏/取消收藏轮次（收藏区 + 智能摘要） */
  toggleFavorite(turnId: string): void;
  /** 删除一张轮次卡片：级联删除其分支（parentTurnId 指向它）与发散卡（divergeSourceId 指向它）
      及其子树；同时清理视图引用（平行发送目标/树聚焦指向被删卡时重置）。 */
  removeTurn(turnId: string): void;
  /** 清空常驻聊天的全部轮次（常驻聊天不可删除项目，清空是唯一重置手段） */
  clearResidentChat(): void;
  /** 跳转到某个轮次（切换项目 + 主对话滑动聚焦该轮次） */
  focusTurn(projectId: string, turnId: string): void;
  /** ChatCard 消费 focusTurn 后的清理 */
  clearFocusRequest(): void;
  focusRequest: { turnId: string; seq: number } | null;
  /** 轮次导航图点击卡片节点 → 重新打开该术语卡片（不重复记录探索路径） */
  cardOpenRequest: { turnId: string; term: string; seq: number } | null;
  requestCardOpen(turnId: string, term: string): void;
  clearCardOpenRequest(): void;
  /** 智能摘要缓存（turnId → markdown 摘要） */
  turnSummaries: Record<string, string>;
  /** 正在生成摘要的轮次 id */
  summarizingTurnId: string | null;
  /** 收藏区"智能摘要"：BYOK 走真实 API 流式生成，否则本地启发式摘要 */
  summarizeTurn(turnId: string): void;
  /** mock AI 验证通过 */
  validateThoughtNode(id: string): void;
  removeThoughtNode(id: string): void;
  /** 个人理解度状态（"越来越懂用户"） */
  termStates: Record<string, TermState>;
  markTermState(term: string, state: TermState): void;
  /** 本地文档库 */
  documents: DocumentItem[];
  addDocument(doc: DocumentItem): void;
  removeDocument(id: string): void;
  activeDocId: string | null;
  setActiveDocId(id: string | null): void;
  /** 文档里问术语 → 自动建同名项目 + 新 turn（mock AI 回复取自术语树；文档全文注入上下文） */
  openDocQuestion(term: string, docId: string): void;
  /** 文档解读块/段落 → 分支卡片：在「论文：xxx」项目中开分支，来源 = 该项目最新轮次（无则建上下文轮次） */
  openDocBranch(title: string, block: string, docName: string): { id: string; created: boolean };
  /** 文档解读块/段落 → 发散卡片：锚点 = 文档名 + 块文本（同上项目/来源规则） */
  openDocDiverge(title: string, block: string, docName: string): { id: string; created: boolean };
  universeOpen: boolean;
  setUniverseOpen(v: boolean): void;
  /** 全局轻提示（底部 toast）：无 API / 请求失败等状态反馈 */
  appNotice: string | null;
  setAppNotice(v: string | null): void;
  /** 更新检查结果（null = 尚未检查/检查失败）。启动时自动检查 + 周期复查；
      「设置 → 关于 → 检查更新」也调用 refreshUpdateInfo。 */
  updateInfo: UpdateInfo | null;
  refreshUpdateInfo(): Promise<boolean>;
}

/** /api/version 返回的更新检查结果 */
export interface UpdateInfo {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
}

const AppContext = createContext<AppState | null>(null);

const uid = () => "id-" + Math.random().toString(36).slice(2, 10);
const isDesktop = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;

const STORAGE_KEY = "explore-state-v1";

/** 常驻聊天的固定项目 id（跨项目保留的会话）。 */
const RESIDENT_CHAT_ID = "resident";

interface PersistedState {
  settings?: ChatSettings;
  projects?: ChatProject[];
  activeProjectId?: string | null;
  thoughtNodes?: ThoughtNode[];
  termStates?: Record<string, TermState>;
  profile?: Profile | null;
  memories?: MemoryItem[];
  termStack?: StackItem[];
  documents?: DocumentItem[];
  folders?: string[];
  smartMode?: boolean;
  byokModels?: ByokModel[];
  /** 引导是否已完成（桌面版随数据文件持久化，避免端口/升级后重复弹引导） */
  onboarded?: boolean;
}

/** 桌面端桥接面（Electron preload 注入；浏览器/dev 模式不存在 → null）。
    readState 同步（boot 时一次），writeState 异步（防抖保存）。
    getAppInfo/openUserData 仅设置页用（可选）。 */
interface ExploreDesktopBridge {
  readState(): string | null;
  writeState(json: string): Promise<boolean>;
  getAppInfo?(): Promise<{ version: string; userData: string }>;
  openUserData?(): Promise<void>;
}

/** 仅当 readState/writeState 都可用时视为桌面桥（浏览器/dev 无此接口 → null） */
function desktopBridge(): Pick<ExploreDesktopBridge, "readState" | "writeState"> | null {
  if (typeof window === "undefined") return null;
  const b = (window as unknown as { exploreDesktop?: ExploreDesktopBridge }).exploreDesktop;
  return b && typeof b.readState === "function" && typeof b.writeState === "function"
    ? b
    : null;
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return {};
  // 桌面版：优先读持久化数据文件（文件存在且有内容 → 用文件）。
  // 文件不存在/损坏/超大 → 回落 localStorage 播种（老用户免费迁移：首次防抖保存即写入文件）。
  const bridge = desktopBridge();
  if (bridge) {
    try {
      const raw = bridge.readState();
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (typeof parsed === "object" && parsed !== null) return parsed;
      }
    } catch {
      /* 文件损坏/不可读 → 回落 localStorage */
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedState;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** 术语卡栈落盘/恢复的净化：busy 置 false、messages 补 id、过滤无 node 的项。 */
function sanitizeTermStack(stack: StackItem[] | undefined, projects: ChatProject[]): StackItem[] {
  if (!Array.isArray(stack)) return [];
  const knownTurnIds = new Set(projects.flatMap((p) => p.turns.map((t) => t.id)));
  const out: StackItem[] = [];
  for (const item of stack) {
    if (!item || typeof item !== "object" || !item.node || !item.key) continue;
    // 来源轮次已不存在（导入旧备份/数据异常）→ 丢弃整个栈（引导安全守卫）
    if (item.sourceTurnId && !knownTurnIds.has(item.sourceTurnId)) return [];
    out.push({
      ...item,
      busy: false,
      messages: Array.isArray(item.messages)
        ? item.messages.map((m) => ({ ...m, id: m.id || uid() }))
        : [],
    });
  }
  return out;
}

/** 分支卡片"分支点前对话"总结：上游主题 + 分支点 + 涉及术语 + 逐条陈述（消息截断）。
    纯本地启发式，无 API 依赖；BYOK 用户的深总结可后续走 summarizeTurn 那套流式。 */
function buildPreBranchSummary(
  sourceTitle: string,
  branchTitle: string,
  messages: Message[]
): string {
  const terms = new Set<string>();
  const walk = (nodes: TermNode[]) => {
    for (const n of nodes) {
      terms.add(n.term);
      if (n.children) walk(n.children);
    }
  };
  walk(TERM_TREE);
  for (const g of GLOSSARY) {
    terms.add(g.zh);
  }
  const joined = messages.map((m) => m.content).join(" ");
  const hits = [...terms]
    .filter((t) => t.length >= 2 && joined.includes(t))
    .slice(0, 6);
  const lines = messages.map((m, i) => {
    const who = m.role === "user" ? "我" : "AI";
    const text = m.content.replace(/^>\s?/gm, "").replace(/\s+/g, " ").trim();
    return `${i + 1}. **${who}**：${text.slice(0, 110)}${text.length > 110 ? "…" : ""}`;
  });
  return [
    `📌 上游主题：「${sourceTitle}」`,
    `⛓ 分支点：从这里分出「${branchTitle}」分支（上游对话共 ${messages.length} 条消息）`,
    hits.length ? `🔑 涉及术语：${hits.join("、")}` : "🔑 涉及术语：无",
    `📝 分条陈述：\n${lines.join("\n")}`,
  ].join("\n");
}

/** 发散卡片提示词：携带来源锚点上下文（来源主题 + 术语所在段落）。
    平行会话"不继承上游完整历史"，但必须知道术语的来源语境——
    例如「煤炭」源自「工业革命」对话，模型才能讲出"工业革命语境下的煤炭"，
    而不是泛泛介绍。无锚点时回退到旧提示。 */
function buildDivergePrompt(
  title: string,
  anchor?: { sourceTitle: string; anchorText?: string }
): string {
  if (!anchor?.sourceTitle) {
    return `发散卡片：以「${title}」为主题开一个平行会话（不打断当前对话）。请给出与当前主题相关但独立成篇的讲解，用中文回答，重要术语用 **加粗** 标记，方便继续深挖。`;
  }
  const origin = `该话题源自对话「${anchor.sourceTitle}」`;
  const quote = anchor.anchorText ? `，其中提到：「${anchor.anchorText}」` : "";
  return (
    `发散卡片：以「${title}」为主题开一个平行会话（不打断当前对话）。` +
    `${origin}${quote}。请结合这一语境，讲解「${title}」——` +
    `回答应与来源对话相关（讲清「${title}」在「${anchor.sourceTitle}」语境中的角色与关系），` +
    `但独立成篇、自成体系，用中文回答，重要术语用 **加粗** 标记，方便继续深挖。` +
    `仅依据上述语境与你的知识作答，来源中未提到的内容不要虚构。`
  );
}

/** 智能模式个性化上下文（常驻聊天专属，deliverReply 消费）：
    用户档案称呼 + 思维宇宙已收录概念 + 术语掌握度（已掌握/曾提问）。
    返回 BYOK system 提示；无任何个性化数据时返回 null（不注入）。 */
/** 构建"个人记忆"上下文：手动记忆 + 档案称呼 + 思维宇宙概念 + 术语掌握度。
    注入所有对话（不再限于常驻聊天/智能模式）；无任何记忆时返回 null。 */
function buildMemoryContext(
  profile: Profile | null,
  memories: MemoryItem[],
  thoughtNodes: ThoughtNode[],
  termStates: Record<string, TermState>
): { system: string } | null {
  const mastered = Object.entries(termStates)
    .filter(([, s]) => s === "mastered")
    .map(([t]) => t);
  const asked = Object.entries(termStates)
    .filter(([, s]) => s === "asked")
    .map(([t]) => t);
  const concepts = thoughtNodes
    .filter((n) => n.status !== "pending")
    .slice(0, 8)
    .map((n) => n.subject);
  const manual = memories.filter((m) => m.source === "manual").map((m) => m.text);
  const name = profile?.name;
  if (!name && mastered.length === 0 && asked.length === 0 && concepts.length === 0 && manual.length === 0) {
    return null;
  }
  const lines: string[] = [];
  if (name) lines.push(`- 用户称呼：${name}`);
  if (manual.length) lines.push(`- 用户告诉过你的关于自己的事：${manual.slice(0, 12).join("；")}`);
  if (concepts.length) lines.push(`- 用户思维宇宙已收录概念：${concepts.join("、")}`);
  if (mastered.length) lines.push(`- 用户已掌握术语：${mastered.slice(0, 8).join("、")}`);
  if (asked.length) lines.push(`- 用户曾提问术语：${asked.slice(0, 8).join("、")}`);
  const system =
    `以下是你对用户的了解（个人记忆，来自用户本机）：\n` +
    lines.join("\n") +
    `\n回答时自然地参考这些信息：可用用户已掌握的概念作类比、回顾用户曾提问的术语、贴合用户告诉你的背景；不要编造记忆之外的信息。`;
  return { system };
}

/** 智能模式尾部注记（仅常驻聊天 + smartMode 开启时附在回复末尾）。
    与全局记忆（system 注入）解耦：记忆对所有对话生效，注记是常驻聊天的额外提示。 */
function buildSmartNote(
  profile: Profile | null,
  thoughtNodes: ThoughtNode[],
  termStates: Record<string, TermState>
): string {
  const mastered = Object.entries(termStates)
    .filter(([, s]) => s === "mastered")
    .map(([t]) => t);
  const asked = Object.entries(termStates)
    .filter(([, s]) => s === "asked")
    .map(([t]) => t);
  const concepts = thoughtNodes
    .filter((n) => n.status !== "pending")
    .slice(0, 6)
    .map((n) => n.subject);
  const parts: string[] = [];
  if (mastered.length) parts.push(`你已掌握：${mastered.slice(0, 6).join("、")}`);
  if (concepts.length) parts.push(`思维宇宙已收录：${concepts.slice(0, 4).join("、")}`);
  let note = `\n\n---\n🧠 智能模式：`;
  if (parts.length) note += `${parts.join("；")}。`;
  if (asked.length) note += `你曾问过「${asked[0]}」，可以再展开深挖。`;
  note += `我会结合你的探索档案继续为你讲解。`;
  return note;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 联网搜索（经 /api/search 服务端代理，避免 CORS）；失败/超时返回空数组——前端静默降级。 */
async function webSearch(query: string): Promise<SearchResult[]> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
    });
    window.clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: SearchResult[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const boot = useMemo(loadState, []);

  const [settings, setSettingsState] = useState<ChatSettings>({
    ...DEFAULT_SETTINGS,
    ...boot.settings,
  });
  // 常驻聊天：固定项目（不可删、不进列表），首次启动自动创建。
  const [projects, setProjects] = useState<ChatProject[]>(() => {
    const list = boot.projects?.length ? boot.projects : [makeDemoProject()];
    return list.some((p) => p.resident)
      ? list
      : [{ ...makeDemoProject(), id: RESIDENT_CHAT_ID, title: "常驻聊天", resident: true }, ...list];
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    boot.activeProjectId ?? null
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mindscapeOpen, setMindscapeOpen] = useState(false);
  const [universeOpen, setUniverseOpen] = useState(false);
  /** 全局轻提示（底部 toast）：无 API / 请求失败等状态反馈 */
  const [appNotice, setAppNotice] = useState<string | null>(null);
  /** 更新检查结果（null = 未检查/失败）——侧边栏「设置」红点 + 设置页「关于」共用 */
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  /** 查一次 /api/version（服务端代理 GitHub，5 分钟缓存）；失败返回 false 供 UI 提示 */
  const refreshUpdateInfo = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/version");
      if (!res.ok) return false;
      const info = (await res.json()) as UpdateInfo;
      setUpdateInfo(info);
      return true;
    } catch {
      /* 离线/服务不可达：保留上次结果，下个周期再试 */
      return false;
    }
  }, []);

  // 启动自动检查 + 每 10 分钟复查一次（有新版即冒红点提醒升级）
  useEffect(() => {
    refreshUpdateInfo();
    const t = window.setInterval(refreshUpdateInfo, 10 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [refreshUpdateInfo]);
  const [modals, setModals] = useState<AppState["modals"]>({
    settings: false,
    onboarding: false,
    login: false,
    docs: false,
  });
  // 线程级 busy：按轮次（key = turnId）记录流式中的目标——
  // 主流式期间发散卡/分支卡可继续输入（全局锁改线程级）。
  const [busyTurnIds, setBusyTurnIds] = useState<string[]>([]);
  /** 全局 busy（任一线程流式中）——流式动画抑制/未读下降沿检测用 */
  const busy = busyTurnIds.length > 0;
  const markBusy = useCallback(
    (key: string) => setBusyTurnIds((l) => (l.includes(key) ? l : [...l, key])),
    []
  );
  const markIdle = useCallback(
    (key: string) => setBusyTurnIds((l) => l.filter((k) => k !== key)),
    []
  );
  /** 活跃流式请求：key(turnId) → AbortController 集合（分目标停止） */
  const activeControllersRef = useRef<Map<string, Set<AbortController>>>(new Map());
  const stopTurn = useCallback((key: string) => {
    const set = activeControllersRef.current.get(key);
    if (set) {
      for (const c of set) c.abort();
      activeControllersRef.current.delete(key);
    }
  }, []);
  const stopStreaming = useCallback(() => {
    for (const set of activeControllersRef.current.values()) {
      for (const c of set) c.abort();
    }
    activeControllersRef.current.clear();
  }, []);
  /** 外部流式（术语卡内对话等）注册/注销：与 stopTurn/stopStreaming 共用一个停止表。
      返回注销函数；重复注销安全（幂等）。 */
  const registerStreamController = useCallback(
    (key: string, controller: AbortController): (() => void) => {
      if (!activeControllersRef.current.has(key)) {
        activeControllersRef.current.set(key, new Set());
      }
      activeControllersRef.current.get(key)!.add(controller);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        const set = activeControllersRef.current.get(key);
        if (set) {
          set.delete(controller);
          if (set.size === 0) activeControllersRef.current.delete(key);
        }
      };
    },
    []
  );
  /** 主对话流（root 轮次）是否在流式——主输入框守卫用 */
  const mainBusy = useMemo(
    () =>
      busyTurnIds.some((id) => {
        const t = projects.flatMap((p) => p.turns).find((x) => x.id === id);
        return !t || t.kind !== "diverge"; // 无记录视为 root（保守）
      }),
    [busyTurnIds, projects]
  );
  const isTurnBusy = useCallback(
    (id: string) => busyTurnIds.includes(id),
    [busyTurnIds]
  );
  /** 当前流式回复的目标轮次（并发时记录最近启动者；结束只清自己的）。
      ChatCard 据此做贴底跟随与未读判定——不再假设"流式目标 = 最后一个 turn"。 */
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(boot.profile ?? null);
  const [memories, setMemories] = useState<MemoryItem[]>(boot.memories ?? []);
  /** 术语卡片栈（持久化；sanitize：busy 置 false、来源轮次不存在则清空） */
  const [termStack, setTermStack] = useState<StackItem[]>(() =>
    sanitizeTermStack(boot.termStack, boot.projects ?? [])
  );
  const [thoughtNodes, setThoughtNodes] = useState<ThoughtNode[]>(boot.thoughtNodes ?? []);
  const [termStates, setTermStates] = useState<Record<string, TermState>>(
    boot.termStates ?? {}
  );
  const [documents, setDocuments] = useState<DocumentItem[]>(boot.documents ?? []);
  /** 正在 AI 解读的文档 id 列表（支持并发解读多个文档） */
  const [docInterpretingIds, setDocInterpretingIds] = useState<string[]>([]);
  const [activeDocId, setActiveDocIdState] = useState<string | null>(null);
  /** 选中 AI 回复文本 → 引用（InputArea 收到后收进引用列表并清空） */
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  /** 收藏区智能摘要缓存 + 生成中标记 */
  const [turnSummaries, setTurnSummaries] = useState<Record<string, string>>({});
  const [summarizingTurnId, setSummarizingTurnId] = useState<string | null>(null);
  /** 跨组件跳转请求（收藏区 → 聊天轮次滚动定位） */
  const [focusRequest, setFocusRequest] = useState<{ turnId: string; seq: number } | null>(null);
  /** 平行视图发送目标：当前聚焦的发散轮次 id（null = 发往主对话流）。 */
  const [parallelSendTarget, setParallelSendTarget] = useState<string | null>(null);
  /** 文档视图 = 独立全屏模式：进入即清空平行发送目标——
      否则 ChatCard 卸载后残留的发散卡 id 会让文档提问误发进旧平行会话。 */
  const setActiveDocId = useCallback(
    (id: string | null) => {
      setActiveDocIdState(id);
      if (id != null) setParallelSendTarget(null);
    },
    [setParallelSendTarget]
  );
  /** 卡片树聚焦（当前卡片位置，供导航图高亮）。 */
  const [treeFocus, setTreeFocus] = useState<{
    cardId: string;
    groupSourceId: string | null;
  } | null>(null);
  /** 轮次导航图卡片节点 → 重新打开术语卡片请求 */
  const [cardOpenRequest, setCardOpenRequest] = useState<{
    turnId: string;
    term: string;
    seq: number;
  } | null>(null);
  const [folders, setFolders] = useState<string[]>(boot.folders ?? []);
  const [smartMode, setSmartModeState] = useState<boolean>(boot.smartMode ?? false);
  const [byokModels, setByokModels] = useState<ByokModel[]>(boot.byokModels ?? []);
  /** 引导标记：优先读持久化状态（桌面版在数据文件里），回落旧 localStorage 标记（兼容老数据）。 */
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    if (boot.onboarded != null) return boot.onboarded;
    try {
      return !!localStorage.getItem("explore-onboarded");
    } catch {
      return false;
    }
  });

  // First visit → auto-open onboarding wizard once.
  useEffect(() => {
    if (!onboarded) {
      setModals((m) => ({ ...m, onboarding: true }));
    }
  }, [onboarded]);

  // Persist everything (auto-save, 500ms 防抖：流式增量不逐 token 落盘)。
  // 桌面版（有桥）→ 写 userData/explore-state-v1.json（主进程原子写，单一数据源）；
  // 浏览器/dev → 写 localStorage（行为与以前完全一致）。
  // 写失败（配额满/磁盘满/隐私模式）时明确提示用户，避免静默丢数据。
  const lastWrittenRef = useRef<string | null>(null);
  const serializeRef = useRef<() => string>(() => "");
  const commitRef = useRef<(json: string) => void>(() => {});
  const serialize = useCallback((): string => {
    const data: PersistedState = {
      settings,
      projects,
      activeProjectId,
      thoughtNodes,
      termStates,
      profile,
      memories,
      termStack: sanitizeTermStack(termStack, projects),
      documents,
      folders,
      smartMode,
      byokModels,
      onboarded,
    };
    return JSON.stringify(data);
  }, [settings, projects, activeProjectId, thoughtNodes, termStates, profile, memories, termStack, documents, folders, smartMode, byokModels, onboarded]);
  const commit = useCallback((json: string) => {
    if (json === lastWrittenRef.current) return; // 内容没变不重复写
    lastWrittenRef.current = json;
    const bridge = desktopBridge();
    if (bridge) {
      bridge
        .writeState(json)
        .then((ok) => {
          if (!ok) {
            setAppNotice("⚠️ 数据文件写入失败：改动可能未保存。请检查磁盘空间或查看应用日志。");
          }
        })
        .catch(() => {
          setAppNotice("⚠️ 数据文件写入失败：改动可能未保存。请检查磁盘空间或查看应用日志。");
        });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch {
        setAppNotice("⚠️ 本地存储写入失败：数据可能无法保存。请导出备份或清理浏览器存储空间。");
      }
    }
  }, []);
  serializeRef.current = serialize;
  commitRef.current = commit;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        commit(serialize());
      } catch {
        setAppNotice("⚠️ 数据保存失败：请导出备份以防丢失。");
      }
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, projects, activeProjectId, thoughtNodes, termStates, profile, memories, termStack, documents, folders, smartMode, byokModels, onboarded]);

  // 退出/切后台前冲刷未落盘的改动（防抖窗口内的最后改动不丢）。
  useEffect(() => {
    const onHide = () => {
      try {
        commitRef.current(serializeRef.current());
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Theme → <html data-theme> (runtime re-skin) + browser chrome color.
  useEffect(() => {
    const id = themeId(settings.theme);
    document.documentElement.setAttribute("data-theme", id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META_COLORS[id] ?? "#101010");
  }, [settings.theme]);

  const setSettings = useCallback((partial: Partial<ChatSettings>) => {
    setSettingsState((s) => ({ ...s, ...partial }));
  }, []);

  const createProject = useCallback((folder: string | null = null) => {
    const p: ChatProject = {
      ...makeDemoProject(),
      id: uid(),
      title: "Untitled",
      folder: folder ?? undefined,
    };
    setProjects((list) => [p, ...list]);
    setActiveProjectId(p.id);
    return p.id;
  }, []);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setActiveDocId(null); // 文档视图是独立全屏模式：点项目 = 明确回到对话视图
  }, []);

  const selectResident = useCallback(() => {
    setActiveProjectId(RESIDENT_CHAT_ID);
    setActiveDocId(null);
  }, []);

  const deleteProject = useCallback((id: string) => {
    // 常驻聊天不可删除。
    if (id === RESIDENT_CHAT_ID) return;
    // 收集该项目下的全部轮次 id，清理指向它们的视图引用（防残留失效状态）。
    const doomedTurns = new Set<string>();
    const proj = projects.find((p) => p.id === id);
    proj?.turns.forEach((t) => doomedTurns.add(t.id));
    setProjects((list) => list.filter((p) => p.id !== id));
    setActiveProjectId((cur) => (cur === id ? null : cur));
    setParallelSendTarget((cur) => (cur && doomedTurns.has(cur) ? null : cur));
    setStreamingTurnId((cur) => (cur && doomedTurns.has(cur) ? null : cur));
    setFocusRequest((cur) => (cur && doomedTurns.has(cur.turnId) ? null : cur));
    setCardOpenRequest((cur) => (cur && doomedTurns.has(cur.turnId) ? null : cur));
    setTreeFocus((cur) =>
      cur && (doomedTurns.has(cur.cardId) || (cur.groupSourceId != null && doomedTurns.has(cur.groupSourceId)))
        ? null
        : cur
    );
  }, [projects]);

  const renameProject = useCallback((id: string, name: string) => {
    const title = name.trim();
    if (!title) return;
    setProjects((list) =>
      list.map((p) => (p.id === id ? { ...p, title, updatedAt: Date.now() } : p))
    );
  }, []);

  const createFolder = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setFolders((list) => (list.includes(n) ? list : [...list, n]));
  }, []);

  const removeFolder = useCallback((name: string) => {
    setFolders((list) => list.filter((f) => f !== name));
    setProjects((list) =>
      list.map((p) => (p.folder === name ? { ...p, folder: null } : p))
    );
  }, []);

  const moveProjectToFolder = useCallback((id: string, folder: string | null) => {
    setProjects((list) =>
      list.map((p) => (p.id === id ? { ...p, folder } : p))
    );
  }, []);

  const toggleSmartMode = useCallback(() => setSmartModeState((v) => !v), []);

  const importProject = useCallback(
    (data: { title?: string; turns?: Turn[] }) => {
      const p: ChatProject = {
        ...makeDemoProject(),
        id: uid(),
        title: data.title?.trim() || "Untitled",
        turns: Array.isArray(data.turns) ? data.turns : [],
      };
      setProjects((list) => [p, ...list]);
      setActiveProjectId(p.id);
    },
    []
  );

  /** 全量备份：导出所有数据为单个 JSON 文件并下载（个人工具，数据仅存本机——备份即防丢）。
      includeKeys=true 时包含 BYOK 模型（含 API Key），备份包标记 keysIncluded。 */
  const exportBackup = useCallback(
    (includeKeys = false) => {
      const envelope = {
        app: "explore-backup",
        version: 1,
        exportedAt: Date.now(),
        keysIncluded: includeKeys,
        data: {
          projects,
          thoughtNodes,
          termStates,
          documents,
          folders,
          profile,
          memories,
          termStack: sanitizeTermStack(termStack, projects),
          settings,
          ...(includeKeys ? { byokModels } : {}),
        },
      };
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `explore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [projects, thoughtNodes, termStates, documents, folders, profile, memories, termStack, settings, byokModels]
  );

  /** 全量恢复/导入：
      - 新版备份包（app==="explore-backup"）：按 id 合并（备份胜出），项目/思维节点/文档/文件夹/术语状态/档案/设置
        全部还原，不丢备份之后新建的内容；
      - 旧版项目文件（{ title, turns }）：沿用 importProject 建项目（兼容以前的导出）。
      返回 { ok, message } 供 UI toast。 */
  const importBackup = useCallback(
    (parsed: unknown): { ok: boolean; message: string } => {
      if (!parsed || typeof parsed !== "object") {
        return { ok: false, message: "无法识别的文件格式" };
      }
      const env = parsed as {
        app?: unknown;
        data?: unknown;
        title?: unknown;
        turns?: unknown;
        keysIncluded?: boolean;
      };
      // 旧版项目文件
      if (env.app !== "explore-backup") {
        if (env.title !== undefined || env.turns !== undefined) {
          importProject({ title: String(env.title ?? ""), turns: env.turns as Turn[] | undefined });
          return { ok: true, message: `已导入项目「${String(env.title ?? "Untitled")}」` };
        }
        return { ok: false, message: "无法识别的文件格式" };
      }
      const d = env.data as Partial<BackupEnvelope["data"]> | undefined;
      if (!d || typeof d !== "object") return { ok: false, message: "备份文件缺少 data 字段" };

      const sanitizeTurn = (t: Partial<Turn>): Turn => ({
        id: t.id || uid(),
        title: String(t.title ?? "对话"),
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        messages: Array.isArray(t.messages)
          ? t.messages.map((m) => ({ ...m, id: m.id || uid() }))
          : [],
        // 树结构字段全量保留：分支/发散/探索路径/收藏/未读/分支点/上下文
        kind: t.kind,
        parentTurnId: t.parentTurnId ?? null,
        branchPointIndex: t.branchPointIndex,
        branchContext: t.branchContext,
        divergeSourceId: t.divergeSourceId,
        divergeContext: t.divergeContext,
        explored: t.explored,
        favorite: t.favorite,
        unread: t.unread,
        preBranchSummary: t.preBranchSummary,
      });
      const projectsIn = (Array.isArray(d.projects) ? d.projects : [])
        .filter((p): p is ChatProject => !!p && typeof p === "object")
        .map((p) => ({ ...makeDemoProject(), ...p, id: p.id || uid(), turns: (p.turns ?? []).map(sanitizeTurn) }));
      const thoughtIn = (Array.isArray(d.thoughtNodes) ? d.thoughtNodes : []).filter(
        (n): n is ThoughtNode => !!n && typeof n === "object" && !!n.id
      );
      const docsIn = (Array.isArray(d.documents) ? d.documents : []).filter(
        (x): x is DocumentItem => !!x && typeof x === "object" && !!x.id
      );
      const foldersIn = (Array.isArray(d.folders) ? d.folders : []).filter(
        (f): f is string => typeof f === "string" && !!f.trim()
      );
      const termIn = d.termStates && typeof d.termStates === "object" ? (d.termStates as Record<string, TermState>) : {};
      const memoriesIn = (Array.isArray(d.memories) ? d.memories : []).filter(
        (m): m is MemoryItem => !!m && typeof m === "object" && !!m.text
      );
      // 备份中的 BYOK 模型（仅当导出时包含密钥才会出现）：按 id 合并、备份胜出；
      // 无密钥备份绝不删除本地已有模型（只合并新增/覆盖）。
      const byokIn = (Array.isArray(d.byokModels) ? d.byokModels : []).filter(
        (m): m is ByokModel =>
          !!m && typeof m === "object" && typeof m.id === "string" && typeof m.name === "string"
      );

      // 按 id 合并（备份胜出）；保留备份之后新建的内容。
      setProjects((list) => {
        const map = new Map(list.map((p) => [p.id, p]));
        for (const p of projectsIn) map.set(p.id, p);
        return [...map.values()];
      });
      setThoughtNodes((list) => {
        const map = new Map(list.map((n) => [n.id, n]));
        for (const n of thoughtIn) map.set(n.id, n);
        return [...map.values()];
      });
      setDocuments((list) => {
        const map = new Map(list.map((x) => [x.id, x]));
        for (const x of docsIn) map.set(x.id, x);
        return [...map.values()];
      });
      setFolders((list) => [...new Set([...list, ...foldersIn])]);
      setTermStates((s) => ({ ...s, ...termIn }));
      setMemories((list) => {
        const map = new Map(list.map((m) => [m.id, m]));
        for (const m of memoriesIn) if (m.id) map.set(m.id, m);
        // 无 id 的旧格式条目按文本去重并入
        const byText = new Map(list.map((m) => [m.text, m]));
        for (const m of memoriesIn) if (!m.id) byText.set(m.text, m);
        return [...map.values(), ...[...byText.values()].filter((m) => !map.has(m.id))];
      });
      // BYOK 模型合并（备份胜出；不删除本地模型）
      setByokModels((list) => {
        const map = new Map(list.map((m) => [m.id, m]));
        for (const m of byokIn) map.set(m.id, m);
        return [...map.values()];
      });
      // 术语卡栈恢复：基于"现有 + 备份"的项目做 sanitize（来源轮次不存在则清空）
      setTermStack(sanitizeTermStack(d.termStack, [...projects, ...projectsIn]));
      if (d.profile) setProfile(d.profile as Profile);
      if (d.settings && typeof d.settings === "object") {
        setSettingsState((s) => ({ ...DEFAULT_SETTINGS, ...s, ...(d.settings as ChatSettings) }));
      }
      return {
        ok: true,
        message: `已恢复备份：${projectsIn.length} 个项目 · ${thoughtIn.length} 个思维节点 · ${docsIn.length} 个文档${
          byokIn.length > 0
            ? ` · ${byokIn.length} 个模型${env.keysIncluded ? "（含密钥）" : ""}`
            : ""
        }`,
      };
    },
    [importProject, projects]
  );

  const addByokModel = useCallback(
    (input: { name: string; baseUrl: string; modelId: string; apiKey: string; vision?: boolean }): boolean => {
      const name = input.name.trim();
      if (!name) return false;
      const id = "byok:" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      // 同名去重：id 由名称生成，重复添加会产生 key 冲突与双条目
      if (byokModels.some((m) => m.id === id)) return false;
      const m: ByokModel = {
        id,
        name,
        provider: "BYOK",
        description: input.apiKey.trim() ? "自定义模型（密钥仅存本机）" : "自定义模型",
        baseUrl: input.baseUrl.trim().replace(/\/+$/, "") || "https://api.openai.com/v1",
        modelId: input.modelId.trim() || name,
        apiKey: input.apiKey.trim(),
        vision: input.vision ?? false,
      };
      setByokModels((list) => [...list, m]);
      return true;
    },
    [byokModels]
  );

  /** 删除一个 BYOK 模型；若删除的是当前默认模型/视觉模型，同步清除对应选中引用。 */
  const removeByokModel = useCallback((id: string) => {
    setByokModels((list) => list.filter((m) => m.id !== id));
    setSettingsState((s) => ({
      ...s,
      activeModelId: s.activeModelId === id ? "" : s.activeModelId,
      visionModelId: s.visionModelId === id ? null : s.visionModelId,
    }));
  }, []);

  /** 标记引导已完成：写进持久化状态（桌面版随数据文件落盘），并保留旧 localStorage 标记作兼容。 */
  const markOnboarded = useCallback(() => {
    setOnboarded(true);
    try {
      localStorage.setItem("explore-onboarded", "1");
    } catch {
      /* ignore */
    }
  }, []);

  /** 更新一个 BYOK 模型（编辑保存）。改名会改变 id，需同步默认模型/视觉模型的选中引用；
      新名称与其它模型重名时返回 false（由 UI 提示）。 */
  const updateByokModel = useCallback(
    (id: string, input: { name: string; baseUrl: string; modelId: string; apiKey: string; vision?: boolean }): boolean => {
      const name = input.name.trim();
      if (!name) return false;
      const newId = "byok:" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      // 改名后与其它模型重名 → 拒绝（保持原 id 不变）
      if (newId !== id && byokModels.some((m) => m.id === newId)) return false;
      setByokModels((list) =>
        list.map((m) =>
          m.id === id
            ? {
                ...m,
                id: newId,
                name,
                provider: "BYOK",
                description: input.apiKey.trim() ? "自定义模型（密钥仅存本机）" : "自定义模型",
                baseUrl: input.baseUrl.trim().replace(/\/+$/, "") || "https://api.openai.com/v1",
                modelId: input.modelId.trim() || name,
                apiKey: input.apiKey.trim(),
                vision: input.vision ?? false,
              }
            : m
        )
      );
      if (newId !== id) {
        setSettingsState((s) => ({
          ...s,
          activeModelId: s.activeModelId === id ? newId : s.activeModelId,
          visionModelId: s.visionModelId === id ? newId : s.visionModelId,
        }));
      }
      return true;
    },
    [byokModels]
  );

  const toggleSidebar = useCallback(() => setCollapsed((c) => !c), []);

  const openModal = useCallback((k: keyof AppState["modals"]) => {
    setModals((m) => ({ ...m, [k]: true }));
  }, []);
  const closeModal = useCallback((k: keyof AppState["modals"]) => {
    setModals((m) => ({ ...m, [k]: false }));
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const turns = useMemo(() => activeProject?.turns ?? [], [activeProject]);
  const activeTurn = useMemo(() => turns[turns.length - 1] ?? null, [turns]);

  /** 个人记忆 system 提示（所有对话/卡片内提问共用；无记忆 = null） */
  const memorySystemPrompt = useMemo(
    () => buildMemoryContext(profile, memories, thoughtNodes, termStates)?.system ?? null,
    [profile, memories, thoughtNodes, termStates]
  );

  /** Append a turn (user message + optional mock AI reply) to a project. */
  const appendTurn = useCallback(
    (
      projectId: string,
      title: string,
      userContent: string,
      aiContent?: string,
      images?: AttachedImage[]
    ) => {
      const turn = makeDemoTurn(title);
      const messages: Message[] = [
        {
          id: uid(),
          role: "user",
          content: userContent,
          createdAt: Date.now(),
          // 落盘只存缩略图（剥离 fullDataUrl，控制 localStorage 配额）
          images: images?.map(({ fullDataUrl: _full, ...rest }) => rest),
        },
      ];
      if (aiContent) {
        messages.push({ id: uid(), role: "assistant", content: aiContent, createdAt: Date.now() });
      }
      setProjects((list) =>
        list.map((p) =>
          p.id === projectId
            ? { ...p, turns: [...p.turns, { ...turn, messages }], updatedAt: Date.now() }
            : p
        )
      );
      setActiveProjectId(projectId);
      return turn.id;
    },
    []
  );

  /** 记录某轮对话里点击过的术语卡片（探索路径，按轮次划分）。
      按 turn id 定位项目（turn id 全局唯一），不依赖 activeProjectId。 */
  const recordExploration = useCallback(
    (turnId: string, term: string, kind: TermKind, parentTerm: string | null = null) => {
      setProjects((list) =>
        list.map((p) => {
          if (!p.turns.some((t) => t.id === turnId)) return p;
          return {
            ...p,
            turns: p.turns.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    explored: [
                      ...(t.explored ?? []).filter((e) => e.term !== term),
                      { term, kind, at: Date.now(), parentTerm },
                    ],
                  }
                : t
            ),
          };
        })
      );
    },
    []
  );

  /** 轮次未读标记（导航节点圆点；右键手动切换） */
  const setTurnUnread = useCallback((turnId: string, unread: boolean) => {
    setProjects((list) =>
      list.map((p) => ({
        ...p,
        turns: p.turns.map((t) => (t.id === turnId ? { ...t, unread } : t)),
      }))
    );
  }, []);

  /** 收藏/取消收藏轮次（收藏区 + 智能摘要） */
  const toggleFavorite = useCallback((turnId: string) => {
    setProjects((list) =>
      list.map((p) => ({
        ...p,
        turns: p.turns.map((t) => (t.id === turnId ? { ...t, favorite: !t.favorite } : t)),
      }))
    );
  }, []);

  /** 删除一张轮次卡片：级联删除子树（分支/发散/更深层），并清理视图引用。
      删除后卡片树、收藏区、未读标记随 turns 派生自动消失。 */
  const removeTurn = useCallback(
    (turnId: string) => {
      const doomed = new Set<string>();
      const collect = (id: string) => {
        if (doomed.has(id)) return;
        doomed.add(id);
        for (const p of projects) {
          for (const t of p.turns) {
            if (t.parentTurnId === id) collect(t.id);
            if (t.kind === "diverge" && t.divergeSourceId === id) collect(t.id);
          }
        }
      };
      collect(turnId);
      setProjects((list) =>
        list.map((p) => ({
          ...p,
          updatedAt: Date.now(),
          turns: p.turns.filter((t) => !doomed.has(t.id)),
        }))
      );
      // 视图引用清理：平行发送目标/树聚焦指向被删卡（或来源）时重置
      setParallelSendTarget((cur) => (cur && doomed.has(cur) ? null : cur));
      setTreeFocus((cur) =>
        cur && (doomed.has(cur.cardId) || (cur.groupSourceId != null && doomed.has(cur.groupSourceId)))
          ? null
          : cur
      );
      // 补充清理：流式目标/聚焦请求/卡片打开请求/摘要缓存指向被删卡时重置
      setStreamingTurnId((cur) => (cur && doomed.has(cur) ? null : cur));
      setFocusRequest((cur) => (cur && doomed.has(cur.turnId) ? null : cur));
      setCardOpenRequest((cur) => (cur && doomed.has(cur.turnId) ? null : cur));
      setTurnSummaries((s) => {
        const next = { ...s };
        for (const id of doomed) delete next[id];
        return next;
      });
    },
    [projects]
  );

  /** 清空常驻聊天的全部轮次（常驻聊天不可删除项目，清空是唯一重置手段）。 */
  const clearResidentChat = useCallback(() => {
    setProjects((list) =>
      list.map((p) =>
        p.id === RESIDENT_CHAT_ID ? { ...p, turns: [], updatedAt: Date.now() } : p
      )
    );
    setParallelSendTarget(null);
    setTreeFocus(null);
  }, []);

  /** 收藏区跳转：切到目标项目 + 回到对话视图 + 通知 ChatCard 滚动定位该轮次 */
  const focusTurn = useCallback((projectId: string, turnId: string) => {
    setActiveProjectId(projectId);
    setActiveDocId(null); // 收藏跳转永远落回对话视图（文档视图下点击不再"无反应"）
    setFocusRequest({ turnId, seq: Date.now() });
  }, []);

  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  /** 轮次导航图点击卡片节点 → 请求重新打开术语卡片 */
  const requestCardOpen = useCallback((turnId: string, term: string) => {
    setCardOpenRequest({ turnId, term, seq: Date.now() });
  }, []);

  const clearCardOpenRequest = useCallback(() => setCardOpenRequest(null), []);

  /** 收藏区"智能摘要"：BYOK 走真实 API 流式生成；无 API 时提示配置。 */
  const summarizeTurn = useCallback(
    (turnId: string) => {
      const turn = projects.flatMap((p) => p.turns).find((t) => t.id === turnId);
      if (!turn || summarizingTurnId) return;
      const byok = byokModels.find(
        (m) => m.id === settings.activeModelId && m.provider === "BYOK"
      );
      if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
        setAppNotice("请先在设置 → AI 模型中配置 API 模型");
        return;
      }
      setSummarizingTurnId(turnId);
      setTurnSummaries((s) => ({ ...s, [turnId]: "" }));
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      let acc = "";
      const transcript = turn.messages
        .map((m) => `${m.role === "user" ? "我" : "AI"}：${m.content}`)
        .join("\n")
        .slice(0, 4000);
      streamOpenAICompatible(
        byok,
        [
          {
            role: "user",
            content: `请用 3-5 条要点概括下面这段对话（含核心问题、涉及术语与结论），中文回答：\n\n${transcript}`,
          },
        ],
        (delta) => {
          acc += delta;
          setTurnSummaries((s) => ({ ...s, [turnId]: acc }));
        },
        controller.signal,
        () => window.clearTimeout(timer)
      )
        .catch(() => {
          setAppNotice("摘要生成失败：请检查 API 配置或网络");
          setTurnSummaries((s) => {
            const next = { ...s };
            delete next[turnId];
            return next;
          });
        })
        .finally(() => {
          window.clearTimeout(timer);
          setSummarizingTurnId(null);
        });
    },
    [projects, byokModels, settings.activeModelId, summarizingTurnId]
  );

  /** 在目标项目追加一条空 assistant 消息（打字机/SSE 共用的写入目标）。
      turnId 缺省 = 最后一个 turn；平行对话内继续提问时指定发散 turn。 */
  const appendAssistantMessage = useCallback((targetId: string, turnId?: string) => {
    setProjects((list) =>
      list.map((p) =>
        p.id === targetId
          ? {
              ...p,
              turns: p.turns.map((t, i) =>
                (turnId ? t.id === turnId : i === p.turns.length - 1)
                  ? {
                      ...t,
                      messages: [
                        ...t.messages,
                        {
                          id: uid(),
                          role: "assistant" as const,
                          content: "",
                          createdAt: Date.now(),
                        },
                      ],
                    }
                  : t
              ),
            }
          : p
      )
    );
  }, []);

  /** 覆写目标项目最后一条 assistant 消息的内容（turnId 缺省 = 最后一个 turn）。 */
  const setLastAssistantContent = useCallback(
    (targetId: string, content: string, turnId?: string) => {
      setProjects((list) =>
        list.map((p) =>
          p.id === targetId
            ? {
                ...p,
                turns: p.turns.map((t, i) =>
                  (turnId ? t.id === turnId : i === p.turns.length - 1)
                    ? {
                        ...t,
                        messages: t.messages.map((m, mi) =>
                          mi === t.messages.length - 1 ? { ...m, content } : m
                        ),
                      }
                    : t
                ),
              }
            : p
        )
      );
    },
    []
  );

  /**
   * 打字机式把 `reply` 写入最后一条 assistant 消息。
   * `opts.append === false`：复用已有消息（SSE 已追加过 / 覆写部分内容）。
   * `opts.prefix`：从头就显示的前缀（用于保留流式中断前已收到的部分）。
   */
  const streamReply = useCallback(
    (
      reply: string,
      targetId: string,
      onDone?: () => void,
      opts?: { append?: boolean; prefix?: string },
      turnId?: string
    ) => {
      if (opts?.append !== false) appendAssistantMessage(targetId, turnId);
      const prefix = opts?.prefix ?? "";
      const streamKey = turnId ?? targetId;
      let pos = 0;
      const step = 16;
      const timer = window.setInterval(() => {
        pos = Math.min(pos + step, reply.length);
        setLastAssistantContent(targetId, prefix + reply.slice(0, pos), turnId);
        if (pos >= reply.length) {
          window.clearInterval(timer);
          markIdle(streamKey);
          setStreamingTurnId((cur) => (cur === turnId ? null : cur));
          onDone?.();
        }
      }, 20);
    },
    [appendAssistantMessage, setLastAssistantContent, markIdle]
  );

  /**
   * 双通道回复：BYOK 走真实流式 API；未配置或失败时明确提示（无离线兜底）。
   * 回复写入 targetId 项目（turnId 缺省 = 最后一个 turn）；`history` 为之前的消息（不含当前问题）。
   * `images` = 本条消息附带图片（视觉模式：原生直传 / 路由识图 / 未配置则拦截）。
   */
  const deliverReply = useCallback(
    (
      question: string,
      history: { role: string; content: string }[],
      targetId: string,
      onDone?: () => void,
      turnId?: string,
      images?: AttachedImage[]
    ) => {
      void (async () => {
        const streamKey = turnId ?? targetId;
        const byok = byokModels.find(
          (m) => m.id === settings.activeModelId && m.provider === "BYOK"
        );
        // 个人记忆：所有对话都注入（手动记忆 + 档案 + 思维宇宙 + 术语掌握度），
        // 让 AI 的回答贴合用户；无任何记忆时为 null 不注入。
        const memory = memorySystemPrompt ? { system: memorySystemPrompt } : null;
        // 智能模式注记：仅常驻聊天 + 开关开启时，成功回复尾部附加个性化说明。
        const smartNote =
          smartMode && targetId === RESIDENT_CHAT_ID
            ? buildSmartNote(profile, thoughtNodes, termStates)
            : null;
        // 联网搜索（开关开启）：先取实时结果再组上下文——
        // 注入 prompt 引导基于结果回答并注明来源。
        let searchPrompt = "";
        if (settings.isWebSearchEnabled) {
          const results = await webSearch(question);
          if (results.length > 0) {
            const list = results
              .map(
                (r, i) =>
                  `${i + 1}. [${r.title}](${r.url})${r.snippet ? `\n   ${r.snippet}` : ""}`
              )
              .join("\n");
            searchPrompt =
              `\n\n以下是用户开启联网搜索后获取的实时搜索结果（按相关度排序）：\n${list}` +
              `\n请优先基于这些结果回答，引用时注明来源；若结果与问题无关，请如实说明。`;
          }
        }
        // 记录流式目标（供贴底/未读判定）；并发时最近启动者胜出，结束只清自己的。
        setStreamingTurnId(turnId ?? null);
        if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
          // 未配置 API：不生成回复，提示去配置（输入区在无 API 时已禁用，这里是兜底）。
          setAppNotice("请先在设置 → AI 模型中配置 API 模型");
          markIdle(streamKey);
          setStreamingTurnId((cur) => (cur === turnId ? null : cur));
          return;
        }
        // ---- 视觉决策：主模型多模态 / 路由识图 / 未配置拦截 ----
        const controller = new AbortController();
        if (!activeControllersRef.current.has(streamKey)) {
          activeControllersRef.current.set(streamKey, new Set());
        }
        activeControllersRef.current.get(streamKey)!.add(controller);
        const done = () => {
          const set = activeControllersRef.current.get(streamKey);
          if (set) {
            set.delete(controller);
            if (set.size === 0) activeControllersRef.current.delete(streamKey);
          }
        };
        const visionModel = settings.visionModelId
          ? byokModels.find((m) => m.id === settings.visionModelId && m.vision) ?? null
          : null;
        const visionDecision: VisionDecision = images?.length
          ? decideVision({
              mainVision: !!byok.vision,
              visionMode: settings.visionMode,
              hasVisionModel: !!visionModel,
            })
          : "native"; // 无图时不影响
        if (images?.length && visionDecision === "blocked") {
          setAppNotice(
            settings.visionMode === "off"
              ? "视觉模式已关闭：可在 设置 → AI 模型 → 视觉模式 开启"
              : "当前模型不支持图片，且未配置视觉模型：请在 设置 → AI 模型 添加一个视觉模型（如 GLM-4V-Flash）"
          );
          markIdle(streamKey);
          done();
          setStreamingTurnId((cur) => (cur === turnId ? null : cur));
          return;
        }
        // ---- 组装 wire 消息：历史图片降级为缓存描述；当前图片按模式处理 ----
        const wireHistory: { role: string; content: string | WireContent[] }[] = [];
        for (const m of history) {
          const img = (m as { images?: AttachedImage[] }).images?.[0];
          if (img) {
            const cached = getVisionCache(img.hash);
            if (cached) {
              wireHistory.push({ role: m.role, content: `[图片描述] ${cached.desc}` });
              continue;
            }
          }
          wireHistory.push({ role: m.role, content: m.content });
        }
        let questionContent: string | WireContent[] = question;
        if (images?.length) {
          if (visionDecision === "native") {
            questionContent = toNativeParts(question, images);
          } else {
            // 路由：逐图识图（查缓存 → miss 调视觉模型），描述拼进问题
            setAppNotice("🔍 正在看图…");
            const descs: string[] = [];
            for (const img of images) {
              try {
                descs.push(await describeImage(visionModel!, img, controller.signal));
              } catch {
                descs.push("（图片描述失败）");
              }
            }
            questionContent = toRouterText(question, descs);
          }
        }
        // 15s 内没有任何增量 -> 放弃；开始出字后不再限时（流可能很长）。
        // timedOut 标记区分「首字超时」与「用户手动停止」（两者都走 abort）。
        let timedOut = false;
        const timer = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 15000);
        appendAssistantMessage(targetId, turnId); // SSE 直接往这条消息里流
        let acc = "";
        // 渲染节流：SSE delta 高频到达时合并写入（40ms），流结束强制 flush——
        // 避免每 delta 全量 setProjects 造成的流式重渲染风暴。
        let lastFlush = 0;
        const flushContent = () => {
          setLastAssistantContent(targetId, acc, turnId);
          lastFlush = Date.now();
        };
        streamOpenAICompatible(
          byok,
          [
            ...(memory ? [{ role: "system" as const, content: memory.system }] : []),
            ...(searchPrompt
              ? [{ role: "user" as const, content: searchPrompt }]
              : []),
            ...wireHistory,
            { role: "user", content: questionContent },
          ],
          (delta) => {
            acc += delta;
            const now = Date.now();
            if (now - lastFlush >= 40) flushContent();
          },
          controller.signal,
          () => window.clearTimeout(timer)
        )
          .then(() => {
            window.clearTimeout(timer);
            markIdle(streamKey);
            done();
            setStreamingTurnId((cur) => (cur === turnId ? null : cur));
            // 强制 flush 最后一节（含智能模式注记）
            setLastAssistantContent(targetId, smartNote ? acc + smartNote : acc, turnId);
            onDone?.();
          })
          .catch((err: unknown) => {
            window.clearTimeout(timer);
            done();
            const why =
              err instanceof Error && err.name === "AbortError"
                ? timedOut
                  ? "请求超时"
                  : "已停止"
                : err instanceof Error && err.message
                  ? err.message
                  : "网络错误";
            // 用户手动停止不是失败：提示改为中性文案，保留已生成的正文。
            const userStopped = err instanceof Error && err.name === "AbortError" && !timedOut;
            if (!userStopped) setAppNotice(`API 请求失败（${why}）`);
            if (acc) {
              // 流中断：保留已收到的部分，末尾标注中断原因。
              streamReply(
                userStopped
                  ? `\n\n> ⏹ 已手动停止生成，以上为已生成的内容。`
                  : `\n\n> ⚠️ API 请求中断（${why}），以上为中断前已生成的内容。`,
                targetId,
                onDone,
                { append: false, prefix: `${acc}\n\n` },
                turnId
              );
            } else {
              const fallback = userStopped
                ? `> ⏹ 已停止生成。`
                : `> ⚠️ API 请求失败（${why}）。请检查 API 地址 / Key 是否正确，或稍后重试。`;
              streamReply(fallback, targetId, onDone, { append: false }, turnId);
            }
          });
      })();
    },
    [
      byokModels,
      settings.activeModelId,
      settings.isWebSearchEnabled,
      settings.visionMode,
      settings.visionModelId,
      appendAssistantMessage,
      setLastAssistantContent,
      streamReply,
      markIdle,
      memorySystemPrompt,
      smartMode,
      profile,
      thoughtNodes,
      termStates,
    ]
  );

  const sendMessage = useCallback(
    (text: string, images?: AttachedImage[]) => {
      const content = text.trim();
      if ((!content && !images?.length) || mainBusy) return;
      // 无 API 守卫（输入区已禁用，这里是兜底）：不发消息、不建空轮次。
      const byok = byokModels.find(
        (m) => m.id === settings.activeModelId && m.provider === "BYOK"
      );
      if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
        setAppNotice("请先在设置 → AI 模型中配置 API 模型");
        return;
      }

      const wasDesktop = isDesktop();
      let targetId = activeProjectId;
      if (!targetId) {
        const p: ChatProject = { ...makeDemoProject(), id: uid(), title: "Untitled" };
        setProjects((list) => [p, ...list]);
        targetId = p.id;
      }
      setActiveProjectId(targetId);

      // 标题取消息正文（去掉引用行 `> …`，避免标题变成引用片段）。
      const plain = content
        .split("\n")
        .filter((l) => !l.trim().startsWith(">"))
        .join(" ")
        .trim();
      const titleSource =
        plain || content.replace(/^>\s?/gm, "").trim().slice(0, 40) || "引用对话";
      const title = titleSource.length > 18 ? titleSource.slice(0, 18) + "…" : titleSource;
      const turnId = appendTurn(targetId, title, content, undefined, images);
      // 单卡片聚焦视图：新轮次成为激活卡片（滑动切入）。
      focusTurn(targetId, turnId);
      // 自动标题：给"Untitled"项目用首条消息命名（设置可关）。
      if (settings.autoTitleEnabled) {
        setProjects((list) =>
          list.map((p) =>
            p.id === targetId && (p.title === "Untitled" || !p.title.trim())
              ? { ...p, title, updatedAt: Date.now() }
              : p
          )
        );
      }
      markBusy(turnId);
      const done = () => {
        // 发消息后自动折叠侧边栏（桌面端）
        if (wasDesktop) setCollapsed(true);
      };

      // 最近对话历史（当前问题单独传）。
      // 平行/分支会话是独立线程：不进入主对话流上下文，避免主题漂移。
      const history = turns
        .filter((t) => t.kind !== "diverge" && t.kind !== "branch")
        .flatMap((t) => t.messages)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content, images: m.images }));

      // turnId 显式指定写入目标：主对话流式期间若有并发流（术语卡发散/分支），
      // 写入目标不随"最后一个 turn"漂移（修双流覆写）。
      deliverReply(content, history, targetId, done, turnId, images);
    },
    [activeProjectId, mainBusy, appendTurn, settings.autoTitleEnabled, turns, deliverReply, focusTurn, markBusy, byokModels, settings.activeModelId]
  );

  /** 在指定轮次内继续提问（消息级顺延）：
      平行对话是独立线程——在发散卡片下方继续对话，而不是弹回主对话流。
      回复写入该轮次（turnId 指定），上下文取该轮次前序消息。 */
  const sendInTurn = useCallback(
    (turnId: string, text: string, images?: AttachedImage[]) => {
      const content = text.trim();
      if ((!content && !images?.length) || isTurnBusy(turnId)) return;
      const proj = projects.find((p) => p.turns.some((t) => t.id === turnId));
      const turn = proj?.turns.find((t) => t.id === turnId);
      if (!proj || !turn) return;
      setProjects((list) =>
        list.map((p) =>
          p.id === proj.id
            ? {
                ...p,
                updatedAt: Date.now(),
                turns: p.turns.map((t) =>
                  t.id === turnId
                    ? {
                        ...t,
                        messages: [
                          ...t.messages,
                          {
                            id: uid(),
                            role: "user" as const,
                            content,
                            createdAt: Date.now(),
                            images: images?.map(({ fullDataUrl: _full, ...rest }) => rest),
                          },
                        ],
                      }
                    : t
                ),
              }
            : p
        )
      );
      // 上下文：分支卡 = 分支点前上游切片 + 深挖路径 + 卡内最近消息
      // （分割线位置即继承边界；调整分支点后自动按新切片，无需重生成旧回答）；
      // 发散卡 = 来源锚点上下文（持久化 divergeContext）+ 卡内最近消息；
      // 其余轮次（含发散卡）取该轮次前序消息。
      const history =
        turn.kind === "branch" && turn.branchContext
          ? [
              ...turn.branchContext.slice.map((m) => ({ role: m.role, content: m.content })),
              ...turn.branchContext.trail.map((m) => ({ role: m.role, content: m.content })),
              ...turn.messages
                .slice(-8)
                .map((m) => ({ role: m.role, content: m.content, images: m.images })),
            ]
          : turn.kind === "diverge" && turn.divergeContext
            ? [
                {
                  role: "user" as const,
                  content: `本发散对话源自「${turn.divergeContext.sourceTitle}」${turn.divergeContext.anchorText ? `，其中提到：「${turn.divergeContext.anchorText}」` : ""}。请结合这一语境继续回答。`,
                },
                ...turn.messages
                  .slice(-12)
                  .map((m) => ({ role: m.role, content: m.content, images: m.images })),
              ]
            : turn.messages
                .slice(-12)
                .map((m) => ({ role: m.role, content: m.content, images: m.images }));
      markBusy(turnId);
      deliverReply(content, history, proj.id, undefined, turnId, images);
    },
    [projects, isTurnBusy, deliverReply, markBusy]
  );

  /** 分支卡片：以术语开新 turn，继承上游卡片主题与分支点之前的对话历史。
      AI 回复走 deliverReply（BYOK 真实 API），不再静态贴摘要。
      新 turn 记为 kind="branch"；branchPointIndex 默认 = 创建时上游轮次最后一条消息下标。 */
  const openBranchTurn = useCallback(
    (
      title: string,
      history: { role: string; content: string }[] = [],
      sourceTurnId?: string,
      targetProjectId?: string
    ): { id: string; created: boolean } => {
      // 无 BYOK 守卫：先拦截再建卡（避免"先建卡后失败"的幽灵空卡）。
      const byok = byokModels.find(
        (m) => m.id === settings.activeModelId && m.provider === "BYOK"
      );
      if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
        setAppNotice("请先在设置 → AI 模型中配置 API 模型");
        return { id: "", created: false };
      }
      let targetId = targetProjectId ?? activeProjectId;
      if (!targetId) {
        const p: ChatProject = { ...makeDemoProject(), id: uid(), title: "Untitled" };
        setProjects((list) => [p, ...list]);
        targetId = p.id;
      }
      // 去重：同一来源轮次 + 同一标题的分支卡片已存在 → 复用（只搜目标项目内，
      // 跨项目同名会返回错误项目的 turn → 聚焦请求被静默丢弃）。
      if (sourceTurnId) {
        const existing = projects
          .find((p) => p.id === targetId)
          ?.turns.find(
            (t) => t.kind === "branch" && t.parentTurnId === sourceTurnId && t.title === title
          );
        if (existing) return { id: existing.id, created: false };
      }
      const turnId = appendTurn(targetId, title, `继续深挖：${title}`);
      // 分支标记（kind + parentTurnId + 默认分支点）：新 turn 的 parentTurnId 指向发起分支的轮次。
      const source = sourceTurnId
        ? projects.flatMap((p) => p.turns).find((t) => t.id === sourceTurnId) ?? null
        : null;
      // 分支点前的上游消息切片（分割线位置 = 实际继承的历史边界）：
      // 供 ctx 注入与 branchContext 缓存共用。
      const point = source ? Math.max(source.messages.length - 1, 0) : -1;
      const sourceSlice =
        source && point >= 0 ? source.messages.slice(0, point + 1) : [];
      // 仅当真实存在上游轮次时才标 branch（sourceTurnId 存在但找不到来源 → 不标，
      // 避免孤儿分支卡在树里挂空）
      if (source) {
        const defaultPoint = source
          ? Math.max(source.messages.length - 1, 0)
          : 0;
        setProjects((list) =>
          list.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  turns: p.turns.map((t) =>
                    t.id === turnId
                      ? {
                          ...t,
                          kind: "branch" as const,
                          parentTurnId: sourceTurnId ?? null,
                          branchPointIndex: defaultPoint,
                          // 续问上下文缓存：分支点前切片 + 深挖路径（调整分支点时重算 slice）
                          branchContext: {
                            slice: sourceSlice.map((m) => ({
                              role: m.role,
                              content: m.content,
                            })),
                            trail: history.slice(-16),
                          },
                        }
                      : t
                  ),
                }
              : p
          )
        );
      }
      // 新 turn 的探索路径从该分支术语起算（继承上下文另起炉灶）。
      recordExploration(turnId, title, "branch", null);
      setMindscapeOpen(false);
      markBusy(turnId);
      const ctx: { role: string; content: string }[] = [
        {
          role: "user",
          content: `分支卡片：以「${title}」为主题另起炉灶，继承上游卡片主题与分支点之前的对话历史（上游共 ${sourceSlice.length} 条消息）。请结合历史继续深挖，用中文回答，重要术语用 **加粗** 标记。`,
        },
        ...sourceSlice.map((m) => ({ role: m.role, content: m.content })),
        ...history.slice(-16),
      ];
      deliverReply(`继续深挖：${title}`, ctx, targetId, undefined, turnId);
      return { id: turnId, created: true };
    },
    [activeProjectId, projects, appendTurn, recordExploration, deliverReply, markBusy, byokModels, settings.activeModelId, setAppNotice]
  );

  /** 发散卡片：以术语开"平行会话"（kind="diverge"）。
      与分支卡片的关键区别：不继承上游完整历史，但携带来源锚点上下文
      （来源主题 + 术语所在段落，buildDivergePrompt 注入）；不打断当前对话（调用方保留卡片栈），
      树中与来源卡片同层、位于其右侧。AI 回复走双通道。
      去重：同一来源 + 同一主题已存在 → 复用，不新建。 */
  const openDivergeTurn = useCallback(
    (
      title: string,
      sourceTurnId: string,
      anchor?: { sourceTitle: string; anchorText?: string },
      targetProjectId?: string
    ): { id: string; created: boolean } => {
      // 无 BYOK 守卫：先拦截再建卡（避免"先建卡后失败"的幽灵空卡）。
      const byok = byokModels.find(
        (m) => m.id === settings.activeModelId && m.provider === "BYOK"
      );
      if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
        setAppNotice("请先在设置 → AI 模型中配置 API 模型");
        return { id: "", created: false };
      }
      let targetId = targetProjectId ?? activeProjectId;
      if (!targetId) {
        const p: ChatProject = { ...makeDemoProject(), id: uid(), title: "Untitled" };
        setProjects((list) => [p, ...list]);
        targetId = p.id;
      }
      // 去重只搜目标项目内（跨项目同名发散会返回错误项目的 turn → 聚焦请求被静默丢弃）
      const existing = projects
        .find((p) => p.id === targetId)
        ?.turns.find(
          (t) => t.kind === "diverge" && t.divergeSourceId === sourceTurnId && t.title === title
        );
      if (existing) return { id: existing.id, created: false };
      const turnId = appendTurn(targetId, title, `发散话题：${title}（平行会话）`);
      setProjects((list) =>
        list.map((p) =>
          p.id === targetId
            ? {
                ...p,
                turns: p.turns.map((t) =>
                  t.id === turnId
                    ? {
                        ...t,
                        kind: "diverge" as const,
                        divergeSourceId: sourceTurnId,
                        // 持久化来源锚点：发散对话追问时注入，保持父语境
                        divergeContext: anchor
                          ? { sourceTitle: anchor.sourceTitle, anchorText: anchor.anchorText }
                          : undefined,
                      }
                    : t
                ),
              }
            : p
        )
      );
      setMindscapeOpen(false);
      markBusy(turnId);
      const ctx = [{ role: "user", content: buildDivergePrompt(title, anchor) }];
      deliverReply(`发散话题：${title}`, ctx, targetId, undefined, turnId);
      return { id: turnId, created: true };
    },
    [activeProjectId, projects, appendTurn, deliverReply, markBusy, byokModels, settings.activeModelId, setAppNotice]
  );

  /** 调整分支卡片的分支点（上游轮次 messages 下标；分割线画在该消息之后）。
      同时失效 preBranchSummary 缓存 + 按新分支点重算 branchContext.slice——
      分支卡内续问的上下文立即与新的分割线一致（闭环：调整分支点 → 续问即按新边界）。 */
  const setBranchPoint = useCallback(
    (turnId: string, index: number) => {
      // 父轮次可能不在同一项目（异常数据/旧备份）：先全局定位，缺失时提示而非静默空上下文。
      const branch = projects.flatMap((p) => p.turns).find((t) => t.id === turnId);
      const parentId = branch?.parentTurnId;
      const source = parentId
        ? projects.flatMap((p) => p.turns).find((t) => t.id === parentId) ?? null
        : null;
      if (parentId && !source) {
        setAppNotice("⚠️ 找不到该分支的上游轮次，无法调整分支点");
        return;
      }
      const i = Math.max(index, 0);
      const newSlice = source
        ? source.messages.slice(0, i + 1).map((m) => ({ role: m.role, content: m.content }))
        : [];
      setProjects((list) =>
        list.map((p) => ({
          ...p,
          turns: p.turns.map((t) => {
            if (t.id !== turnId) return t;
            return {
              ...t,
              branchPointIndex: i,
              preBranchSummary: undefined,
              branchContext: t.branchContext
                ? { ...t.branchContext, slice: newSlice }
                : undefined,
            };
          }),
        }))
      );
    },
    [projects, setAppNotice]
  );

  /** 分支卡片：生成并缓存"分支点前上游对话"总结（启发式，无 API 依赖）。 */
  const summarizePreBranch = useCallback(
    (turnId: string) => {
      const all = projects.flatMap((p) => p.turns);
      const branch = all.find((t) => t.id === turnId);
      if (!branch?.parentTurnId) return;
      const source = all.find((t) => t.id === branch.parentTurnId);
      if (!source) return;
      const idx = branch.branchPointIndex ?? Math.max(source.messages.length - 1, 0);
      const slice = source.messages.slice(0, idx + 1);
      const summary = buildPreBranchSummary(source.title, branch.title, slice);
      setProjects((list) =>
        list.map((p) => ({
          ...p,
          turns: p.turns.map((t) =>
            t.id === turnId ? { ...t, preBranchSummary: summary } : t
          ),
        }))
      );
    },
    [projects]
  );

  /** 文档问答：同名项目（论文: xxx）不存在则创建，然后开新 turn。
      回复走 deliverReply（BYOK 真实 API）。
      文档全文注入上下文（截断 8000 字）：术语解释真正基于论文内容，而非泛泛而谈。 */
  const openDocQuestion = useCallback(
    (term: string, docId: string) => {
      const doc = documents.find((d) => d.id === docId) ?? null;
      const docName = doc?.name ?? "文档";
      const projectTitle = `论文：${docName}`;
      const question = `什么是「${term}」？\n\n> 来自论文《${docName}》`;
      // 同步决定项目 id——不能在 updater 里写副作用（React 可能多次/延迟调用 updater，
      // 曾导致 activeProjectId 指向不存在的 id）。
      const existing = projects.find((p) => p.title === projectTitle);
      const pid = existing ? existing.id : uid();
      if (!existing) {
        const p: ChatProject = {
          ...makeDemoProject(),
          id: pid,
          title: projectTitle,
          folder: "doc",
        };
        setProjects((list) => [p, ...list]);
      }
      const turnId = appendTurn(pid, term, question);
      setActiveDocId(null); // 回到对话视图看回答
      focusTurn(pid, turnId); // 树聚焦 + 滚动定位到新卡
      markBusy(turnId);
      const truncated = doc ? doc.content.length > 8000 : false;
      const history = [
        {
          role: "user",
          content: `用户正在阅读论文《${docName}》，遇到了术语「${term}」。请基于论文内容用中文详细解释，重要术语用 **加粗** 标记，方便继续深挖。论文全文：\n\n${doc ? doc.content.slice(0, 8000) : "（文档内容不可用）"}${truncated ? "\n\n（文档过长，以上为前 8000 字）" : ""}`,
        },
      ];
      deliverReply(`什么是「${term}」？`, history, pid, undefined, turnId);
      // Mark term as asked (personalization).
      setTermStates((s) => ({ ...s, [term]: "asked" }));
    },
    [projects, documents, appendTurn, deliverReply, focusTurn, markBusy]
  );

  /** 文档解读块/段落 → 分支卡片：在「论文：xxx」项目中创建分支，来源 = 该项目最新轮次
      （无轮次则先建「📄 阅读《xxx》」上下文轮次）。修：不再挂到"最后一个轮次"——空项目
      悬空发散（平行视图白屏）与挂错无关轮次（树位置误导）两个问题一并解决。 */
  const openDocBranch = useCallback(
    (title: string, block: string, docName: string) => {
      const projectTitle = `论文：${docName}`;
      const existing = projects.find((p) => p.title === projectTitle);
      const pid = existing ? existing.id : uid();
      if (!existing) {
        setProjects((list) => [
          { ...makeDemoProject(), id: pid, title: projectTitle, folder: "doc" },
          ...list,
        ]);
      }
      const proj = existing ?? projects.find((p) => p.id === pid);
      // 来源 = 最近的非发散轮次：文档发散统一挂在文档上下文/问答轮次下，
      // 连续开多张卡时不会"发散挂发散"（同一来源的平行会话聚在同一组）。
      const last = proj ? [...proj.turns].reverse().find((t) => t.kind !== "diverge") ?? null : null;
      // 项目尚无任何轮次 → 建一个文档上下文来源轮次（树中可见、平行/分支有真实来源）。
      const sourceId =
        last?.id ??
        appendTurn(pid, `📄 阅读《${docName}》`, `阅读文档《${docName}》，AI 解读完成，可在此继续深挖`);
      const r = openBranchTurn(
        title,
        [{ role: "user", content: `文档《${docName}》中的段落：\n\n${block}` }],
        sourceId,
        pid
      );
      focusTurn(pid, r.id); // 切项目 + 回对话视图 + 滚动/滑动定位
      return r;
    },
    [projects, appendTurn, openBranchTurn, focusTurn]
  );

  /** 文档解读块/段落 → 发散卡片：锚点 = 文档名 + 块文本；来源与创建项目同 openDocBranch。 */
  const openDocDiverge = useCallback(
    (title: string, block: string, docName: string) => {
      const projectTitle = `论文：${docName}`;
      const existing = projects.find((p) => p.title === projectTitle);
      const pid = existing ? existing.id : uid();
      if (!existing) {
        setProjects((list) => [
          { ...makeDemoProject(), id: pid, title: projectTitle, folder: "doc" },
          ...list,
        ]);
      }
      const proj = existing ?? projects.find((p) => p.id === pid);
      const last = proj ? [...proj.turns].reverse().find((t) => t.kind !== "diverge") ?? null : null;
      const sourceId =
        last?.id ??
        appendTurn(pid, `📄 阅读《${docName}》`, `阅读文档《${docName}》，AI 解读完成，可在此继续深挖`);
      const r = openDivergeTurn(
        title,
        sourceId,
        { sourceTitle: docName, anchorText: block.slice(0, 400) },
        pid
      );
      focusTurn(pid, r.id);
      return r;
    },
    [projects, appendTurn, openDivergeTurn, focusTurn]
  );

  /** 基于当前打开的文档提问：自动建/复用「论文：xxx」项目 + 新 turn，
      文档全文注入上下文（截断 8000 字），AI 基于文件内容解读；随后切回对话视图看回答。 */
  const sendDocQuestion = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const doc = documents.find((d) => d.id === activeDocId) ?? null;
      if (!doc) return;
      const projectTitle = `论文：${doc.name}`;
      const existing = projects.find((p) => p.title === projectTitle);
      const pid = existing ? existing.id : uid();
      if (!existing) {
        const p: ChatProject = {
          ...makeDemoProject(),
          id: pid,
          title: projectTitle,
          folder: "doc",
        };
        setProjects((list) => [p, ...list]);
      }
      const plain = content
        .split("\n")
        .filter((l) => !l.trim().startsWith(">"))
        .join(" ")
        .trim();
      const title = plain.length > 18 ? plain.slice(0, 18) + "…" : plain || "文档提问";
      const turnId = appendTurn(pid, title, content);
      setActiveDocId(null); // 回对话视图看回答
      focusTurn(pid, turnId); // 树聚焦 + 滚动定位到新卡
      markBusy(turnId);
      const truncated = doc.content.length > 8000;
      const history = [
        {
          role: "user",
          content: `用户正在阅读论文《${doc.name}》，请基于论文内容回答下面的问题。论文全文：\n\n${doc.content.slice(0, 8000)}${truncated ? "\n\n（文档过长，以上为前 8000 字，回答时请说明只能基于这部分内容）" : ""}`,
        },
      ];
      deliverReply(content, history, pid, undefined, turnId);
    },
    [projects, documents, activeDocId, busy, appendTurn, deliverReply, focusTurn, markBusy]
  );

  /** AI 解读文档：先理解内容 → 按语义分块 + 双语对照 + 格式工整（markdown）。
      BYOK 走真实流式 API（边生成边写入 doc.interpreted，解读视图即时浮现），
      失败明确提示；force = 忽略已有缓存重新解读。 */
  const interpretDocument = useCallback(
    (docId: string, force = false) => {
      const doc = documents.find((d) => d.id === docId) ?? null;
      if (!doc || docInterpretingIds.includes(docId)) return;
      if (!force && doc.interpreted) return; // 已有缓存
      const byok = byokModels.find(
        (m) => m.id === settings.activeModelId && m.provider === "BYOK"
      );
      if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
        setAppNotice("请先在设置 → AI 模型中配置 API 模型");
        return;
      }
      setDocInterpretingIds((ids) => [...ids, docId]);
      const finish = () =>
        setDocInterpretingIds((ids) => ids.filter((id) => id !== docId));
      const apply = (md: string) => {
        setDocuments((list) =>
          list.map((d) =>
            d.id === docId ? { ...d, interpreted: md, interpretedAt: Date.now() } : d
          )
        );
        finish();
      };
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 45000);
      let acc = "";
      let lastFlush = 0;
      // 流式写入（节流 ~250ms）：首字到达前解读视图显示"解读中"，
      // 之后块随生成进度逐渐浮现——上传后第一时间就看到 AI 如何分块。
      const flush = () => {
        setDocuments((list) =>
          list.map((d) => (d.id === docId ? { ...d, interpreted: acc } : d))
        );
      };
      streamOpenAICompatible(
        byok,
        [
          {
            role: "user",
            content: [
              `请先理解下面这份论文/文档的内容，然后输出一份"解读版"。这是供用户精读论文用的解读，请做到：`,
              ``,
              `1. 【全文概览】开头先输出 \`## 全文概览\` 块：用 3-6 条要点概括——研究/写作背景、核心问题、主要方法、关键结论与创新点；`,
              `2. 【语义分块】按语义把内容分成若干清晰的块，每块用 \`## 块标题\` 开头（3-12 块，标题简短概括主旨）；每块必须有实质内容——标题、作者、日期、脚注等零碎信息不要单独成块，并入「全文概览」或相邻块；`,
              `3. 【双语对照】以中文为阅读主语言，但不要只给译文——每块正文包含两部分：a) 中文解读/翻译，专业术语首次出现保留英文括号注释，如"机器学习（Machine Learning）"；b) 块末用引用格式附上对应的英文原文（\`> 原文…\`），供逐句对照；原文已是中文的块只需润色成通顺书面语、重要专有名词保留英文原名，无需附对照；`,
              `4. 【工整易读】整理格式：数据、公式、引文、图表描述、列表等关键信息一律保留不得省略；用 markdown 的列表/引用/强调组织层级；去掉页眉页脚、目录与重复噪音；`,
              `5. 【术语标记】遇到关键概念、术语、人名用 **加粗** 标记，方便继续深挖。`,
              ``,
              `直接输出整理结果，不要任何开场白或额外解释。`,
              ``,
              `文档《${doc.name}》：`,
              doc.content.slice(0, 14000),
            ].join("\n"),
          },
        ],
        (delta) => {
          acc += delta;
          const now = Date.now();
          if (now - lastFlush > 250) {
            lastFlush = now;
            flush();
          }
        },
        controller.signal,
        () => window.clearTimeout(timer)
      )
        .then(() => {
          window.clearTimeout(timer);
          if (acc.trim().length >= 40) apply(acc);
          else {
            // 失败：清掉流式期间已 flush 的半成品，避免下次命中"已有缓存"读到残片。
            setDocuments((list) =>
              list.map((d) =>
                d.id === docId ? { ...d, interpreted: undefined, interpretedAt: undefined } : d
              )
            );
            setAppNotice("文档解读失败：模型未返回有效内容");
            finish();
          }
        })
        .catch(() => {
          window.clearTimeout(timer);
          setDocuments((list) =>
            list.map((d) =>
              d.id === docId ? { ...d, interpreted: undefined, interpretedAt: undefined } : d
            )
          );
          setAppNotice("文档解读失败：请检查 API 配置或网络");
          finish();
        });
    },
    [documents, docInterpretingIds, byokModels, settings.activeModelId]
  );

  /** 个人记忆：手动添加"关于我"的事实（去重：同文本不再重复添加） */
  const addMemory = useCallback((text: string, category?: string) => {
    const t = text.trim();
    if (!t) return;
    setMemories((list) =>
      list.some((m) => m.text === t) ? list : [...list, { id: uid(), text: t, category: category?.trim() || undefined, source: "manual", createdAt: Date.now() }]
    );
  }, []);

  const removeMemory = useCallback((id: string) => {
    setMemories((list) => list.filter((m) => m.id !== id));
  }, []);

  const addThoughtNode = useCallback(
    (subject: string, content: string, category = "概念", parentSubject: string | null = null) => {
      setThoughtNodes((list) => [
        ...list,
        {
          id: uid(),
          subject,
          content,
          category,
          createdAt: Date.now(),
          status: "pending",
          parentSubject,
        },
      ]);
    },
    []
  );

  const validateThoughtNode = useCallback((id: string) => {
    setThoughtNodes((list) =>
      list.map((n) => (n.id === id ? { ...n, status: "validated", validatedAt: Date.now() } : n))
    );
  }, []);

  const removeThoughtNode = useCallback((id: string) => {
    setThoughtNodes((list) => list.filter((n) => n.id !== id));
  }, []);

  const markTermState = useCallback((term: string, state: TermState) => {
    setTermStates((s) => ({ ...s, [term]: state }));
  }, []);

  const addDocument = useCallback((doc: DocumentItem) => {
    setDocuments((list) => [doc, ...list]);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((list) => list.filter((d) => d.id !== id));
    // 函数式更新走底层 state（包装版只处理显式 id）
    setActiveDocIdState((cur) => (cur === id ? null : cur));
  }, []);

  // context value 记忆化：避免每次渲染重建对象导致全部消费组件重渲染
  // （流式每 delta 只变 projects，其余 state 引用稳定）
  const value = useMemo<AppState>(
    () => ({
      settings,
      setSettings,
      projects,
      activeProjectId,
      createProject,
      selectProject,
      selectResident,
      deleteProject,
      renameProject,
      folders,
      createFolder,
      removeFolder,
      moveProjectToFolder,
      smartMode,
      toggleSmartMode,
      importProject,
      exportBackup,
      importBackup,
      byokModels,
      addByokModel,
      updateByokModel,
      removeByokModel,
      markOnboarded,
      collapsed,
      toggleSidebar,
      mindscapeOpen,
      setMindscapeOpen,
      modals,
      openModal,
      closeModal,
      turns,
      activeTurn,
      sendMessage,
      parallelSendTarget,
      setParallelSendTarget,
      sendInTurn,
      sendDocQuestion,
      interpretDocument,
      docInterpretingIds,
      treeFocus,
      setTreeFocus,
      busy,
      mainBusy,
      isTurnBusy,
      stopStreaming,
      stopTurn,
      registerStreamController,
      streamingTurnId,
      openBranchTurn,
      openDivergeTurn,
      setBranchPoint,
      summarizePreBranch,
      profile,
      setProfile,
      memories,
      addMemory,
      removeMemory,
      termStack,
      setTermStack,
      memorySystemPrompt,
      thoughtNodes,
      addThoughtNode,
      recordExploration,
      validateThoughtNode,
      removeThoughtNode,
      termStates,
      markTermState,
      documents,
      addDocument,
      removeDocument,
      activeDocId,
      setActiveDocId,
      pendingQuote,
      setPendingQuote,
      setTurnUnread,
      toggleFavorite,
      removeTurn,
      clearResidentChat,
      focusTurn,
      clearFocusRequest,
      focusRequest,
      cardOpenRequest,
      requestCardOpen,
      clearCardOpenRequest,
      turnSummaries,
      summarizingTurnId,
      summarizeTurn,
      openDocQuestion,
      openDocBranch,
      openDocDiverge,
      universeOpen,
      setUniverseOpen,
      appNotice,
      setAppNotice,
      updateInfo,
      refreshUpdateInfo,
    }),
    [
      settings,
      projects,
      activeProjectId,
      folders,
      smartMode,
      byokModels,
      collapsed,
      mindscapeOpen,
      modals,
      turns,
      activeTurn,
      parallelSendTarget,
      docInterpretingIds,
      treeFocus,
      busy,
      mainBusy,
      isTurnBusy,
      streamingTurnId,
      stopStreaming,
      stopTurn,
      registerStreamController,
      profile,
      memories,
      termStack,
      memorySystemPrompt,
      thoughtNodes,
      termStates,
      documents,
      activeDocId,
      pendingQuote,
      focusRequest,
      cardOpenRequest,
      turnSummaries,
      summarizingTurnId,
      universeOpen,
      appNotice,
      createProject,
      selectProject,
      selectResident,
      deleteProject,
      renameProject,
      createFolder,
      removeFolder,
      moveProjectToFolder,
      toggleSmartMode,
      importProject,
      exportBackup,
      importBackup,
      addByokModel,
      removeByokModel,
      toggleSidebar,
      setMindscapeOpen,
      openModal,
      closeModal,
      sendMessage,
      setParallelSendTarget,
      sendInTurn,
      sendDocQuestion,
      interpretDocument,
      setTreeFocus,
      openBranchTurn,
      openDivergeTurn,
      setBranchPoint,
      summarizePreBranch,
      setProfile,
      addMemory,
      removeMemory,
      addThoughtNode,
      recordExploration,
      validateThoughtNode,
      removeThoughtNode,
      markTermState,
      addDocument,
      removeDocument,
      setActiveDocId,
      setPendingQuote,
      setTurnUnread,
      toggleFavorite,
      removeTurn,
      clearResidentChat,
      focusTurn,
      clearFocusRequest,
      clearCardOpenRequest,
      requestCardOpen,
      summarizeTurn,
      openDocQuestion,
      openDocBranch,
      openDocDiverge,
      setUniverseOpen,
      setAppNotice,
      updateInfo,
      refreshUpdateInfo,
      markOnboarded,
      updateByokModel,
      setSettings,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
