"use client";

/**
 * Explore — ChatCard (knowledge card: turn list + message bubbles + recursive term tree)
 * 术语卡片 = 可对话的卡片：点开卡片后可以在卡片内继续向 AI 提问（BYOK 流式 API），
 * 回复里的 **加粗术语** 可点击 → 继续开子卡片深挖。
 */
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  GitFork,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Quote,
  Scissors,
  Send,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useApp, streamOpenAICompatible } from "./app-context";
import { explorationChains, type ExploreEntry } from "./turn-graph";
import { findTerm, GLOSSARY } from "@/lib/sites/ai-explore-poker-820d0558/mock";
import type { AttachedImage, Message, TermNode, Turn } from "@/types/sites/ai-explore-poker-820d0558";

const uid = () => "m-" + Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* 用户消息气泡（含视觉模式图片网格 + lightbox）                         */
/* ------------------------------------------------------------------ */

/** 消息图片网格 + 简易 lightbox（fixed 遮罩，Esc/点击关闭）。 */
function MessageImages({ images }: { images: AttachedImage[] }) {
  const [lightbox, setLightbox] = useState<AttachedImage | null>(null);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (images.length === 0) return null;
  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox(img)}
            title={img.name}
            className="h-20 w-20 overflow-hidden rounded-lg border border-std/60 bg-item-std transition-transform hover:scale-105"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.thumbDataUrl} alt={img.name} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.fullDataUrl || lightbox.thumbDataUrl}
            alt={lightbox.name}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

/** 用户消息气泡：文本 + 图片（视觉模式）。 */
function UserMessageBubble({ message }: { message: Message }) {
  return (
    <div className="flex flex-col items-end gap-2 mt-3">
      <div className="bg-usermsg shadow-usermsg rounded-usermsg px-3 py-2 relative max-w-[90%]">
        <span className="text-text-content whitespace-pre-wrap">{message.content}</span>
        {message.images && message.images.length > 0 && (
          <MessageImages images={message.images} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 对话区视图模型                                                        */
/* ------------------------------------------------------------------ */

/** 主对话区视图：主流（纵向堆叠，向下生长）或 平行组（来源 + 发散卡，横向同级滑动）。 */
type ViewSpec = { kind: "stream" } | { kind: "parallel"; sourceId: string; cardId: string };

function sameView(a: ViewSpec, b: ViewSpec): boolean {
  return a.kind === "stream" && b.kind === "stream"
    ? true
    : a.kind === "parallel" &&
        b.kind === "parallel" &&
        a.sourceId === b.sourceId &&
        a.cardId === b.cardId;
}

/* ------------------------------------------------------------------ */
/* Recursive term tree helpers                                         */
/* ------------------------------------------------------------------ */

const KIND_BADGE: Record<TermNode["kind"], string> = {
  child: "↗️ 子卡片",
  related: "➡️ 关联卡片",
  branch: "⬇️ 分支卡片",
  diverge: "🪢 发散卡片",
};

const KIND_ICON: Record<TermNode["kind"], string> = {
  child: "↗️",
  related: "➡️",
  branch: "⬇️",
  diverge: "🪢",
};

/** Resolve a term to a tree node; glossary terms get their short explain;
    unknown terms get an empty summary (the card will auto-ask the AI). */
function resolveTerm(term: string): TermNode {
  const treeNode = findTerm(term);
  if (treeNode) return treeNode;
  const g = GLOSSARY.find(
    (x) => x.zh === term || x.en.toLowerCase() === term.toLowerCase()
  );
  if (g) {
    return {
      id: "glossary-" + term,
      term,
      kind: "related",
      summary: `**${g.zh}**（${g.en}）\n\n${g.explain}`,
    };
  }
  return { id: "fallback-" + term, term, kind: "related", summary: "" };
}

/** Normalize ReactMarkdown strong-children into a plain string. */
function toTerm(children: ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toTerm).join("");
  return String(children);
}

/* ------------------------------------------------------------------ */
/* Markdown 组件守卫：避免非法嵌套（button 套 button / button 套 a）      */
/* ------------------------------------------------------------------ */

/** 链接上下文：markdown 链接（[**术语**](url)）内部的加粗不渲染成 <button>
    （HTML 禁止 <button> 嵌套在 <a> 内），回退为普通 <strong>。 */
const InLinkContext = createContext(false);

/** 加粗节点是否包含嵌套的加粗（**外层 **内层** …**）——CommonMark 允许这种写法，
    两个 strong 都会被我们的渲染器变成 <button>，导致 button-in-button 非法嵌套。
    外层有嵌套时回退为普通 <strong>（内层仍可点击）。 */
function hasNestedStrong(node: unknown): boolean {
  const children = (node as { children?: unknown[] } | undefined)?.children ?? [];
  return children.some((c) => {
    const el = c as { type?: unknown; tagName?: unknown };
    return el?.type === "element" && (el.tagName === "strong" || hasNestedStrong(c));
  });
}

/** markdown 链接覆盖：置位 InLinkContext，保证链接内的 strong 不会变成 button。 */
function LinkWrap({ node, children }: { node?: unknown; children?: ReactNode }) {
  const href = (node as { properties?: { href?: unknown } } | undefined)?.properties?.href;
  return (
    <InLinkContext.Provider value={true}>
      <a href={typeof href === "string" ? href : "#"}>{children}</a>
    </InLinkContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* TermCard — one layer of the recursive term tree                     */
/* ------------------------------------------------------------------ */

interface TermCardProps {
  node: TermNode;
  messages: Message[];
  busy: boolean;
  /** 深挖路径（根 → … → 本卡），头部展示主线 */
  path: string;
  onClose(): void;
  onTermClick(term: string): void;
  onCollect(): void;
  onBranch(): void;
  /** 发散卡片：以本术语开平行会话（不打断当前对话） */
  onDiverge(): void;
  onAsk(question: string): void;
}

function TermCard({ node, messages, busy, path, onClose, onTermClick, onCollect, onBranch, onDiverge, onAsk }: TermCardProps) {
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚底（随回复增长）。
  const lastLen = messages[messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastLen, messages.length, busy]);

  const send = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    onAsk(q);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    });
  };

  // 卡内 markdown：**加粗术语** → 可点击，继续开子卡片深挖。
  // 嵌套加粗 / 链接内的加粗回退为普通 <strong>（避免 button-in-button / button-in-a 非法嵌套）。
  // useMemo：避免每次渲染重建 components 对象导致 ReactMarkdown 子树全量重渲染。
  const mdComponents = useMemo(
    () => ({
      a: LinkWrap,
      strong: ({ node, children }: { node?: unknown; children?: ReactNode }) => {
        const text = toTerm(children).trim();
        const inLink = useContext(InLinkContext);
        if (!text || inLink || hasNestedStrong(node)) return <strong>{children}</strong>;
        return (
          <button
            type="button"
            className="term-chip font-semibold cursor-pointer text-brand underline decoration-brand/50 decoration-[1.5px] underline-offset-2 hover:decoration-brand transition-colors duration-300"
            onClick={() => onTermClick(text)}
          >
            {children}
          </button>
        );
      },
    }),
    [onTermClick]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl">
      {/* header: kind badge + term name + collect + close（第二行 = 深挖路径主线） */}
      <div className="flex flex-col gap-0.5 px-3 sm:px-4 py-2 border-b border-divider shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand border border-brand/40 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
            {KIND_BADGE[node.kind]}
          </span>
          <span className="font-bold text-lg truncate min-w-0 flex-1">{node.term}</span>
          <button
            type="button"
            className="w-8 h-8 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shrink-0 text-brand transition-colors"
            title="收录进思维宇宙"
            onClick={onCollect}
          >
            <BookmarkPlus size={16} />
          </button>
          <button
            type="button"
            className="w-8 h-8 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shrink-0 transition-colors"
            title="关闭"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {path && path !== node.term && (
          <div className="text-[11px] text-text-quaternary truncate" title={path}>
            🧭 {path}
          </div>
        )}
      </div>

      {/* 卡片对话区：术语摘要 + 卡内问答 */}
      <div
        ref={scrollRef}
        className="mind-md flex-1 min-h-0 overflow-y-auto scrollbar-card-std px-4 py-3"
      >
        {node.summary && (
          <div className="markdown-content text-text-content">
            <ReactMarkdown components={mdComponents}>{node.summary}</ReactMarkdown>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <UserMessageBubble key={m.id} message={m} />
          ) : (
            <div key={m.id} className="markdown-content w-full mt-3 text-text-content">
              <ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown>
            </div>
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 py-1" aria-hidden>
            <span className="inline-block w-2 h-4 bg-brand animate-pulse" />
          </div>
        )}
        {messages.length === 0 && (
          <p className="mt-3 text-xs text-text-tertiary">
            {node.summary
              ? "在这个卡片里继续问 AI —— 点击回复中的加粗术语可以继续往下深挖。"
              : "这个词条还没有内容。可以直接在下面输入框提问，AI 会结合当前上下文回答。"}
          </p>
        )}
      </div>

      <div className="mx-4 mt-2 flex shrink-0 gap-2">
        {node.kind === "branch" && (
          <button
            type="button"
            className="h-9 flex-1 rounded-xl bg-btn-std hover:bg-btn-std-hover text-[13px] text-brand transition-colors"
            onClick={onBranch}
          >
            ⬇️ 另起炉灶 · 开新对话
          </button>
        )}
        <button
          type="button"
          title={`以「${node.term}」开一个不打断当前对话的平行会话`}
          className="h-9 flex-1 rounded-xl border border-brand/30 bg-brand/[0.06] hover:bg-brand/15 text-[13px] text-brand transition-colors"
          onClick={onDiverge}
        >
          🪢 发散对话 · 平行会话
        </button>
      </div>

      {/* 卡内输入条 */}
      <div className="shrink-0 border-t border-divider p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`在「${node.term}」里继续问…（Enter 发送）`}
            className="block w-full min-h-0 flex-1 bg-inputarea border border-std rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-brand/50 placeholder:text-text-quaternary scrollbar-inputarea max-h-[120px] overflow-y-auto"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || busy}
            aria-label="发送"
            className="h-9 w-9 rounded-full bg-btn-inputarea text-brand-fg flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ChatCard                                                            */
/* ------------------------------------------------------------------ */

interface StackItem {
  node: TermNode;
  /** unique per push, re-triggers the enter animation on each layer */
  key: string;
  /** 卡片内自己的对话 */
  messages: Message[];
  /** 深挖路径（根 → … → 本卡），给 AI 当上下文 */
  path: string;
  busy: boolean;
  /** 来源轮次（记录探索路径用） */
  sourceTurnId: string;
  /** 打开本卡时所在的父卡片术语；null = 从主对话点开（收录进思维宇宙时用于真实连线） */
  parentSubject: string | null;
}

export function ChatCard() {
  const {
    turns,
    busy,
    streamingTurnId,
    projects,
    activeProjectId,
    deleteProject,
    renameProject,
    termStates,
    addThoughtNode,
    recordExploration,
    markTermState,
    openBranchTurn,
    openDivergeTurn,
    setBranchPoint,
    summarizePreBranch,
    openModal,
    byokModels,
    settings,
    pendingQuote,
    setPendingQuote,
    setAppNotice,
    memorySystemPrompt,
    toggleFavorite,
    setTurnUnread,
    focusTurn,
    focusRequest,
    clearFocusRequest,
    setParallelSendTarget,
    setTreeFocus,
    sendInTurn,
    removeTurn,
    clearResidentChat,
    cardOpenRequest,
    clearCardOpenRequest,
  } = useApp();

  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  /** 正在调整分支点的分支轮次 id（上游每条消息旁出现"✂️ 在此分支"） */
  const [branchPointEditing, setBranchPointEditing] = useState<string | null>(null);
  /** 分支卡续问草稿（turnId → 输入文本）；分支卡是"另起炉灶的对话"，可继续在卡内提问 */
  const [branchDrafts, setBranchDrafts] = useState<Record<string, string>>({});
  const [hlTerm, setHlTerm] = useState<string | null>(null);
  const hlTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** recursive term-card stack: index 0 = clicked term, deeper layers = child cards */
  const [termStack, setTermStack] = useState<StackItem[]>([]);
  const stackSeq = useRef(0);
  /** 未知词条自动问 AI 的会话级缓存（term → 卡片消息）。
      探索路径/主对话重复打开同一未知词条时直接读缓存，不再发 API 请求（省 token）。 */
  const autoAskCache = useRef(new Map<string, Message[]>());
  /** 正在飞行中的自动问（term），防止并发重复请求。 */
  const autoAskInflight = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  /** term card closing animation state (exit class applied, then unmount) */
  const [termClosing, setTermClosing] = useState<string | null>(null);
  /** 选中 AI 回复文本 → 引用：浮动"引用"按钮的位置与内容 */
  const [quoteSel, setQuoteSel] = useState<{ text: string; x: number; y: number } | null>(null);

  /* --- 视图：主流（纵向堆叠）↔ 平行组（来源 + 发散卡，横向同级滑动） --- */
  const [view, setView] = useState<ViewSpec>({ kind: "stream" });
  /** 视图过渡：from → to（dir = to 进入方向，"left" = 从右滑入） */
  const [slide, setSlide] = useState<{ from: ViewSpec; to: ViewSpec; dir: "left" | "right" } | null>(
    null
  );
  const slideTimer = useRef<number | null>(null);
  const slideSeq = useRef(0);

  /** Empty-state "OriginExplore" title size: 48px desktop / 26px mobile
      (Monoton glyphs are ~40% wider than the old Bruno Ace). */
  const [titleSize, setTitleSize] = useState(48);
  useEffect(() => {
    const compute = () => setTitleSize(window.innerWidth < 640 ? 26 : 48);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  /** 主流：纵向堆叠的对话卡片（root + 分支；发散卡片只在平行视图出现，
      主对话框继续询问 → 新卡片向下出现）。 */
  const streamTurns = useMemo(() => turns.filter((t) => t.kind !== "diverge"), [turns]);
  /** 平行组：来源轮次 + 它的直接发散卡片（同级，横向切换）。 */
  const parallelCards = useMemo(
    () => (sourceId: string): Turn[] => {
      const source = turns.find((t) => t.id === sourceId);
      if (!source) return [];
      return [
        source,
        ...turns.filter((t) => t.kind === "diverge" && t.divergeSourceId === sourceId),
      ];
    },
    [turns]
  );

  useEffect(() => {
    return () => {
      if (hlTimeout.current) clearTimeout(hlTimeout.current);
      if (slideTimer.current) clearTimeout(slideTimer.current);
    };
  }, []);

  // Auto-scroll to the bottom while the reply streams in (content grows) —
  // 但只在用户"贴底"时跟随（上滚阅读则不拉回，并触发未读标记）。
  // 用 sticky 引用而非瞬时判断：内容尚未溢出时 scrollTop 恒为 0，
  // 瞬时判断会在"刚好溢出"那一刻错过跟随。
  // 流式贴底信号：任一 turn 的最后一条消息长度增长都会触发跟随检查。
  // 用"最大长度"而非"最后一个 turn"：平行视图向非尾部发散卡提问时，
  // 流式目标可能不是 turns 尾部（修：发散卡在平行视图流式回复不贴底）。
  const lastMsgLen = useMemo(
    () =>
      turns.reduce(
        (max, t) => Math.max(max, t.messages[t.messages.length - 1]?.content.length ?? 0),
        0
      ),
    [turns]
  );
  const stickToBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 流式输出目标 = streamingTurnId 指向的轮次（不再假设"最后一个 turn"）：
    // 主流（纵向流）按用户贴底状态跟随；平行视图仅当聚焦的就是流式发散卡。
    const streaming = streamingTurnId ? turns.find((t) => t.id === streamingTurnId) ?? null : null;
    const inFocus =
      view.kind === "stream"
        ? streaming?.kind !== "diverge"
        : streaming?.kind === "diverge" &&
          streaming.divergeSourceId === view.sourceId &&
          view.cardId === streaming.id;
    if (stickToBottom.current && inFocus) el.scrollTop = el.scrollHeight;
  }, [lastMsgLen, turns, view, streamingTurnId]);

  // 新回复完成时，若目标轮次不在当前视图视野内 → 标记未读。
  // 修：流式结束路径里 streamingTurnId 与 busy 同批提交（结束即清空），effect 读它永远是 null——
  // 改为 busy 期间用 ref 缓存最后流式目标，busy 回落时从 ref 取。
  const prevBusy = useRef(false);
  const lastStreamingTurn = useRef<string | null>(null);
  if (busy && streamingTurnId) lastStreamingTurn.current = streamingTurnId;
  useEffect(() => {
    if (prevBusy.current && !busy) {
      const lastId = lastStreamingTurn.current;
      lastStreamingTurn.current = null;
      const last = lastId ? turns.find((t) => t.id === lastId) ?? null : null;
      if (last) {
        if (last.kind === "diverge") {
          // 发散流式卡：创建时必已聚焦到平行视图 → 视为可见。
          if (view.kind !== "parallel" || view.cardId !== last.id) setTurnUnread(last.id, true);
        } else if (view.kind === "stream") {
          // 主流是堆叠视图：按 DOM 可见性判断（用户滚上去了 → 未读）。
          const el = scrollRef.current;
          const lastEl = document.getElementById(`chat-turn-${last.id}`);
          if (el && lastEl) {
            const r = el.getBoundingClientRect();
            const tr = lastEl.getBoundingClientRect();
            const visible = tr.top < r.bottom - 20 && tr.bottom > r.top + 20;
            if (!visible) setTurnUnread(last.id, true);
          }
        } else {
          setTurnUnread(last.id, true);
        }
      }
    }
    prevBusy.current = busy;
  }, [busy, turns, view, setTurnUnread]);

  /* --- 视图切换：主流 ↔ 平行组（同级滑动） --- */

  // 切换项目：回到主流视图、清空过渡、平行发送目标、术语卡栈与分支点编辑态
  // （修：跨项目残留术语卡 → 发散/分支挂到旧项目轮次 → 树关系错乱 + 平行视图白屏）。
  const prevProjectId = useRef<string | null>(activeProjectId);
  useEffect(() => {
    if (prevProjectId.current !== activeProjectId) {
      prevProjectId.current = activeProjectId;
      if (slideTimer.current) {
        clearTimeout(slideTimer.current);
        slideTimer.current = null;
      }
      setSlide(null);
      setView({ kind: "stream" });
      setParallelSendTarget(null);
      setTreeFocus(null);
      setTermStack([]);
      setBranchPointEditing(null);
    }
  }, [activeProjectId, turns, setParallelSendTarget, setTreeFocus]);

  // 视图失效兜底：平行视图指向的卡片被删除（removeTurn/清空对话）→ 回主流视图。
  useEffect(() => {
    if (view.kind !== "parallel") return;
    const cards = parallelCards(view.sourceId);
    if (cards.length === 0 || !cards.some((c) => c.id === view.cardId)) {
      setView({ kind: "stream" });
      setParallelSendTarget(null);
      setTreeFocus(null);
    }
  }, [turns, view, parallelCards, setParallelSendTarget, setTreeFocus]);

  // 过渡与视图的 ref 镜像（过渡中再次切换时需要确定性锚点）。
  const slideRef = useRef(slide);
  useEffect(() => {
    slideRef.current = slide;
  }, [slide]);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  /** 视图过渡方向：主流 → 平行 = 主流左移出、平行从右滑入；反向镜像；
      平行组内按组内下标差（向右 = 前进）。 */
  const viewDir = useCallback(
    (from: ViewSpec, to: ViewSpec): "left" | "right" => {
      if (from.kind === "stream") return "left";
      if (to.kind === "stream") return "right";
      if (from.sourceId === to.sourceId) {
        const cards = parallelCards(from.sourceId);
        const fi = cards.findIndex((c) => c.id === from.cardId);
        const ti = cards.findIndex((c) => c.id === to.cardId);
        return ti >= fi ? "left" : "right";
      }
      return "left";
    },
    [parallelCards]
  );

  /** 同步平行发送目标：平行视图聚焦发散卡 → 输入框顺延进该平行对话；
      否则发往主对话流。 */
  const syncSendTarget = useCallback(
    (v: ViewSpec) => {
      setParallelSendTarget(
        v.kind === "parallel"
          ? turns.find((t) => t.id === v.cardId)?.kind === "diverge"
            ? v.cardId
            : null
          : null
      );
    },
    [turns, setParallelSendTarget]
  );

  /** 同步卡片树聚焦：主流 → 最新一张对话卡；平行 → 当前卡 + 平行组来源。
      导航图据此高亮"你在这里"。 */
  const syncTreeFocus = useCallback(
    (v: ViewSpec) => {
      if (v.kind === "stream") {
        const stack = turns.filter((t) => t.kind !== "diverge");
        setTreeFocus(
          stack.length ? { cardId: stack[stack.length - 1].id, groupSourceId: null } : null
        );
      } else {
        setTreeFocus({ cardId: v.cardId, groupSourceId: v.sourceId });
      }
    },
    [turns, setTreeFocus]
  );

  /** 切换到目标视图（主流 或 平行组内的某张卡）。
      过渡中再次切换：先提交当前过渡，再以提交后的视图为起点重放。
      用户偏好减少动效时直接切换、不播放动画。 */
  const goTo = useCallback(
    (to: ViewSpec) => {
      let from = viewRef.current;
      if (slideTimer.current) {
        clearTimeout(slideTimer.current);
        slideTimer.current = null;
        const s = slideRef.current;
        if (s) {
          setSlide(null);
          setView(s.to);
          syncSendTarget(s.to); // 提交当前过渡后，可见视图 = 过渡目标，作为重放起点
          syncTreeFocus(s.to);
          from = s.to;
        }
      }
      if (sameView(from, to)) return;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setView(to);
        syncSendTarget(to);
        syncTreeFocus(to);
        return;
      }
      const dir = viewDir(from, to);
      const seq = ++slideSeq.current;
      setSlide({ from, to, dir });
      slideTimer.current = window.setTimeout(() => {
        if (slideSeq.current !== seq) return;
        setSlide(null);
        slideTimer.current = null;
        setView(to);
        syncSendTarget(to);
        syncTreeFocus(to);
      }, 400);
    },
    [viewDir, syncSendTarget, syncTreeFocus]
  );

  // 跳转（侧栏/导航图/新建轮次/收藏区）：发散 → 进入平行组；其余 → 主流 + 滚动定位。
  useEffect(() => {
    if (!focusRequest) return;
    const target = turns.find((t) => t.id === focusRequest.turnId) ?? null;
    setTurnUnread(focusRequest.turnId, false);
    clearFocusRequest();
    if (!target) return;
    if (target.kind === "diverge" && target.divergeSourceId) {
      goTo({ kind: "parallel", sourceId: target.divergeSourceId, cardId: target.id });
    } else {
      const leavingParallel = view.kind === "parallel";
      goTo({ kind: "stream" });
      // 修：发消息/跳转后卡片树聚焦必须同步到目标卡（sameView 短路时 goTo 不触发 syncTreeFocus，
      // 树会停留在上一张卡的辉光；syncTreeFocus 的 stream 分支只聚焦最后一张，这里直接指向目标）。
      setTreeFocus({ cardId: target.id, groupSourceId: null });
      // 主流是堆叠视图：滚动定位到目标卡片（从平行视图退出时等过渡完成再滚）。
      window.setTimeout(
        () => {
          document
            .getElementById(`chat-turn-${target.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        leavingParallel ? 460 : 0
      );
    }
  }, [focusRequest, turns, view, goTo, setTurnUnread, clearFocusRequest, setTreeFocus]);

  // 键盘 ←/→：仅平行视图内，在"来源 ↔ 发散卡"同级之间滑动切换
  // （输入框、术语卡片栈打开时不拦截；主流是纵向堆叠，无横向语义）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (termStack.length > 0) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (view.kind !== "parallel") return;
      const cards = parallelCards(view.sourceId);
      const idx = cards.findIndex((c) => c.id === view.cardId);
      if (idx < 0) return;
      const next = e.key === "ArrowRight" ? cards[idx + 1] : cards[idx - 1];
      if (next) {
        e.preventDefault();
        goTo({ kind: "parallel", sourceId: view.sourceId, cardId: next.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, parallelCards, termStack.length, goTo]);

  // 轮次导航图点击卡片节点 → 重新打开该术语卡片（不重复记录探索路径）。
  useEffect(() => {
    if (!cardOpenRequest) return;
    reopenFromTrail(cardOpenRequest.term, cardOpenRequest.turnId);
    clearCardOpenRequest();
  }, [cardOpenRequest, clearCardOpenRequest]);

  // 统一走全局底部提示（避免多套 toast 同位置堆叠）
  const showToast = (msg: string) => setAppNotice(msg);

  // 项目标题不再置顶显示（连续对话易偏离首条消息标题）；侧边栏与导出仍用 activeProject.title。
  const fmtTs = (ts: number) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  /* --- header actions --- */
  const handleCopy = async () => {
    if (!turns.length) {
      showToast("没有可复制的内容");
      return;
    }
    const text = turns
      .flatMap((t) => t.messages)
      .map((m) => `${m.role === "user" ? "我" : "AI"}：\n${m.content}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("✓ 已复制全部对话");
    } catch {
      showToast("复制失败：浏览器拒绝了剪贴板访问");
    }
  };

  const handleExport = () => {
    setMenuOpen(false);
    if (!activeProject) return;
    const data = { title: activeProject.title, turns: activeProject.turns };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.title || "project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ 已导出项目");
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (activeProjectId && !activeProject?.resident) {
      deleteProject(activeProjectId);
      showToast("已删除项目");
    }
  };

  const startRename = () => {
    setMenuOpen(false);
    setRenameDraft(activeProject?.title ?? "");
    setRenaming(true);
  };

  const confirmRename = () => {
    if (activeProjectId) renameProject(activeProjectId, renameDraft);
    setRenaming(false);
  };

  /* --- term expansion (recursive tree) --- */

  /** 开一张卡片；未知词条（空摘要）+ 已接 BYOK → 自动向 AI 提问解释（只问一次：
      会话级缓存命中或请求在途时直接复用，不重复消耗 token）。
      每次打开都会记入 sourceTurnId 的探索路径（opts.record=false 时跳过，
      用于从路径 chip 重新打开——重开会破坏原有链条顺序）。 */
  const openCard = (
    node: TermNode,
    path: string,
    sourceTurnId: string,
    parentSubject: string | null,
    opts?: { record?: boolean }
  ) => {
    stackSeq.current += 1;
    const key = `${node.id}-${stackSeq.current}`;
    const cached = autoAskCache.current.get(node.term);
    setTermStack((s) => [
      ...s,
      { node, key, messages: cached ?? [], path, busy: false, sourceTurnId, parentSubject },
    ]);
    if (opts?.record !== false) {
      recordExploration(sourceTurnId, node.term, node.kind, parentSubject);
    }
    const byok = byokModels.find(
      (m) => m.id === settings.activeModelId && m.provider === "BYOK"
    );
    if (
      !node.summary &&
      byok?.apiKey &&
      byok?.baseUrl &&
      byok?.modelId &&
      !cached &&
      !autoAskInflight.current.has(node.term)
    ) {
      window.setTimeout(() => {
        askInCard(
          key,
          `请详细解释「${node.term}」这个概念，重要术语用 **加粗** 标记。`,
          { node, path, messages: cached ?? [], busy: false },
          { silent: true }
        );
      }, 150);
    }
  };

  /** 从主对话的加粗术语点开卡片（记录到该术语所在轮次）。 */
  const handleTermClick = (term: string, turnId: string) => {
    const node = resolveTerm(term);
    openCard(node, node.term, turnId, null);
    setHlTerm(term);
    if (hlTimeout.current) clearTimeout(hlTimeout.current);
    hlTimeout.current = setTimeout(() => setHlTerm(null), 1500);
  };

  /** 从探索路径 chip 重新打开卡片：不重复记录（否则会打乱链条顺序）。 */
  const reopenFromTrail = (term: string, turnId: string) => {
    const node = resolveTerm(term);
    openCard(node, node.term, turnId, null, { record: false });
  };

  /** 在卡片里点击加粗术语 → 开子卡片（继承深挖路径，链回父卡片术语）。 */
  const handleCardTermClick = (parentKey: string, term: string) => {
    const parent = termStack.find((i) => i.key === parentKey);
    const node = resolveTerm(term);
    openCard(
      node,
      parent ? `${parent.path} → ${term}` : term,
      parent?.sourceTurnId ?? "",
      parent?.node.term ?? null
    );
  };

  /** 在卡片内提问：BYOK 流式 API；回复写进该卡片。
      `opts.silent`：静默提问（自动问 AI 用）——问题只发给 API，不渲染成对话里的用户消息。
      未知词条（node.summary 为空）的回答会写入会话级缓存（autoAskCache），
      同一词条重复打开直接复用，不再发 API 请求。 */
  const askInCard = (
    key: string,
    question: string,
    item: Pick<StackItem, "node" | "path" | "messages" | "busy">,
    opts?: { silent?: boolean }
  ) => {
    if (item.busy) return;
    // 同一词条的自动问已在途 → 跳过（防并发重复请求）。
    if (opts?.silent && autoAskInflight.current.has(item.node.term)) return;
    if (opts?.silent) autoAskInflight.current.add(item.node.term);

    const patch = (k: string, fn: (i: StackItem) => StackItem) =>
      setTermStack((s) => s.map((i) => (i.key === k ? fn(i) : i)));

    const userMsg: Message | null = opts?.silent
      ? null
      : { id: uid(), role: "user", content: question, createdAt: Date.now() };
    if (opts?.silent) {
      patch(key, (i) => ({ ...i, busy: true }));
    } else {
      patch(key, (i) => ({ ...i, messages: [...i.messages, userMsg!], busy: true }));
    }

    /** 未知词条回答完成后写入会话缓存（重开卡片零消耗）；树内词条不缓存（本来就不会自动问）。 */
    const remember = (finalContent: string) => {
      if (item.node.summary) return;
      const base = opts?.silent ? item.messages : [...item.messages, userMsg!];
      autoAskCache.current.set(item.node.term, [
        ...base,
        { id: uid(), role: "assistant", content: finalContent, createdAt: Date.now() },
      ]);
    };
    const clearInflight = () => {
      if (opts?.silent) autoAskInflight.current.delete(item.node.term);
    };

    const byok = byokModels.find(
      (m) => m.id === settings.activeModelId && m.provider === "BYOK"
    );
    const context: { role: string; content: string }[] = [
      ...(memorySystemPrompt ? [{ role: "system" as const, content: memorySystemPrompt }] : []),
      {
        role: "user",
        content: `我们正在深挖概念「${item.node.term}」（路径：${item.path}）。请用中文回答，重要术语用 **加粗** 标记，方便继续深挖。`,
      },
      ...item.messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    if (!byok || !byok.apiKey || !byok.baseUrl || !byok.modelId) {
      // 未配置 API：卡片内提问不可用，提示去设置配置。
      setAppNotice("请先在设置 → AI 模型中配置 API 模型");
      patch(key, (i) => ({ ...i, busy: false }));
      clearInflight();
      return;
    }
    const emptyMsg: Message = { id: uid(), role: "assistant", content: "", createdAt: Date.now() };
    patch(key, (i) => ({ ...i, messages: [...i.messages, emptyMsg] }));
    let acc = "";
    // 渲染节流（同 deliverReply）：40ms 合并写入，结束强制 flush
    let lastFlush = 0;
    const flushPatch = () => {
      patch(key, (i) => ({
        ...i,
        messages: i.messages.map((m, mi) =>
          mi === i.messages.length - 1 ? { ...m, content: acc } : m
        ),
      }));
      lastFlush = Date.now();
    };
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    streamOpenAICompatible(
      byok,
      context,
      (delta) => {
        acc += delta;
        const now = Date.now();
        if (now - lastFlush >= 40) flushPatch();
      },
      controller.signal,
      () => window.clearTimeout(timer)
    )
      .then(() => {
        window.clearTimeout(timer);
        flushPatch(); // 强制 flush 最后一节
        patch(key, (i) => ({ ...i, busy: false }));
        remember(acc);
        clearInflight();
      })
      .catch(() => {
        window.clearTimeout(timer);
        setAppNotice("API 请求失败：请检查模型配置或网络");
        const fallback = `> ⚠️ API 请求失败，请检查 API 地址 / Key 是否正确，或稍后重试。`;
        patch(key, (i) => ({
          ...i,
          busy: false,
          messages: i.messages.map((m, mi) =>
            mi === i.messages.length - 1 ? { ...m, content: fallback } : m
          ),
        }));
        // 失败不写 autoAskCache：错误文本不应被缓存为"术语知识"（本会话内可重试）
        clearInflight();
      });
  };

  /** Bookmark term into the mind universe + mark as mastered.
      带 parentSubject：从卡片收录时链回父卡片术语，思维宇宙里才有真实连线。 */
  const handleCollect = (item: StackItem) => {
    addThoughtNode(item.node.term, item.node.summary, "概念", item.parentSubject);
    markTermState(item.node.term, "mastered");
    showToast(`✓ 已收录「${item.node.term}」，待验证`);
  };

  /** Branch card → start a brand-new turn with this term as context,
      继承上游卡片主题 + 分支点之前的对话历史（原站语义）。 */
  const handleBranch = (item: StackItem) => {
    const history: { role: string; content: string }[] = [];
    for (const s of termStack) {
      history.push({ role: "user", content: `深挖路径节点：「${s.path}」` });
      for (const m of s.messages.slice(-6)) {
        history.push({ role: m.role, content: m.content });
      }
    }
    const r = openBranchTurn(item.node.term, history.slice(-16), item.sourceTurnId);
    if (activeProjectId) focusTurn(activeProjectId, r.id);
    showToast(
      r.created
        ? `✓ 已创建分支卡片「${item.node.term}」`
        : `已有同主题分支卡片「${item.node.term}」，已跳转`
    );
    setTermStack([]);
  };

  /** Divergence card → 以术语开"平行会话"（不打断当前对话）：保留卡片栈。
      携带来源锚点上下文：来源轮次标题 + 术语所在的那条 AI 消息段落，
      让平行会话知道术语的来源语境（如"工业革命语境下的煤炭"）。
      新建或复用均滑动聚焦到该发散卡片。 */
  const handleDiverge = (item: StackItem) => {
    const sourceTurn = turns.find((t) => t.id === item.sourceTurnId) ?? null;
    let anchorText: string | undefined;
    if (sourceTurn) {
      const hit = [...sourceTurn.messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.content.includes(item.node.term));
      anchorText = hit ? hit.content.replace(/\s+/g, " ").trim().slice(0, 400) : undefined;
    }
    const r = openDivergeTurn(item.node.term, item.sourceTurnId, {
      sourceTitle: sourceTurn?.title ?? "上游对话",
      anchorText,
    });
    if (activeProjectId) focusTurn(activeProjectId, r.id);
    showToast(
      r.created
        ? `✓ 已创建发散卡片「${item.node.term}」`
        : `已有同主题发散卡片「${item.node.term}」，已跳转`
    );
  };

  /** 调整分支点：把分支轮次的分叉位置改到上游第 index 条消息之后，
      并滚动回分支卡片。 */
  const handleBranchAt = (branchTurnId: string, index: number) => {
    setBranchPoint(branchTurnId, index);
    setBranchPointEditing(null);
    showToast("✓ 分支点已调整（旧总结已失效，可点 📋 重新生成）");
    document
      .getElementById(`chat-turn-${branchTurnId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** 复制一段文本（总结面板等）。 */
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("✓ 已复制");
    } catch {
      showToast("复制失败：浏览器拒绝了剪贴板访问");
    }
  };

  /** 正在调整分支点的分支轮次（其 parentTurnId 指向的轮次 = 上游，显示"✂️ 在此分支"）。 */
  const editedBranch = branchPointEditing
    ? turns.find((t) => t.id === branchPointEditing) ?? null
    : null;

  /* --- 引用回答（上下文管理）：选中 AI 回复文本 → 浮动"引用"按钮 --- */
  const handleQuoteMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setQuoteSel(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text || !(e.currentTarget as Node).contains(range.commonAncestorContainer)) {
      setQuoteSel(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left + rect.width / 2, 70), window.innerWidth - 70);
    const y = Math.max(rect.top - 46, 8);
    setQuoteSel({ text: text.slice(0, 300), x, y });
  };

  // 点击别处 / Escape / 滚动消息区 → 收起引用按钮
  useEffect(() => {
    if (!quoteSel) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.("[data-quote-btn]")) setQuoteSel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuoteSel(null);
    };
    const onScroll = () => setQuoteSel(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    scrollRef.current?.addEventListener("scroll", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      scrollRef.current?.removeEventListener("scroll", onScroll);
    };
  }, [quoteSel]);

  const confirmQuote = () => {
    setPendingQuote(quoteSel?.text ?? "");
    setQuoteSel(null);
    window.getSelection()?.removeAllRanges();
    showToast("✓ 已引用，可在输入框继续编辑");
  };

  /**
   * Close only the clicked card: animate it out, then drop this layer and
   * everything above it (the previous card is already visible underneath the
   * cascade, so no separate back button is needed).
   */
  const closeOne = (key: string, index: number) => {
    if (termClosing) return;
    setTermClosing(key);
    window.setTimeout(() => {
      setTermStack((s) => s.slice(0, index));
      setTermClosing(null);
    }, 280);
  };

  /* --- turn navigation: 主流（纵向堆叠）↔ 平行组（同级横向滑动） ---
     渲染结构在下方滚动容器内（turnCardBody / parallelNav / renderView 内联）。 */

  return (
    <div
      className={`text-primary relative h-full w-full transition-[height] duration-300 ease-in-out ${
        busy ? "streaming-active" : ""
      }`}
      style={{
        maxWidth: "min(990px, 100%)",
        height: minimized ? 48 : "100%",
        margin: "0 auto",
      }}
    >
      <div className="relative w-full h-full min-h-0 overflow-hidden rounded-[24px]">
        {/* ---------- header ----------
            顶部不再置顶显示项目标题：连续对话进行到后期往往已偏离首条消息的标题，
            悬浮置顶反而干扰阅读；项目标题仍保留在侧边栏与导出数据中，
            重命名时这里临时出现输入框。 */}
        <div className="absolute top-0 inset-x-0 h-9 px-4 flex items-center justify-between border-b border-divider z-[5]">
          {renaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
                else if (e.key === "Escape") setRenaming(false);
              }}
              onBlur={confirmRename}
              className="flex-1 min-w-0 mr-2 rounded bg-item-std px-2 py-0.5 text-[15px] font-bold text-primary outline-none ring-1 ring-brand/50"
            />
          ) : null}
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shadow-card transition-colors"
              title={minimized ? "展开卡片" : "收起卡片"}
              onClick={() => setMinimized((v) => !v)}
            >
              {minimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shadow-card transition-colors"
              title="复制对话"
              onClick={handleCopy}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shadow-card transition-colors"
              title="更多操作"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-36 bg-card-floating rounded-xl border border-std shadow-card p-1 flex flex-col">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg text-left text-[13px] text-text-secondary hover:bg-item-std-hover transition-colors"
                    onClick={startRename}
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg text-left text-[13px] text-text-secondary hover:bg-item-std-hover transition-colors"
                    onClick={handleExport}
                  >
                    导出为 JSON
                  </button>
                  {activeProject?.resident && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-left text-[13px] text-destructive hover:bg-item-std-hover transition-colors"
                      onClick={() => {
                        const ok = window.confirm(
                          `清空常驻聊天的全部对话？共 ${turns.length} 张卡片。`
                        );
                        if (!ok) return;
                        clearResidentChat();
                        setMenuOpen(false);
                        showToast("✓ 已清空常驻聊天");
                      }}
                    >
                      清空对话
                    </button>
                  )}
                  {!activeProject?.resident && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-left text-[13px] text-destructive hover:bg-item-std-hover transition-colors"
                      onClick={handleDelete}
                    >
                      删除
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {!minimized && (
          <>
            {/* ---------- scrollable turn list ---------- */}
            <div
              ref={scrollRef}
              className="absolute inset-0 overflow-y-auto scrollbar-card-std pt-[52px] pl-4 pb-6 pr-4"
            >
              {turns.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-12 -translate-y-[30px]">
                  <h1
                    className="font-monoton brand-neon select-none"
                    style={{
                      fontSize: `${titleSize}px`,
                      lineHeight: 1,
                    }}
                  >
                    OriginExplore
                  </h1>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => openModal("docs")}
                      className="cursor-pointer rounded-full bg-btn-std px-6 py-2 font-medium text-primary transition-colors hover:bg-btn-std-hover"
                    >
                      使用文档
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  /** 单张轮次卡片（主流堆叠与平行视图共用；idPrefix 防过渡期 id 冲突）。 */
                  const turnCardBody = (
                    turn: Turn,
                    idPrefix: "main" | "old" | "new",
                    animClass?: string,
                    extraClass?: string
                  ) => (
                    <div
                      key={`${turn.id}-${idPrefix}`}
                      id={idPrefix === "main" ? `chat-turn-${turn.id}` : undefined}
                      className={`flex flex-col gap-4 px-2 pb-2 rounded-xl relative border border-std/80 mb-4 scroll-mt-[52px] ${animClass ?? ""} ${extraClass ?? ""}`}
                    >
                    {/* turn header: big title only when there are multiple
                        turns (branch conversations need orientation); a single
                        turn already shows its title in the card header, so
                        repeating it here would be redundant */}
                    {turns.length > 1 && (
                      <div className="flex items-center gap-2 h-14 text-lg font-semibold truncate text-text-turn-title">
                        {turn.kind === "branch" && (
                          <span className="shrink-0 rounded-full border border-brand/40 px-2 py-0.5 text-[10px] text-brand select-none">
                            ⛓ 分支
                          </span>
                        )}
                        {turn.kind === "diverge" && (
                          <span className="shrink-0 rounded-full border border-diverge/40 px-2 py-0.5 text-[10px] text-diverge select-none">
                            🪢 发散
                          </span>
                        )}
                        <span className="w-full min-w-0 truncate">{turn.title}</span>
                      </div>
                    )}
                    {/* 分支点调整提示条（在上游轮次里，正在调整某个分支的分支点） */}
                    {editedBranch && turn.id === editedBranch.parentTurnId && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-[11px] text-brand select-none">
                        <span className="min-w-0 flex-1 truncate">
                          ✂️ 正在调整「{editedBranch.title}」的分支点：点击消息右侧的「在此分支」选择分叉位置
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] text-text-secondary hover:text-primary transition-colors"
                          onClick={() => {
                            setBranchPointEditing(null);
                            document
                              .getElementById(`chat-turn-${editedBranch.id}`)
                              ?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        >
                          取消
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pr-1 select-none">
                      {turn.kind === "branch" && (
                        <>
                          <button
                            type="button"
                            aria-label="查看/调整分支点"
                            title={
                              branchPointEditing === turn.id
                                ? "收起分支点调整"
                                : "查看并调整分支点（在来源对话中标记分割线位置）"
                            }
                            onClick={() => {
                              const editing = branchPointEditing === turn.id ? null : turn.id;
                              setBranchPointEditing(editing);
                              // 主流是堆叠视图：开始调整时滚动到来源轮次看 ✂️ 分割线。
                              if (editing && turn.parentTurnId) {
                                document
                                  .getElementById(`chat-turn-${turn.parentTurnId}`)
                                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                              branchPointEditing === turn.id
                                ? "border-brand/50 bg-brand/10 text-brand"
                                : "border-std bg-btn-std text-text-tertiary hover:border-brand/40 hover:text-brand"
                            }`}
                          >
                            <GitFork size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label="总结分支点前的上游对话"
                            title="总结分支点前的上游对话"
                            onClick={() => summarizePreBranch(turn.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-std bg-btn-std text-text-tertiary transition-colors hover:border-brand/40 hover:text-brand"
                          >
                            <FileText size={13} />
                          </button>
                        </>
                      )}
                      {/* 主流 ⇄ 平行入口：该对话有发散会话时可见，点击滑入平行视图 */}
                      {(() => {
                        const divergeKids = turns.filter(
                          (t) => t.kind === "diverge" && t.divergeSourceId === turn.id
                        );
                        if (divergeKids.length === 0) return null;
                        return (
                          <button
                            type="button"
                            aria-label="进入平行会话"
                            title={`${divergeKids.length} 个平行会话，点击进入`}
                            onClick={() =>
                              goTo({
                                kind: "parallel",
                                sourceId: turn.id,
                                cardId: divergeKids[0].id,
                              })
                            }
                            className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-diverge/40 bg-diverge/10 px-2 text-[10px] text-diverge transition-colors hover:bg-diverge/20"
                          >
                            ⇄ {divergeKids.length}
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => {
                          toggleFavorite(turn.id);
                          showToast(turn.favorite ? "已取消收藏" : "✓ 已收藏该轮次");
                        }}
                        aria-label={turn.favorite ? "取消收藏" : "收藏"}
                        title={turn.favorite ? "取消收藏" : "收藏轮次"}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                          turn.favorite
                            ? "border-brand/50 bg-brand/10 text-brand"
                            : "border-std bg-btn-std text-text-tertiary hover:border-brand/40 hover:text-brand"
                        }`}
                      >
                        <Star size={14} fill={turn.favorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // 递归子树计数（与 removeTurn 的级联删除一致）
                          const countSubtree = (id: string, seen: Set<string>): number => {
                            if (seen.has(id)) return 0;
                            seen.add(id);
                            let n = 0;
                            for (const t of turns) {
                              if (t.parentTurnId === id || t.divergeSourceId === id) {
                                n += 1 + countSubtree(t.id, seen);
                              }
                            }
                            return n;
                          };
                          const kids = countSubtree(turn.id, new Set());
                          const ok = window.confirm(
                            `删除卡片「${turn.title}」？${kids > 0 ? `其 ${kids} 张分支/发散卡片将一并删除。` : ""}`
                          );
                          if (!ok) return;
                          removeTurn(turn.id);
                          showToast("✓ 已删除卡片");
                        }}
                        aria-label="删除卡片"
                        title="删除这张卡片（分支/发散卡片一并删除）"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-std bg-btn-std text-text-tertiary transition-colors hover:border-destructive/50 hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className="text-[11px] text-text-quaternary">
                        {fmtTs(turn.createdAt)}
                      </span>
                    </div>
                    {/* 分支卡片：分支点前上游对话总结（可复制） */}
                    {turn.kind === "branch" && turn.preBranchSummary && (
                      <div className="select-text rounded-xl border border-brand/20 bg-brand/[0.05] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-brand/90 select-none">
                            📋 分支点前对话总结
                          </span>
                          <button
                            type="button"
                            className="text-[10px] text-text-tertiary transition-colors hover:text-brand select-none"
                            onClick={() => copyText(turn.preBranchSummary!)}
                          >
                            复制
                          </button>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                          {turn.preBranchSummary}
                        </div>
                      </div>
                    )}
                    {/* messages */}
                    {(() => {
                      // 指向本轮的出边分支（用于分支点分割线）
                      const branchesHere = turns.filter(
                        (b) => b.kind === "branch" && b.parentTurnId === turn.id
                      );
                      return turn.messages.map((msg, mi) => (
                        <Fragment key={msg.id}>
                          {msg.role === "user" ? (
                            <UserMessageBubble message={msg} />
                          ) : (
                            <div
                              className="ai-message-content relative w-full select-text"
                              onMouseUp={handleQuoteMouseUp}
                            >
                              <div className="markdown-content w-full">
                                <ReactMarkdown
                                  components={{
                                    a: LinkWrap,
                                    strong: ({ node, children }) => {
                                      const text = toTerm(children).trim();
                                      const inLink = useContext(InLinkContext);
                                      // 嵌套加粗 / 链接内的加粗 → 普通 <strong>（防 button-in-button）
                                      if (!text || inLink || hasNestedStrong(node)) {
                                        return <strong>{children}</strong>;
                                      }
                                      // Terms already asked about (e.g. via doc reader) are de-emphasized.
                                      const asked = termStates[text] === "asked";
                                      return (
                                        <button
                                          type="button"
                                          className={`term-chip font-semibold cursor-pointer underline decoration-brand/50 decoration-[1.5px] underline-offset-2 hover:decoration-brand transition-colors duration-300 ${
                                            asked ? "text-text-secondary" : "text-brand"
                                          } ${
                                            hlTerm === text ? "bg-brand/15 shadow-brandtw rounded" : ""
                                          }`}
                                          onClick={() => handleTermClick(text, turn.id)}
                                        >
                                          {children}
                                        </button>
                                      );
                                    },
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                          {/* 分支点分割线：这条消息之后分叉（"一条明显的分割线"） */}
                          {branchesHere.map((b) => {
                            const bp = b.branchPointIndex ?? turn.messages.length - 1;
                            return bp === mi ? (
                              <div
                                key={`bp-${b.id}`}
                                className="my-1 flex select-none items-center gap-2 rounded-lg border border-dashed border-brand/40 bg-brand/[0.06] px-3 py-1.5 text-[11px] text-brand"
                              >
                                <GitFork size={12} className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate">
                                  ⛓ 分支点：从这里分出「{b.title}」分支
                                </span>
                              </div>
                            ) : null;
                          })}
                          {/* 调整模式：每条消息右侧的"✂️ 在此分支" */}
                          {editedBranch && turn.id === editedBranch.parentTurnId && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleBranchAt(editedBranch.id, mi)}
                                className="flex items-center gap-1 rounded-full border border-brand/40 bg-card-floating px-2.5 py-1 text-[10px] text-brand transition-colors hover:bg-brand/15"
                              >
                                <Scissors size={11} /> 在此分支
                              </button>
                            </div>
                          )}
                        </Fragment>
                      ));
                    })()}

                    {/* 本轮探索路径：点开的术语卡片按链条展示（被它们"分割"出深挖脉络） */}
                    {turn.explored && turn.explored.length > 0 && (
                      <div className="explore-trail mt-2 flex flex-col gap-2.5 rounded-xl border border-brand/20 bg-brand/[0.05] p-3.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-brand/90 select-none">
                            🧭 本轮探索路径
                          </span>
                          <span className="text-[10px] text-text-quaternary select-none">
                            点击词条可重新打开卡片
                          </span>
                        </div>
                        {explorationChains(turn.explored).map((chain, ci) => (
                          <div key={ci} className="flex flex-wrap items-center gap-x-2 gap-y-2">
                            {chain.map((e, ei) => (
                              <Fragment key={e.term}>
                                {ei > 0 && (
                                  <span className="select-none text-sm text-text-tertiary">→</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => reopenFromTrail(e.term, turn.id)}
                                  title={KIND_BADGE[e.kind]}
                                  className="explore-chip inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand/30 bg-card-floating px-3 py-1.5 text-[13px] text-brand shadow-card transition-all hover:bg-brand/15 hover:scale-[1.03]"
                                >
                                  {ei > 0 && <span className="text-xs">{KIND_ICON[e.kind]}</span>}
                                  {e.term}
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 分支卡续问：分支是"另起炉灶的对话"，可在卡内继续提问——
                        上下文 = 分支点前切片 + 深挖路径 + 卡内消息（调整分支点后自动按新边界）。 */}
                    {turn.kind === "branch" && (
                      <div className="flex items-end gap-2 shrink-0">
                        <textarea
                          rows={1}
                          value={branchDrafts[turn.id] ?? ""}
                          onChange={(e) => {
                            setBranchDrafts((d) => ({ ...d, [turn.id]: e.target.value }));
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              const body = (branchDrafts[turn.id] ?? "").trim();
                              if (!body || busy) return;
                              sendInTurn(turn.id, body);
                              setBranchDrafts((d) => ({ ...d, [turn.id]: "" }));
                            }
                          }}
                          placeholder={`在「${turn.title}」分支对话中继续提问…`}
                          className="block w-full min-h-0 flex-1 bg-inputarea border border-std rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-brand/50 placeholder:text-text-quaternary scrollbar-card-std max-h-[120px] overflow-y-auto"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const body = (branchDrafts[turn.id] ?? "").trim();
                            if (!body || busy) return;
                            sendInTurn(turn.id, body);
                            setBranchDrafts((d) => ({ ...d, [turn.id]: "" }));
                          }}
                          disabled={!((branchDrafts[turn.id] ?? "").trim()) || busy}
                          aria-label="发送"
                          title="发送（Enter）"
                          className="h-9 w-9 shrink-0 rounded-full bg-btn-inputarea text-brand-fg flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {busy ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Send size={15} strokeWidth={2.5} />
                          )}
                        </button>
                      </div>
                    )}
                          </div>
                  );
                  /** 平行组导航条：‹ › 同级切换 + 来源 chip + 计数 + 回到主对话。 */
                  const parallelNav = (source: Turn, card: Turn, cards: Turn[]) => {
                    const idx = cards.findIndex((c) => c.id === card.id);
                    const prev = idx > 0 ? cards[idx - 1] : null;
                    const next = idx >= 0 && idx < cards.length - 1 ? cards[idx + 1] : null;
                    const switchInGroup = (cardId: string) =>
                      goTo({ kind: "parallel", sourceId: source.id, cardId });
                    return (
                      <div className="sticky top-0 z-20 -mx-4 mb-3 flex select-none items-center gap-2 rounded-lg border border-diverge/30 bg-card-floating px-3 py-2 shadow-card">
                        <span className="shrink-0 select-none rounded-full border border-diverge/40 bg-diverge/10 px-2 py-0.5 text-[10px] text-diverge">
                          🪢 平行会话
                        </span>
                        <button
                          type="button"
                          aria-label="上一张同级卡片"
                          title="上一张同级卡片（←）"
                          disabled={!prev}
                          onClick={() => prev && switchInGroup(prev.id)}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-std bg-btn-std transition-colors enabled:hover:border-brand/40 enabled:hover:text-brand disabled:opacity-40"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="下一张同级卡片"
                          title="下一张同级卡片（→）"
                          disabled={!next}
                          onClick={() => next && switchInGroup(next.id)}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-std bg-btn-std transition-colors enabled:hover:border-brand/40 enabled:hover:text-brand disabled:opacity-40"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <span className="shrink-0 text-[11px] tabular-nums text-text-quaternary">
                          {idx + 1}/{cards.length}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-center text-xs text-text-secondary">
                          <button
                            type="button"
                            title="滑回来源对话（同级）"
                            onClick={() => switchInGroup(source.id)}
                            className="inline-flex max-w-full cursor-pointer items-center gap-1 truncate rounded-full border border-diverge/40 bg-diverge/10 px-2.5 py-0.5 text-[11px] text-diverge transition-colors hover:bg-diverge/20"
                          >
                            🪢 从「{source.title}」发散
                          </button>
                        </span>
                        <button
                          type="button"
                          title="回到主对话（纵向流）"
                          onClick={() => {
                            goTo({ kind: "stream" });
                            window.setTimeout(() => {
                              document
                                .getElementById(`chat-turn-${source.id}`)
                                ?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 460);
                          }}
                          className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-std bg-btn-std px-2.5 text-[11px] text-text-secondary transition-colors hover:border-brand/40 hover:text-brand"
                        >
                          回到主对话
                        </button>
                      </div>
                    );
                  };
                  /** 渲染当前视图：主流 = 纵向堆叠（向下生长）；平行 = 导航条 + 单卡。 */
                  const renderView = (
                    v: ViewSpec,
                    idPrefix: "main" | "old" | "new",
                    animClass?: string
                  ) => {
                    if (v.kind === "parallel") {
                      const cards = parallelCards(v.sourceId);
                      const card = cards.find((c) => c.id === v.cardId) ?? null;
                      const source = cards[0] ?? null;
                      if (!card || !source) return null;
                      return (
                        <div className={animClass ?? ""}>
                          {parallelNav(source, card, cards)}
                          {turnCardBody(card, idPrefix, undefined, "ring-1 ring-diverge/40 bg-diverge/[0.02]")}
                        </div>
                      );
                    }
                    return (
                      <div className={animClass ?? ""}>
                        {streamTurns.map((t) => turnCardBody(t, idPrefix))}
                      </div>
                    );
                  };
                  if (slide) {
                    return (
                      <div className="relative" aria-live="polite">
                        <div className="pointer-events-none absolute inset-0">
                          {renderView(
                            slide.from,
                            "old",
                            slide.dir === "left" ? "chat-slide-out-left" : "chat-slide-out-right"
                          )}
                        </div>
                        {renderView(
                          slide.to,
                          "new",
                          slide.dir === "left" ? "chat-slide-in-right" : "chat-slide-in-left"
                        )}
                      </div>
                    );
                  }
                  return renderView(view, "main");
                })()
              )}
              {/* streaming cursor while AI is replying */}
              {busy && (
                <div className="flex items-center gap-2 py-1" aria-hidden>
                  <span className="inline-block w-2 h-4 bg-brand animate-pulse" />
                </div>
              )}
            </div>

            {/* floating "引用" button over the selection (上下文管理) */}
            {quoteSel && (
              <button
                type="button"
                data-quote-btn
                className="fixed z-[70] flex items-center gap-1.5 rounded-full border border-brand/40 bg-modal-floating px-3 py-1.5 text-xs text-brand shadow-card transition-colors hover:bg-item-std-hover"
                style={{ left: quoteSel.x, top: quoteSel.y, transform: "translate(-50%, 0)" }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={confirmQuote}
              >
                <Quote size={13} />
                引用
              </button>
            )}

            {/* ---------- recursive term cards (centered cascade stack) ----------
                Cards sit centered on the canvas; each deeper layer is nudged
                down-right so the previous card's top edge peeks out, like
                cascading desktop windows. */}
            {termStack.length > 0 && (
              <>
                {termStack.map((item, i) => {
                  const { node, key, messages, path, busy: cardBusy } = item;
                  return (
                  <div
                    key={key}
                    className={`card-container absolute left-1/2 top-1/2 w-[85%] sm:w-[70%] h-[min(680px,calc(100%-96px))] rounded-2xl overflow-hidden bg-card-floating border border-std shadow-card ${
                      termClosing === key ? "exiting-cascade" : "entering-cascade"
                    }`}
                    style={
                      {
                        zIndex: 20 + i,
                        "--cx": `${i * 8}px`,
                        "--cy": `${i * 16}px`,
                        transform:
                          "translate(calc(-50% + var(--cx)), calc(-50% + var(--cy)))",
                      } as React.CSSProperties
                    }
                  >
                    <TermCard
                      node={node}
                      messages={messages}
                      busy={cardBusy}
                      path={path}
                      onClose={() => closeOne(key, i)}
                      onTermClick={(term) => handleCardTermClick(key, term)}
                      onCollect={() => handleCollect(item)}
                      onBranch={() => handleBranch(item)}
                      onDiverge={() => handleDiverge(item)}
                      onAsk={(q) => askInCard(key, q, { node, path, messages, busy: cardBusy })}
                    />
                  </div>
                  );
                })}
              </>
            )}

            {/* 轮次导航卡片树已移至 shell 右侧独立区域（对话框与思维宇宙之间） */}
          </>
        )}
      </div>
    </div>
  );
}
