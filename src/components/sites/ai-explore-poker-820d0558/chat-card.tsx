"use client";

/**
 * Explore — ChatCard (knowledge card: turn list + message bubbles + recursive term tree)
 * Reads shared state via useApp() (turns / activeTurn / busy / projects / activeProjectId /
 * termStates / addThoughtNode / markTermState / openBranchTurn).
 * React-markdown renders assistant replies; **bold** terms become clickable chips
 * that expand a floating recursive term card (children expand in-place as a stacked
 * layer with a back button; branch cards start a new turn).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  BookmarkPlus,
  ChevronLeft,
  Copy,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useApp } from "./app-context";
import { findTerm, genericTermSummary } from "@/lib/sites/ai-explore-poker-820d0558/mock";
import type { TermNode } from "@/types/sites/ai-explore-poker-820d0558";

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

/** Resolve a term to a tree node; unknown terms fall back to a generic card. */
function resolveTerm(term: string): TermNode {
  return (
    findTerm(term) ?? {
      id: "fallback-" + term,
      term,
      kind: "related",
      summary: genericTermSummary(term),
    }
  );
}

/** Normalize ReactMarkdown strong-children into a plain string. */
function toTerm(children: ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toTerm).join("");
  return String(children);
}

/* ------------------------------------------------------------------ */
/* TermCard — one layer of the recursive term tree                     */
/* ------------------------------------------------------------------ */

interface TermCardProps {
  node: TermNode;
  depth: number;
  onBack(): void;
  onClose(): void;
  onOpenChild(child: TermNode): void;
  onCollect(): void;
  onBranch(): void;
}

function TermCard({ node, depth, onBack, onClose, onOpenChild, onCollect, onBranch }: TermCardProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl">
      {/* header: kind badge + term name + collect + close */}
      <div className="flex items-center gap-2 px-3 sm:px-4 h-12 border-b border-divider shrink-0">
        {depth > 0 && (
          <button
            type="button"
            className="w-8 h-8 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shrink-0 transition-colors"
            title="返回上一层"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
          </button>
        )}
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

      {/* content + recursive children rows */}
      <div className="mind-md flex-1 min-h-0 overflow-y-auto scrollbar-card-std px-4 py-3">
        <div className="markdown-content">
          <ReactMarkdown>{node.summary}</ReactMarkdown>
        </div>

        {node.children && node.children.length > 0 ? (
          <div className="mt-3 flex flex-col gap-0.5 border-t border-divider pt-2">
            {node.children.map((child) => (
              <button
                key={child.id}
                type="button"
                className="term-chip flex items-baseline gap-1.5 text-left text-sm text-brand hover:underline px-1 py-1 rounded hover:bg-item-std-hover transition-colors duration-300"
                onClick={() => onOpenChild(child)}
              >
                <span className="text-[11px] shrink-0">{KIND_ICON[child.kind]}</span>
                <span className="truncate min-w-0">{child.term}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 border-t border-divider pt-3 text-xs text-text-tertiary">
            这个概念的展开已经到底了，试试把它收录进思维宇宙
          </div>
        )}

        {node.kind === "branch" && (
          <button
            type="button"
            className="mt-4 w-full h-10 rounded-xl bg-btn-std hover:bg-btn-std-hover text-[13px] text-brand transition-colors"
            onClick={onBranch}
          >
            ⬇️ 另起炉灶 · 开新对话
          </button>
        )}
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
}

export function ChatCard() {
  const {
    turns,
    activeTurn,
    busy,
    projects,
    activeProjectId,
    deleteProject,
    termStates,
    addThoughtNode,
    markTermState,
    openBranchTurn,
  } = useApp();

  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [hlTerm, setHlTerm] = useState<string | null>(null);
  const hlTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** recursive term-card stack: index 0 = clicked term, deeper layers = child cards */
  const [termStack, setTermStack] = useState<StackItem[]>([]);
  const stackSeq = useRef(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2400);
  };

  const title = activeTurn?.title || activeProject?.title || "新对话";

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
    if (!turns.length) return;
    const text = turns
      .flatMap((t) => t.messages)
      .map((m) => `${m.role === "user" ? "我" : "AI"}：\n${m.content}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (activeProjectId) deleteProject(activeProjectId);
  };

  /* --- term expansion (recursive tree) --- */
  const handleTermClick = (term: string) => {
    const node = resolveTerm(term);
    stackSeq.current += 1;
    setTermStack([{ node, key: `${node.id}-${stackSeq.current}` }]);
    setHlTerm(term);
    if (hlTimeout.current) clearTimeout(hlTimeout.current);
    hlTimeout.current = setTimeout(() => setHlTerm(null), 1500);
  };

  /** Push a child card onto the stack (same position, layered, can go back). */
  const handleOpenChild = (child: TermNode) => {
    stackSeq.current += 1;
    setTermStack((s) => [...s, { node: child, key: `${child.id}-${stackSeq.current}` }]);
  };

  /** Bookmark term into the mind universe + mark as mastered. */
  const handleCollect = (node: TermNode) => {
    addThoughtNode(node.term, node.summary);
    markTermState(node.term, "mastered");
    showToast(`✓ 已收录「${node.term}」，待验证`);
  };

  /** Branch card → start a brand-new turn with this term as context. */
  const handleBranch = (node: TermNode) => {
    openBranchTurn(node.term, node.summary);
    setTermStack([]);
  };

  /* --- turn navigation --- */
  const jumpToTurn = (id: string) => {
    document
      .getElementById(`chat-turn-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="text-primary relative h-full w-full"
      style={{
        maxWidth: "min(990px, 100%)",
        height: minimized ? 48 : "100%",
        margin: "0 auto",
      }}
    >
      <div className="relative w-full h-full min-h-0 overflow-hidden rounded-[24px]">
        {/* ---------- header ---------- */}
        <div className="absolute top-0 inset-x-0 h-9 px-4 flex items-center justify-between border-b border-divider z-[5]">
          <span className="font-bold truncate pr-2 text-[15px]">{title}</span>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 bg-btn-std hover:bg-btn-std-hover rounded-full flex items-center justify-center shadow-card transition-colors"
              title={minimized ? "展开演示" : "收起演示"}
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
                    onClick={() => setMenuOpen(false)}
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg text-left text-[13px] text-text-secondary hover:bg-item-std-hover transition-colors"
                    onClick={handleDelete}
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {!minimized && (
          <>
            {/* ---------- scrollable turn list ---------- */}
            <div className="absolute inset-0 overflow-y-auto scrollbar-card-std pt-[52px] px-4 pb-6">
              {turns.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center -translate-y-[28px]">
                  <h1
                    className="font-bruno-ace select-none text-brand"
                    style={{
                      fontSize: "128px",
                      lineHeight: 1,
                      textShadow: "0 0 24px rgba(19, 228, 37, 0.35)",
                    }}
                  >
                    Explore
                  </h1>
                  <p className="mt-10 text-sm text-text-tertiary">
                    输入问题，开始你的探索
                  </p>
                </div>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.id}
                    id={`chat-turn-${turn.id}`}
                    className="flex flex-col gap-4 px-2 pb-2 rounded-lg relative border-2 border-turn-std mb-4 scroll-mt-[52px]"
                  >
                    {/* turn header */}
                    <div className="flex items-center h-14 text-lg font-semibold truncate text-text-turn-title">
                      <span className="w-full min-w-0 truncate">{turn.title}</span>
                    </div>
                    <div className="flex justify-end pr-1 select-none">
                      <span className="text-[11px] text-text-quaternary">
                        {fmtTs(turn.createdAt)}
                      </span>
                    </div>
                    {/* messages */}
                    {turn.messages.map((msg) =>
                      msg.role === "user" ? (
                        <div key={msg.id} className="flex flex-col items-end gap-2">
                          <div className="bg-usermsg shadow-usermsg rounded-usermsg px-3 py-2 relative max-w-[90%]">
                            <span className="text-text-content whitespace-pre-wrap select-none">
                              {msg.content}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div key={msg.id} className="ai-message-content relative select-none w-full">
                          <div className="markdown-content w-full">
                            <ReactMarkdown
                              components={{
                                strong: ({ children }) => {
                                  const text = toTerm(children).trim();
                                  if (!text) return <strong>{children}</strong>;
                                  // Terms already asked about (e.g. via doc reader) are de-emphasized.
                                  const asked = termStates[text] === "asked";
                                  return (
                                    <button
                                      type="button"
                                      className={`term-chip font-semibold cursor-pointer hover:underline transition-colors duration-300 ${
                                        asked ? "text-text-secondary" : "text-brand"
                                      } ${
                                        hlTerm === text ? "bg-brand/15 shadow-brandtw rounded" : ""
                                      }`}
                                      onClick={() => handleTermClick(text)}
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
                      )
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

            {/* ---------- recursive term cards (layered stack) ---------- */}
            {termStack.length > 0 && (
              <div className="card-container entering-from-bottom absolute right-2 top-[52px] bottom-2 w-[85%] sm:w-[70%] z-10 bg-card-floating rounded-2xl border border-std shadow-card overflow-hidden">
                {termStack.map(({ node, key }, i) => (
                  <div
                    key={key}
                    className={`absolute inset-0 rounded-2xl overflow-hidden ${i > 0 ? "new-word-fade-in" : ""}`}
                    style={{ zIndex: i + 1 }}
                  >
                    <TermCard
                      node={node}
                      depth={i}
                      onBack={() => setTermStack((s) => s.slice(0, -1))}
                      onClose={() => setTermStack([])}
                      onOpenChild={handleOpenChild}
                      onCollect={() => handleCollect(node)}
                      onBranch={() => handleBranch(node)}
                    />
                  </div>
                ))}
                {toast && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-[60] bg-modal-floating border border-std shadow-card rounded-full px-4 py-2 text-xs text-brand whitespace-nowrap pointer-events-none">
                    {toast}
                  </div>
                )}
              </div>
            )}

            {/* ---------- right turn-navigation rail ---------- */}
            {turns.length > 0 && (
              <div className="hidden sm:flex absolute right-0 top-[52px] bottom-0 w-[20px] z-[15] flex-col items-end">
                <button
                  type="button"
                  className="w-5 h-6 rounded-l-lg bg-btn-std/40 hover:bg-btn-std flex items-center justify-center transition-colors"
                  title="轮次导航"
                  onClick={() => setNavOpen((v) => !v)}
                >
                  <ChevronLeft
                    size={14}
                    className={`text-text-tertiary transition-transform duration-300 ${
                      navOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {navOpen && (
                  <div className="absolute right-0 top-0 bottom-0 w-[240px] bg-card-floating border-l border-divider z-[10] flex flex-col">
                    <div className="px-4 py-3 text-[12px] text-text-tertiary border-b border-divider">
                      轮次导航
                    </div>
                    <div className="flex-1 overflow-y-auto nav-scroll p-2 flex flex-col gap-1">
                      {turns.map((turn) => (
                        <button
                          key={turn.id}
                          type="button"
                          className="text-left px-3 py-2 rounded-lg text-[13px] text-text-secondary hover:bg-item-std-hover bg-item-std transition-colors"
                          onClick={() => jumpToTurn(turn.id)}
                        >
                          <span className="block truncate">{turn.title}</span>
                          <span className="block text-[11px] text-text-quaternary mt-0.5">
                            {fmtTs(turn.createdAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
