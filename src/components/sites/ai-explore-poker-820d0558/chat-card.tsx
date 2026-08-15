"use client";

/**
 * Explore — ChatCard (knowledge card: turn list + message bubbles + recursive term tree)
 * 术语卡片 = 可对话的卡片：点开卡片后可以在卡片内继续向 AI 提问（BYOK 走真实
 * 流式 API，否则离线知识库），回复里的 **加粗术语** 可点击 → 继续开子卡片深挖。
 */
import {
  Fragment,
  createContext,
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
  Copy,
  FileText,
  GitFork,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Quote,
  Scissors,
  Send,
  Star,
  Waypoints,
  X,
} from "lucide-react";
import { useApp, streamOpenAICompatible } from "./app-context";
import { explorationChains, type ExploreEntry } from "./turn-graph";
import { findTerm, generateReply, GLOSSARY } from "@/lib/sites/ai-explore-poker-820d0558/mock";
import type { Message, TermNode } from "@/types/sites/ai-explore-poker-820d0558";

const uid = () => "m-" + Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Recursive term tree helpers                                         */
/* ------------------------------------------------------------------ */

const KIND_BADGE: Record<TermNode["kind"], string> = {
  child: "↗️ 子卡片",
  related: "➡️ 关联卡片",
  branch: "⬇️ 分支卡片",
};

const KIND_ICON: Record<TermNode["kind"], string> = {
  child: "↗️",
  related: "➡️",
  branch: "⬇️",
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
  const mdComponents = {
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
  };

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
            <div key={m.id} className="flex flex-col items-end gap-2 mt-3">
              <div className="bg-usermsg shadow-usermsg rounded-usermsg px-3 py-2 relative max-w-[90%]">
                <span className="text-text-content whitespace-pre-wrap select-none">{m.content}</span>
              </div>
            </div>
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
              : "离线知识库没有这个词条。接入你自己的 API 后，点开卡片会自动问 AI；现在也可以直接在下面输入框提问。"}
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
            className="h-9 w-9 rounded-full bg-btn-inputarea text-black flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
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
    loadSampleProject,
    byokModels,
    settings,
    pendingQuote,
    setPendingQuote,
    toggleFavorite,
    setTurnUnread,
    focusTurn,
    focusRequest,
    clearFocusRequest,
    cardOpenRequest,
    clearCardOpenRequest,
  } = useApp();

  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  /** 正在调整分支点的分支轮次 id（上游每条消息旁出现"✂️ 在此分支"） */
  const [branchPointEditing, setBranchPointEditing] = useState<string | null>(null);
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** term card closing animation state (exit class applied, then unmount) */
  const [termClosing, setTermClosing] = useState<string | null>(null);
  /** 选中 AI 回复文本 → 引用：浮动"引用"按钮的位置与内容 */
  const [quoteSel, setQuoteSel] = useState<{ text: string; x: number; y: number } | null>(null);

  /** Empty-state "Explore" title size: 128px desktop / 72px mobile (matches original). */
  const [titleSize, setTitleSize] = useState(128);
  useEffect(() => {
    const compute = () => setTitleSize(window.innerWidth < 640 ? 72 : 128);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  useEffect(() => {
    return () => {
      if (hlTimeout.current) clearTimeout(hlTimeout.current);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  // Auto-scroll to the bottom while the reply streams in (content grows) —
  // 但只在用户"贴底"时跟随（上滚阅读则不拉回，并触发未读标记）。
  // 用 sticky 引用而非瞬时判断：内容尚未溢出时 scrollTop 恒为 0，
  // 瞬时判断会在"刚好溢出"那一刻错过跟随。
  const lastMsgLen =
    turns.length > 0
      ? turns[turns.length - 1].messages[turns[turns.length - 1].messages.length - 1]?.content
          .length ?? 0
      : 0;
  const stickToBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastMsgLen, turns.length]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 新回复完成时，若目标轮次不在视野内（用户滚上去了）→ 标记未读。
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !busy) {
      const last = turns[turns.length - 1];
      const el = scrollRef.current;
      const lastEl = last ? document.getElementById(`chat-turn-${last.id}`) : null;
      if (el && lastEl) {
        const r = el.getBoundingClientRect();
        const tr = lastEl.getBoundingClientRect();
        const visible = tr.top < r.bottom - 20 && tr.bottom > r.top + 20;
        if (!visible) setTurnUnread(last.id, true);
      }
    }
    prevBusy.current = busy;
  }, [busy, turns, setTurnUnread]);

  // 收藏区跳转：滚动定位到目标轮次并清除未读。
  useEffect(() => {
    if (!focusRequest) return;
    document
      .getElementById(`chat-turn-${focusRequest.turnId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTurnUnread(focusRequest.turnId, false);
    clearFocusRequest();
  }, [focusRequest, clearFocusRequest, setTurnUnread]);

  // 轮次导航图点击卡片节点 → 重新打开该术语卡片（不重复记录探索路径）。
  useEffect(() => {
    if (!cardOpenRequest) return;
    reopenFromTrail(cardOpenRequest.term, cardOpenRequest.turnId);
    clearCardOpenRequest();
  }, [cardOpenRequest, clearCardOpenRequest]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2400);
  };

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

  /** 在卡片内提问：BYOK 走真实流式 API，否则离线知识库；回复写进该卡片。
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
      {
        role: "user",
        content: `我们正在深挖概念「${item.node.term}」（路径：${item.path}）。请用中文回答，重要术语用 **加粗** 标记，方便继续深挖。`,
      },
      ...item.messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    if (byok && byok.apiKey && byok.baseUrl && byok.modelId) {
      const emptyMsg: Message = { id: uid(), role: "assistant", content: "", createdAt: Date.now() };
      patch(key, (i) => ({ ...i, messages: [...i.messages, emptyMsg] }));
      let acc = "";
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      streamOpenAICompatible(
        byok,
        context,
        (delta) => {
          acc += delta;
          patch(key, (i) => ({
            ...i,
            messages: i.messages.map((m, mi) =>
              mi === i.messages.length - 1 ? { ...m, content: acc } : m
            ),
          }));
        },
        controller.signal,
        () => window.clearTimeout(timer)
      )
        .then(() => {
          window.clearTimeout(timer);
          patch(key, (i) => ({ ...i, busy: false }));
          remember(acc);
          clearInflight();
        })
        .catch(() => {
          window.clearTimeout(timer);
          const fallback = `> ⚠️ BYOK 请求失败，已回退离线知识库。\n\n${generateReply(question, context)}`;
          patch(key, (i) => ({
            ...i,
            busy: false,
            messages: i.messages.map((m, mi) =>
              mi === i.messages.length - 1 ? { ...m, content: fallback } : m
            ),
          }));
          remember(fallback);
          clearInflight();
        });
    } else {
      // 离线：延迟后生成回复并打字机式写入卡片。
      window.setTimeout(() => {
        const reply = generateReply(question, context);
        const emptyMsg: Message = { id: uid(), role: "assistant", content: "", createdAt: Date.now() };
        patch(key, (i) => ({ ...i, messages: [...i.messages, emptyMsg] }));
        let pos = 0;
        const step = 16;
        const t = window.setInterval(() => {
          pos = Math.min(pos + step, reply.length);
          const partial = reply.slice(0, pos);
          patch(key, (i) => ({
            ...i,
            messages: i.messages.map((m, mi) =>
              mi === i.messages.length - 1 ? { ...m, content: partial } : m
            ),
          }));
          if (pos >= reply.length) {
            window.clearInterval(t);
            patch(key, (i) => ({ ...i, busy: false }));
            remember(reply);
            clearInflight();
          }
        }, 20);
      }, 500);
    }
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
    const reusedId = openBranchTurn(item.node.term, history.slice(-16), item.sourceTurnId);
    if (reusedId) {
      if (activeProjectId) focusTurn(activeProjectId, reusedId);
      showToast("已有同主题分支卡片，已跳转");
    } else {
      showToast(`✓ 已创建分支卡片「${item.node.term}」`);
    }
    setTermStack([]);
  };

  /** Divergence card → 以术语开"平行会话"（不打断当前对话）：保留卡片栈。
      已存在同来源同主题的发散卡片时复用并跳转，不新建重复节点。 */
  const handleDiverge = (item: StackItem) => {
    const reusedId = openDivergeTurn(item.node.term, item.sourceTurnId);
    if (reusedId) {
      if (activeProjectId) focusTurn(activeProjectId, reusedId);
      showToast(`已有同主题发散卡片「${item.node.term}」，已跳转`);
    } else {
      showToast(`✓ 已创建发散卡片「${item.node.term}」`);
    }
  };

  /** 调整分支点：把分支轮次的分叉位置改到上游第 index 条消息之后。 */
  const handleBranchAt = (branchTurnId: string, index: number) => {
    setBranchPoint(branchTurnId, index);
    setBranchPointEditing(null);
    showToast("✓ 分支点已调整");
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

  /* --- turn navigation --- */

  return (
    <div
      className="text-primary relative h-full w-full transition-[height] duration-300 ease-in-out"
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
                    className="font-bruno-ace select-none text-brand"
                    style={{
                      fontSize: `${titleSize}px`,
                      lineHeight: 1,
                      textShadow: "0 0 24px rgba(19, 228, 37, 0.35)",
                    }}
                  >
                    Explore
                  </h1>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => openModal("guide")}
                      className="cursor-pointer rounded-full bg-btn-std px-6 py-2 font-medium text-primary transition-colors hover:bg-btn-std-hover"
                    >
                      使用指南
                    </button>
                    <button
                      type="button"
                      onClick={loadSampleProject}
                      aria-label="加载示例项目"
                      title="加载示例项目"
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-btn-std text-text-icon-secondary transition-colors hover:bg-btn-std-hover hover:text-primary"
                    >
                      <HelpCircle size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.id}
                    id={`chat-turn-${turn.id}`}
                    className="flex flex-col gap-4 px-2 pb-2 rounded-xl relative border border-std/80 mb-4 scroll-mt-[52px]"
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
                          <span className="shrink-0 rounded-full border border-[#ba8eff]/40 px-2 py-0.5 text-[10px] text-[#ba8eff] select-none">
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
                          onClick={() => setBranchPointEditing(null)}
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
                            onClick={() =>
                              setBranchPointEditing((cur) => (cur === turn.id ? null : turn.id))
                            }
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
                            <div className="flex flex-col items-end gap-2">
                              <div className="bg-usermsg shadow-usermsg rounded-usermsg px-3 py-2 relative max-w-[90%]">
                                <span className="text-text-content whitespace-pre-wrap select-none">
                                  {msg.content}
                                </span>
                              </div>
                            </div>
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
                  </div>
                ))
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

            {/* toast：独立于卡片栈渲染——分支流程会关栈，toast 不能因此被卸载 */}
            {toast && (
              <div className="absolute left-1/2 bottom-6 -translate-x-1/2 z-[60] bg-modal-floating border border-std shadow-card rounded-full px-4 py-2 text-xs text-brand whitespace-nowrap pointer-events-none">
                {toast}
              </div>
            )}

            {/* 轮次导航卡片树已移至 shell 右侧独立区域（对话框与思维宇宙之间） */}
          </>
        )}
      </div>
    </div>
  );
}
