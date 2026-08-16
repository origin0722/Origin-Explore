"use client";

/**
 * Explore — Mindscape panel 思维宇宙 (site: ai.explore.poker/chat clone)
 * Node list (pending first) + AI validation + add-understanding form + the
 * entry button to the fullscreen 3D MindUniverse.
 *  - Desktop (>=640px): embedded right-side panel, rendered by shell
 *    (expected wrapper: absolute right-0 top-0 h-full w-[225px] border-l border-divider).
 *  - Mobile (<640px): full-screen fixed drawer with close button (onClose).
 * Empty state shows MINDSCAPE_EMPTY copy. Node data comes from useApp()
 * (a non-empty `thoughts` prop overrides it).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, Loader2, Sparkles, Trash2, X } from "lucide-react";
import type { ThoughtNode } from "@/types/sites/ai-explore-poker-820d0558";
import { MINDSCAPE_EMPTY } from "@/lib/sites/ai-explore-poker-820d0558/mock";
import { useApp } from "./app-context";

export interface MindscapePanelProps {
  thoughts?: ThoughtNode[];
  onClose?: () => void;
}

const MOBILE_QUERY = "(max-width: 640px)";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

/** Empty state: icon + MINDSCAPE_EMPTY copy. */
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-3">
      <BrainCircuit size={28} className="text-brand opacity-70" />
      {MINDSCAPE_EMPTY.paragraphs.map((p) => (
        <p key={p} className="text-xs text-text-tertiary leading-5">
          {p}
        </p>
      ))}
    </div>
  );
}

export function MindscapePanel({ thoughts, onClose }: MindscapePanelProps) {
  const {
    thoughtNodes,
    addThoughtNode,
    validateThoughtNode,
    removeThoughtNode,
    setUniverseOpen,
  } = useApp();

  const [isMobile, setIsMobile] = useState(false);
  const [input, setInput] = useState("");
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validatingAdd, setValidatingAdd] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Clear any pending mock-AI timeouts when unmounting.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  const showToast = useCallback((kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // Non-empty prop overrides context; empty/absent falls back to useApp().
  const list = thoughts && thoughts.length > 0 ? thoughts : thoughtNodes;
  // Pending nodes first, then by creation time (newest on top).
  const sorted = [...list].sort((a, b) => {
    const pa = a.status === "pending" ? 0 : 1;
    const pb = b.status === "pending" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.createdAt - a.createdAt;
  });

  /** Mock AI validation: 1.2s "验证中" then flip the node to validated. */
  const handleValidate = (id: string) => {
    setValidatingId(id);
    timerRef.current = setTimeout(() => {
      validateThoughtNode(id);
      setValidatingId(null);
      showToast("success", "✓ 验证通过");
    }, 1200);
  };

  /** Add-understanding submit: 1.2s validating, <8 chars fails (not added). */
  const handleSubmit = () => {
    const text = input.trim();
    if (!text || validatingAdd) return;
    setValidatingAdd(true);
    timerRef.current = setTimeout(() => {
      setValidatingAdd(false);
      if (text.length < 8) {
        showToast("error", "内容太短，AI 无法验证");
        return;
      }
      const first = text.split(/\s+/)[0] || text;
      const subject = first.length > 12 ? first.slice(0, 12) : first;
      addThoughtNode(subject, text);
      setInput("");
      showToast("success", "✓ 已收录，AI 验证通过");
    }, 1200);
  };

  const nodeArea =
    sorted.length === 0 ? (
      <EmptyState />
    ) : (
      <div className="flex-1 overflow-y-auto scrollbar-card-std px-3 py-2 space-y-2">
        {sorted.map((n) => (
          <article key={n.id} className="bg-card-std rounded-xl border border-std p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{n.subject}</span>
              {n.status === "validated" ? (
                <span className="shrink-0 text-[10px] rounded-full px-1.5 py-0.5 bg-brand/15 text-brand">
                  已验证
                </span>
              ) : (
                <span className="shrink-0 text-[10px] rounded-full px-1.5 py-0.5 bg-btn-std text-text-tertiary">
                  待验证
                </span>
              )}
            </div>
            <p className="text-xs text-text-tertiary mt-1 line-clamp-2 leading-5">
              {n.content}
            </p>
            {n.parentSubject && (
              <p className="mt-1 truncate text-[10px] text-text-quaternary">
                <span className="text-brand/70">🔗 深挖自</span>「{n.parentSubject}」
              </p>
            )}
            <div className="flex items-center justify-between mt-2">
              <time className="text-[10px] text-text-quaternary">
                {formatTime(n.createdAt)}
              </time>
              <div className="flex items-center gap-1.5">
                {n.status !== "validated" &&
                  (validatingId === n.id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                      <Loader2 size={12} className="animate-spin" />
                      AI 验证中…
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleValidate(n.id)}
                      className="text-[10px] text-brand hover:underline"
                    >
                      验证
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => removeThoughtNode(n.id)}
                  aria-label="删除节点"
                  className="text-text-quaternary hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    );

  const body = (
    <>
      <header className="px-4 py-3 shrink-0 flex items-center justify-between gap-2 border-b border-divider">
        <h3 className="text-sm font-semibold text-text-header-secondary">思维宇宙</h3>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setUniverseOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-brand border border-brand/40 rounded-full px-2.5 py-1 hover:bg-brand/10 transition-colors"
          >
            <Sparkles size={14} />
            进入 3D 宇宙
          </button>
          {isMobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭思维宇宙"
              className="p-1 -mr-1 rounded-md text-text-icon-secondary transition-colors hover:bg-item-std-hover"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>
      {nodeArea}
      <div className="shrink-0 border-t border-divider p-3">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="描述你对某个概念的理解…"
          className="w-full bg-inputarea border border-std rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-brand/50 placeholder:text-text-quaternary scrollbar-inputarea"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || validatingAdd}
            className="inline-flex items-center gap-1.5 bg-brand text-brand-fg text-sm font-medium rounded-full px-4 py-1.5 disabled:opacity-40 transition-opacity"
          >
            {validatingAdd && <Loader2 size={14} className="animate-spin" />}
            验证并添加
          </button>
        </div>
      </div>
      {toast && (
        <div
          className={`pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs shadow-card backdrop-blur animate-[fadeIn_200ms_ease-out] ${
            toast.kind === "success"
              ? "border-brand/40 bg-universe-panel/95 text-brand"
              : "border-destructive/40 bg-universe-panel/95 text-destructive"
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="思维宇宙"
        className="fixed inset-0 z-40 bg-bg/95 backdrop-blur-sm flex flex-col"
      >
        {body}
      </div>
    );
  }

  return <div className="relative h-full w-full flex flex-col">{body}</div>;
}
