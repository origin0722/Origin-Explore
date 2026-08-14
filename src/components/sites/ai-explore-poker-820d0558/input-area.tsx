"use client";

/**
 * Explore — InputArea (site: ai.explore.poker/chat clone)
 * Bottom-centered chat input: model selector, attach hint, auto-grow textarea, send.
 * State flows through AppContext (useApp); no local backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  Globe,
  Loader2,
  Paperclip,
  Send,
  Zap,
} from "lucide-react";
import { OFFLINE_MODEL } from "@/lib/sites/ai-explore-poker-820d0558/mock";
import { useApp } from "./app-context";

export function InputArea() {
  const { settings, setSettings, sendMessage, busy, setActiveDocId, byokModels } = useApp();
  const [text, setText] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<number | undefined>(undefined);

  const allModels = useMemo(() => [OFFLINE_MODEL, ...byokModels], [byokModels]);
  const activeModel = allModels.find((m) => m.id === settings.activeModelId);
  const modelName = activeModel?.name ?? settings.activeModelId;

  // Click outside the input area closes the model list.
  useEffect(() => {
    if (!modelOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [modelOpen]);

  const showHint = useCallback(() => {
    setHint(Date.now());
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 1800);
  }, []);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content || busy) return;
    sendMessage(content);
    setText("");
    setModelOpen(false);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    });
  }, [text, busy, sendMessage]);

  // Ctrl+Enter (default) or plain Enter when settings.sendShortcut === "enter".
  // Shift+Enter always inserts a newline.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const shouldSend = settings.sendShortcut === "enter" || e.ctrlKey || e.metaKey;
    if (shouldSend) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
    setText(el.value);
  };

  return (
    <div className="w-full flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-4 sm:pb-0">
      <div
        ref={rootRef}
        className={`relative bg-inputarea shadow-card border-2 border-std rounded-[28px] p-3 gap-3 flex flex-col w-full max-w-[900px] transition-colors focus-within:border-brand/50 ${
          busy ? "border-brand/60 inputarea-breathe" : ""
        }`}
      >
        {/* transient hint (document library) */}
        {hint !== null && (
          <div
            key={hint}
            className="inputarea-hint absolute -top-9 left-1/2 z-30 pointer-events-none select-none whitespace-nowrap rounded-full border border-std bg-modal-floating px-3 py-1 text-xs text-text-secondary shadow-card"
          >
            已打开本地文档库
          </div>
        )}

        {/* row 1: model selector + tools + textarea */}
        <div className="flex items-end gap-2">
          {/* model selector */}
          <div className="relative min-w-0 max-w-[160px] sm:max-w-[220px] flex-shrink-0">
            <button
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              className="flex items-center justify-between gap-1 text-sm bg-btn-selector shadow-selector rounded-[16px] px-2.5 py-1.5 min-w-0 w-full"
            >
              <span className="flex items-center gap-1.5 min-w-0 select-none">
                <Zap size={13} className="text-brand flex-shrink-0" />
                <span className="truncate">{modelName}</span>
              </span>
              <ChevronDown
                size={14}
                className={`text-text-tertiary flex-shrink-0 transition-transform ${
                  modelOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {modelOpen && (
              <div
                role="listbox"
                className="inputarea-pop absolute bottom-full left-0 mb-2 z-30 w-[280px] max-w-[80vw] bg-modal-std rounded-xl border border-std shadow-card p-2 max-h-64 overflow-y-auto scrollbar-inputarea"
              >
                {allModels.map((m) => {
                  const selected = m.id === settings.activeModelId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setModelOpen(false);
                        setSettings({ activeModelId: m.id });
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
                        selected
                          ? "bg-item-std-active text-primary"
                          : "hover:bg-item-std-hover text-text-secondary"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      {m.provider === "BYOK" && (
                        <span className="flex-shrink-0 rounded border border-std px-1.5 text-[10px] leading-4 text-text-tertiary">
                          BYOK
                        </span>
                      )}
                      {selected && <Check size={14} className="text-brand flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* web-search toggle */}
          <button
            type="button"
            onClick={() =>
              setSettings({ isWebSearchEnabled: !settings.isWebSearchEnabled })
            }
            aria-label={settings.isWebSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
            title={settings.isWebSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
            className={`h-8 w-8 sm:h-[34px] sm:w-[34px] flex-shrink-0 rounded-full bg-btn-inputarea-transparent-hover flex items-center justify-center transition-colors ${
              settings.isWebSearchEnabled ? "text-brand" : "text-text-icon-secondary"
            }`}
          >
            <Globe size={18} />
          </button>

          {/* auto-growing textarea (max 8 lines) */}
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="问点什么，开始你的探索…"
            className="block w-full min-h-0 flex-1 bg-transparent scrollbar-inputarea text-primary text-base leading-5 resize-none outline-none placeholder:text-text-quaternary max-h-[192px] overflow-y-auto px-0 py-1"
          />

          {/* attach — opens the local document library */}
          <button
            type="button"
            onClick={() => {
              setActiveDocId("__library__");
              showHint();
            }}
            aria-label="本地文档"
            title="本地文档"
            className="h-8 w-8 sm:h-[34px] sm:w-[34px] flex-shrink-0 rounded-full bg-btn-inputarea-transparent-hover flex items-center justify-center text-text-icon-secondary transition-colors"
          >
            <Paperclip size={16} />
          </button>

          {/* send */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || busy}
            aria-label="发送"
            className="h-8 w-8 sm:h-[34px] sm:w-[34px] rounded-full bg-btn-inputarea text-black flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* self-contained keyframes (no globals.css edits) */}
      <style>{`
        @keyframes inputarea-breathe {
          0%, 100% { border-color: rgba(19, 228, 37, 0.3); }
          50% { border-color: rgba(19, 228, 37, 0.8); }
        }
        .inputarea-breathe { animation: inputarea-breathe 2.2s ease-in-out infinite; }
        @keyframes inputarea-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .inputarea-pop { animation: inputarea-pop 150ms ease-out; transform-origin: bottom left; }
        @keyframes inputarea-hint-fade {
          0% { opacity: 0; transform: translate(-50%, 6px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          75% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -6px); }
        }
        .inputarea-hint { animation: inputarea-hint-fade 1.8s ease-out forwards; }
      `}</style>
    </div>
  );
}
