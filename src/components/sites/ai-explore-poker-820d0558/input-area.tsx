"use client";

/**
 * Explore — InputArea (site: ai.explore.poker/chat clone)
 * Bottom-centered chat input: model selector, attach hint, auto-grow textarea, send.
 * State flows through AppContext (useApp); no local backend.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  Globe,
  ImagePlus,
  Paperclip,
  Send,
  Square,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "./app-context";
import {
  fileToAttachedImage,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
} from "@/lib/sites/ai-explore-poker-820d0558/vision";
import type { AttachedImage } from "@/types/sites/ai-explore-poker-820d0558";

export function InputArea() {
  const {
    settings,
    setSettings,
    sendMessage,
    sendInTurn,
    sendDocQuestion,
    parallelSendTarget,
    treeFocus,
    turns,
    activeDocId,
    documents,
    busy,
    mainBusy,
    isTurnBusy,
    stopStreaming,
    stopTurn,
    setActiveDocId,
    byokModels,
    pendingQuote,
    setPendingQuote,
    setAppNotice,
    openModal,
  } = useApp();
  const [text, setText] = useState("");
  const [quotes, setQuotes] = useState<string[]>([]);
  /** 待发送图片（视觉模式；上限 4 张，落盘前由 app-context 剥离 fullDataUrl） */
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<number | undefined>(undefined);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const allModels = byokModels;
  const activeModel = allModels.find((m) => m.id === settings.activeModelId);
  const modelName = activeModel?.name ?? "未配置模型";
  /** 无可用 API 模型：输入区整体禁用，引导去设置配置。 */
  const noModel = allModels.length === 0 || !activeModel;

  /** 平行视图发送目标：聚焦发散卡时，消息顺延进该平行对话（不弹回主对话流）。 */
  const parallelTurn = parallelSendTarget
    ? (turns.find((t) => t.id === parallelSendTarget) ?? null)
    : null;
  /** 文档段落视图：当前打开的文档（消息发往"论文：xxx"项目，AI 基于全文解读）。 */
  const activeDoc =
    activeDocId != null && activeDocId !== "__library__"
      ? (documents.find((d) => d.id === activeDocId) ?? null)
      : null;
  /** 平行视图聚焦"来源卡"（不是发散卡）时，输入框发往主对话流会滑回主流——
      给用户明确提示，避免"视图被意外弹出"。 */
  const onSourceCardInParallel =
    treeFocus?.groupSourceId != null && treeFocus.cardId === treeFocus.groupSourceId;

  /** 线程级 busy：按当前发送目标计算（文档视图→全局 busy；平行→该卡；否则→主流） */
  const targetBusy = activeDoc ? busy : parallelTurn ? isTurnBusy(parallelTurn.id) : mainBusy;
  /** 停止当前目标：平行→停该卡；否则→停主流（文档视图全停） */
  const stopTarget = () => {
    if (parallelTurn) stopTurn(parallelTurn.id);
    else stopStreaming();
  };

  // 收到"引用"（来自聊天区选中文本）→ 收进引用列表（支持多条）。
  useEffect(() => {
    if (!pendingQuote) return;
    setQuotes((qs) => [...qs, pendingQuote]);
    setPendingQuote(null);
  }, [pendingQuote, setPendingQuote]);

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

  /** 图片预处理：校验数量/大小 → 降采样 → 加入待发送列表 */
  const addImageFiles = useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) return;
      const room = MAX_IMAGES_PER_MESSAGE - images.length;
      if (room <= 0) {
        setAppNotice(`最多发送 ${MAX_IMAGES_PER_MESSAGE} 张图片`);
        return;
      }
      const picked = imgs.slice(0, room);
      if (imgs.length > room) setAppNotice(`最多发送 ${MAX_IMAGES_PER_MESSAGE} 张，已保留前 ${room} 张`);
      const oversized = picked.find((f) => f.size > MAX_IMAGE_BYTES);
      if (oversized) {
        setAppNotice(`图片「${oversized.name}」超过 10MB，已跳过`);
      }
      const ok = picked.filter((f) => f.size <= MAX_IMAGE_BYTES);
      for (const f of ok) {
        try {
          const img = await fileToAttachedImage(f);
          setImages((list) => [...list, img]);
        } catch {
          setAppNotice(`图片「${f.name}」处理失败`);
        }
      }
    },
    [images.length, setAppNotice]
  );

  const handleImageInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    addImageFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) {
      e.preventDefault();
      addImageFiles(files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.some((f) => f.type.startsWith("image/"))) {
      addImageFiles(files);
    }
  };

  const handleSend = useCallback(() => {
    const body = text.trim();
    if ((!body && quotes.length === 0 && images.length === 0) || targetBusy) return;
    if (noModel) {
      setAppNotice("请先在设置 → AI 模型中配置 API 模型");
      return;
    }
    const content =
      (quotes.length ? quotes.map((q) => `> ${q}`).join("\n") + "\n\n" : "") + body;
    // 三态路由（文档视图 > 平行顺延 > 主流新建）：
    // 文档视图是独立全屏模式，优先级最高——即使 parallelSendTarget 残留
    // （切视图时未清理的旧发散卡 id），文档提问也绝不发进无关平行会话。
    if (activeDoc) {
      if (images.length) {
        setAppNotice("文档解读暂不支持图片");
        return;
      }
      sendDocQuestion(content);
    } else if (parallelTurn) {
      // 平行视图聚焦发散卡：消息顺延进该平行对话（独立线程，不打断主对话）。
      sendInTurn(parallelTurn.id, content, images);
    } else {
      sendMessage(content, images);
    }
    setText("");
    setQuotes([]);
    setImages([]);
    setModelOpen(false);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    });
  }, [text, quotes, images, targetBusy, noModel, activeDoc, parallelTurn, sendInTurn, sendDocQuestion, sendMessage, setAppNotice]);

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
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative bg-inputarea shadow-card border-2 border-std rounded-[28px] p-3 gap-3 flex flex-col w-full max-w-[900px] transition-colors focus-within:border-brand/50 ${
          targetBusy ? "border-brand/60 inputarea-breathe" : ""
        } ${dragOver ? "border-brand/80 ring-2 ring-brand/30" : ""}`}
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

        {/* 引用列表（选中 AI 回复文本添加；可删除、多条） */}
        {quotes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {quotes.map((q, i) => (
              <span
                key={`${i}-${q.slice(0, 8)}`}
                className="quote-chip inline-flex max-w-full items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/10 px-2 py-1 text-xs text-text-secondary"
              >
                <span className="max-w-[260px] truncate">❝ {q}</span>
                <button
                  type="button"
                  onClick={() => setQuotes((qs) => qs.filter((_, j) => j !== i))}
                  aria-label="移除引用"
                  title="移除引用"
                  className="shrink-0 rounded-full p-0.5 text-text-quaternary transition-colors hover:bg-item-std-hover hover:text-primary"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 待发送图片缩略图条 */}
        {images.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {images.map((img) => (
              <span
                key={img.id}
                className="group relative inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-brand/30 bg-item-std"
                title={img.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.thumbDataUrl}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImages((list) => list.filter((i) => i.id !== img.id))}
                  aria-label="移除图片"
                  title="移除图片"
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* row 1: model selector + tools + textarea */}
        <div className="flex items-end gap-2">
          {/* model selector */}
          <div className="relative min-w-0 max-w-[160px] sm:max-w-[220px] flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (noModel) {
                  openModal("settings");
                  return;
                }
                setModelOpen((v) => !v);
              }}
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              className={`flex items-center justify-between gap-1 text-sm bg-btn-selector shadow-selector rounded-[16px] px-2.5 py-1.5 min-w-0 w-full ${
                noModel ? "border border-brand/40 text-brand" : ""
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0 select-none">
                <Zap size={13} className="text-brand flex-shrink-0" />
                <span className="truncate">{noModel ? "配置 API 模型" : modelName}</span>
              </span>
              <ChevronDown
                size={14}
                className={`text-text-tertiary flex-shrink-0 transition-transform ${
                  modelOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {modelOpen && !noModel && (
              <div
                role="listbox"
                className="inputarea-pop absolute bottom-full left-0 mb-2 z-30 w-[280px] max-w-[80vw] bg-modal-std rounded-xl border border-std shadow-card p-2 max-h-64 overflow-y-auto scrollbar-inputarea"
              >
                {allModels.length === 0 && (
                  <div className="px-2.5 py-2 text-sm text-text-tertiary">
                    暂无模型，请到设置中添加
                  </div>
                )}
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

          {/* 图片附件（视觉模式） */}
          <button
            type="button"
            onClick={() => imgInputRef.current?.click()}
            aria-label="添加图片"
            title="添加图片（支持粘贴 / 拖拽，最多 4 张）"
            className={`h-8 w-8 sm:h-[34px] sm:w-[34px] flex-shrink-0 rounded-full bg-btn-inputarea-transparent-hover flex items-center justify-center transition-colors ${
              images.length ? "text-brand" : "text-text-icon-secondary"
            }`}
          >
            <ImagePlus size={18} />
          </button>

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
            disabled={noModel}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              noModel
                ? "请先在设置中配置 API 模型…"
                : activeDoc
                  ? `基于《${activeDoc.name}》提问，AI 解读后自动进入对话…`
                  : parallelTurn
                    ? `在「${parallelTurn.title}」平行对话中继续提问…`
                    : onSourceCardInParallel
                      ? "在来源对话输入将回到主对话流新建卡片…"
                      : "问点什么，开始你的探索…"
            }
            className="block w-full min-h-0 flex-1 bg-transparent scrollbar-inputarea text-primary text-base leading-5 resize-none outline-none placeholder:text-text-quaternary max-h-[192px] overflow-y-auto px-0 py-1 disabled:opacity-50"
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

          {/* send / 停止生成 */}
          <button
            type="button"
            onClick={targetBusy ? stopTarget : handleSend}
            disabled={(!targetBusy && !text.trim() && quotes.length === 0 && images.length === 0) || noModel}
            aria-label={targetBusy ? "停止生成" : "发送"}
            title={targetBusy ? "停止生成" : "发送"}
            className="h-8 w-8 sm:h-[34px] sm:w-[34px] rounded-full bg-btn-inputarea text-brand-fg flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {targetBusy ? (
              <Square size={14} strokeWidth={2.5} fill="currentColor" />
            ) : (
              <Send size={16} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* self-contained keyframes (no globals.css edits) */}
      <style>{`
        @keyframes inputarea-breathe {
          0%, 100% { border-color: rgba(var(--brand-rgb), 0.3); }
          50% { border-color: rgba(var(--brand-rgb), 0.8); }
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

      {/* 图片选择 hidden input */}
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageInput}
        className="hidden"
      />
    </div>
  );
}
