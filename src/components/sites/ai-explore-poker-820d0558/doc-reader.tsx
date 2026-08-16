"use client";

/**
 * Explore — DocReader（本地文档库 + 段落对话流 + AI 解读）
 * 单文件导出 2 个组件：
 *   DocLibrary — 文档库视图（上传 / 列表 / 空态）
 *   DocReader  — 段落对话框流：论文按段落拆成对话式消息块，
 *                每段下方有「创建分支卡片 / 创建发散卡片」按钮，底部是 AI 对话框。
 * 状态全部来自 useApp()（无 props）；Shell 按 activeDocId 切换：
 * "__library__" → DocLibrary；"doc-xxx" → DocReader；null → 聊天/欢迎。
 * 个人工具，仅中文。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  GitFork,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Waypoints,
  X,
} from "lucide-react";
import { useApp } from "./app-context";
import { InputArea } from "./input-area";
import type {
  DocumentItem,
  TermState,
} from "@/types/sites/ai-explore-poker-820d0558";
import {
  extractTextFromFile,
  isParseable,
  kindLabel,
  splitParagraphs,
} from "@/lib/sites/ai-explore-poker-820d0558/doc-parser";
import {
  detectTerms,
  type TermCandidate,
} from "@/lib/sites/ai-explore-poker-820d0558/term-detect";
import { GLOSSARY, findTerm } from "@/lib/sites/ai-explore-poker-820d0558/mock";

const uid = () => "doc-" + Math.random().toString(36).slice(2, 10);

/** 把 AI 解读版 markdown 按 `## 块标题` 拆成块（解读版 = 语义分块后的对话式消息块）。 */
function splitInterpretedBlocks(md: string): { title: string; body: string }[] {
  const parts = md.split(/^##\s+/m);
  const blocks: { title: string; body: string }[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const nl = t.indexOf("\n");
    if (nl === -1) {
      blocks.push({ title: t, body: "" });
      continue;
    }
    blocks.push({ title: t.slice(0, nl).trim(), body: t.slice(nl + 1).trim() });
  }
  return blocks.length ? blocks : [{ title: "全文", body: md }];
}

/** 正则转义（与 term-detect 相同规则，本文件独立实现） */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 文档添加时间：当天显示时刻，否则显示日期 */
function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 文档类型徽章（PDF / Word / Markdown / 纯文本 / HTML） */
function KindBadge({ kind }: { kind: DocumentItem["kind"] }) {
  return (
    <span className="text-[10px] border border-std rounded px-1.5 py-0.5 text-text-tertiary shrink-0">
      {kindLabel(kind)}
    </span>
  );
}

/* ============================================================
   DocLibrary —— 本地文档库（主区全宽视图）
   ============================================================ */

export function DocLibrary() {
  const { documents, addDocument, removeDocument, setActiveDocId, interpretDocument } = useApp();
  const [parsing, setParsing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  /** 逐文件解析（顺序处理），解析全部在本地完成 */
  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || parsing) return;
    setParsing(true);
    let firstId: string | null = null;
    for (const file of files) {
      try {
        const { kind, content } = await extractTextFromFile(file);
        if (!isParseable(content)) {
          showToast(`「${file.name}」解析为空`);
          continue;
        }
        const docId = uid();
        addDocument({
          id: docId,
          name: file.name,
          kind,
          content,
          addedAt: Date.now(),
        });
        if (!firstId) firstId = docId;
      } catch {
        showToast(`「${file.name}」解析失败`);
      }
    }
    setParsing(false);
    // 上传成功 → 直接进入该文档的解读视图（AI 自动分块 + 翻译 + 整理）
    if (firstId) {
      setActiveDocId(firstId);
      interpretDocument(firstId);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* 工具栏 */}
      <div className="px-6 py-4 border-b border-divider flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveDocId(null)}
            className="text-text-secondary hover:text-text-primary transition-colors shrink-0"
            title="返回聊天"
            aria-label="返回聊天"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-bold truncate">本地文档</h2>
        </div>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-btn-std hover:bg-btn-std-hover rounded-full text-sm transition-colors">
          {parsing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Upload size={15} />
          )}
          {parsing ? "解析中…" : "上传文档"}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm"
            multiple
            disabled={parsing}
            onChange={handleFiles}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        /* 空态 */
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <FileText size={40} className="text-text-quaternary" />
          <p className="text-sm text-text-secondary">还没有文档</p>
          <p className="text-sm text-text-tertiary">
            支持 PDF / Word / Markdown / TXT / HTML，解析全部在本地完成
          </p>
        </div>
      ) : (
        /* 文档卡片网格 */
        <div className="flex-1 overflow-y-auto scrollbar-card-std px-6 py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 content-start">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group bg-card-std rounded-2xl border border-std p-4 hover:border-brand/40 transition-colors cursor-pointer"
              onClick={() => {
                setActiveDocId(doc.id);
                interpretDocument(doc.id); // 已有解读缓存则直接复用
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <KindBadge kind={doc.kind} />
                <button
                  className="text-text-quaternary hover:text-destructive transition-colors"
                  aria-label="删除文档"
                  title="删除文档"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDocument(doc.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold truncate">{doc.name}</p>
              <p className="text-[10px] text-text-quaternary mt-1">
                {(doc.content.length / 1000).toFixed(1)}k 字符 ·{" "}
                {formatDate(doc.addedAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-card-floating border border-std shadow-card px-4 py-2 text-sm text-primary whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   术语面板（问答列内容，桌面列 / 移动抽屉共用）
   ============================================================ */

interface TermPanelProps {
  term: string | null;
  candidate: TermCandidate | null;
  doc: DocumentItem;
  onClose: () => void;
  onAsk: (term: string) => void;
}

function TermPanel({ term, candidate, doc, onClose, onAsk }: TermPanelProps) {
  const glossary = term
    ? GLOSSARY.find(
        (g) => g.zh === term || g.en.toLowerCase() === term.toLowerCase()
      )
    : undefined;
  const node = term ? findTerm(term) : null;

  return (
    <>
      {/* 头部：来源徽章 + 术语名 + 关闭 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-divider shrink-0">
        <span className="text-[10px] border border-std rounded px-1.5 py-0.5 text-text-tertiary shrink-0">
          {candidate?.kind === "glossary" ? "词典" : "候选"}
        </span>
        <span className="text-sm font-semibold truncate">
          {term ?? "术语问答"}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-text-quaternary hover:text-text-primary transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto scrollbar-card-std p-4 min-h-0">
        {term === null ? (
          <p className="text-sm text-text-tertiary leading-6">
            点击正文中的高亮术语查看解释，或在文档中划词问 AI。
          </p>
        ) : (
          <>
            {glossary && (
              <div>
                <p className="text-sm text-text-secondary leading-6">
                  {glossary.explain}
                </p>
                <p className="text-xs text-text-tertiary mt-2">
                  点击问 AI 获得完整讲解
                </p>
              </div>
            )}
            {node && (
              <div className="mind-md mt-4">
                <div className="markdown-content text-sm text-text-content">
                  <ReactMarkdown>{node.summary}</ReactMarkdown>
                </div>
              </div>
            )}
            <button
              onClick={() => onAsk(term)}
              className="w-full mt-3 py-2 rounded-full bg-brand text-brand-fg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              问 AI：这是什么？
            </button>
          </>
        )}
      </div>
    </>
  );
}

/* ============================================================
   HighlightedText —— 术语高亮（组件内私有）
   detectTerms 一次 → 按词长降序建正则 → split 分段渲染
   ============================================================ */

interface TextPart {
  text: string;
  term?: string;
}

interface HighlightedTextProps {
  text: string;
  terms: TermCandidate[];
  termStates: Record<string, TermState>;
  onTermClick: (term: string) => void;
}

function HighlightedText({
  text,
  terms,
  termStates,
  onTermClick,
}: HighlightedTextProps) {
  const parts = useMemo<TextPart[]>(() => {
    if (terms.length === 0) return [{ text }];
    const byLower = new Map<string, TermCandidate>();
    for (const c of terms) byLower.set(c.term.toLowerCase(), c);
    // 按词长降序 → 长词先匹配，避免短词吞长词（中英文都匹配）
    const pattern = [...terms]
      .sort((a, b) => b.term.length - a.term.length)
      .map((c) => escapeRe(c.term))
      .join("|");
    const chunks = text.split(new RegExp(`(${pattern})`, "g"));
    const out: TextPart[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (i % 2 === 1) {
        // 命中片段：还原为候选的规范 term（如大写词 → 小写候选）
        out.push({
          text: chunk,
          term: byLower.get(chunk.toLowerCase())?.term ?? chunk,
        });
      } else if (chunk) {
        out.push({ text: chunk });
      }
    }
    return out;
  }, [text, terms]);

  return (
    <div className="text-text-content leading-7 text-[15px] whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        const term = p.term;
        if (!term) return <span key={i}>{p.text}</span>;
        const state = termStates[term];
        if (state === "mastered") {
          // 已掌握：弱化显示，不交互
          return (
            <span key={i} className="text-text-tertiary">
              {p.text}
            </span>
          );
        }
        if (state === "asked") {
          // 已问过：弱化但可再点
          return (
            <button
              key={i}
              onClick={() => onTermClick(term)}
              className="text-text-secondary border-b border-text-tertiary/50 cursor-pointer"
            >
              {p.text}
            </button>
          );
        }
        // 未见过：品牌色高亮，可点击
        return (
          <button
            key={i}
            onClick={() => onTermClick(term)}
            className="text-brand border-b border-brand/50 hover:bg-brand/10 cursor-pointer"
          >
            {p.text}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   DocReader —— 分栏阅读器（正文 + 问答列 + 划词问 AI）
   ============================================================ */

export function DocReader() {
  const {
    documents,
    activeDocId,
    setActiveDocId,
    termStates,
    openDocQuestion,
    removeDocument,
    interpretDocument,
    docInterpretingIds,
    openDocBranch,
    openDocDiverge,
  } = useApp();
  const doc = documents.find((d) => d.id === activeDocId) ?? null;
  const interpreting = doc ? docInterpretingIds.includes(doc.id) : false;

  // 打开文档时检测一次术语（上限 60 个）、拆分原文段落、解析 AI 解读块
  const terms = useMemo(() => (doc ? detectTerms(doc.content, 60) : []), [doc]);
  const paragraphs = useMemo(() => (doc ? splitParagraphs(doc.content) : []), [doc]);
  const interpretedBlocks = useMemo(
    () => (doc?.interpreted ? splitInterpretedBlocks(doc.interpreted) : []),
    [doc]
  );
  /** 是否已有"完整解读块"（标题 + 实质正文）——流式生成中的半截 markdown 不算。
      首个完整块出现前保持"AI 正在理解…"加载态，避免半块/空块闪烁。 */
  const hasCompleteBlocks = useMemo(() => {
    const md = doc?.interpreted ?? "";
    if (!md) return false;
    const parts = md.split(/^##\s+/m).filter((p) => p.trim());
    return parts.some((p) => {
      const nl = p.indexOf("\n");
      const body = nl === -1 ? "" : p.slice(nl + 1).trim();
      return body.length >= 12;
    });
  }, [doc]);
  const [panelTerm, setPanelTerm] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  /** false = 优先显示 AI 解读版；true = 查看原文 */
  const [showOriginal, setShowOriginal] = useState(false);

  // 切换文档时重置问答列与视图模式
  useEffect(() => {
    setPanelTerm(null);
    setPanelOpen(false);
    setShowOriginal(false);
  }, [doc?.id]);

  const openTermPanel = (term: string) => {
    setPanelTerm(term);
    setPanelOpen(true);
  };

  /** 问 AI：自动建「论文：xxx」项目 + 新 turn + 切回对话视图，并收起面板 */
  const askAbout = (term: string) => {
    if (!doc) return;
    openDocQuestion(term, doc.id);
    setPanelTerm(null);
    setPanelOpen(false);
  };

  /** 段落标题（取段首 18 字） */
  const paraTitle = (para: string) => {
    const t = para.replace(/\s+/g, " ").trim();
    return t.length > 18 ? t.slice(0, 18) + "…" : t || "文档段落";
  };

  /** 段落 → 分支卡片：以该段为主题开分支对话（继承段落上下文），主流中向下出现。
      来源与创建项目统一落在「论文：xxx」项目（openDocBranch 内部处理）——
      不再挂到"当前项目最后一个轮次"（空项目悬空 / 挂错无关轮次）。 */
  const branchFromPara = (para: string) => {
    if (!doc) return;
    openDocBranch(paraTitle(para), para, doc.name);
  };

  /** 段落 → 发散卡片：以该段为主题开平行会话（锚点 = 该段文本，AI 基于文档语境解读）。 */
  const divergeFromPara = (para: string) => {
    if (!doc) return;
    openDocDiverge(paraTitle(para), para, doc.name);
  };

  // Shell 保证 activeDocId 命中 documents；兜底空渲染
  if (!doc) return null;

  const candidate = panelTerm
    ? terms.find((c) => c.term === panelTerm) ?? null
    : null;

  return (
    <div className="h-full w-full flex flex-col">
      {/* 工具栏 */}
      <div className="h-12 px-4 border-b border-divider flex items-center gap-3 shrink-0">
        <button
          onClick={() => setActiveDocId("__library__")}
          className="text-text-secondary hover:text-text-primary transition-colors shrink-0"
          title="返回文档库"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-semibold truncate">{doc.name}</span>
        <KindBadge kind={doc.kind} />
        {/* AI 解读：理解全文 → 语义分块 + 双语对照 + 格式工整（上传后第一时间自动执行） */}
        <button
          type="button"
          onClick={() => interpretDocument(doc.id, !!doc.interpreted)}
          disabled={interpreting}
          title={
            doc.interpreted
              ? "重新解读：AI 重新理解全文并分块"
              : "AI 先理解全文，再按语义分块、双语对照、整理格式"
          }
          className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[11px] transition-colors ${
            doc.interpreted
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-std bg-btn-std text-text-secondary hover:border-brand/40 hover:text-brand"
          } disabled:cursor-default disabled:opacity-70`}
        >
          {interpreting ? (
            <>
              <Loader2 size={13} className="animate-spin" /> AI 解读中…
            </>
          ) : doc.interpreted ? (
            <>
              <RefreshCw size={13} /> 重新解读
            </>
          ) : (
            <>
              <Sparkles size={13} /> AI 解读
            </>
          )}
        </button>
        {doc.interpreted && (
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="flex h-7 shrink-0 cursor-pointer items-center rounded-full border border-std bg-btn-std px-3 text-[11px] text-text-secondary transition-colors hover:border-brand/40 hover:text-brand"
            title={showOriginal ? "切回 AI 解读版" : "查看原文"}
          >
            {showOriginal ? "解读版" : "原文"}
          </button>
        )}
        <span className="text-xs text-text-quaternary ml-auto shrink-0">
          {doc.interpreted
            ? `${interpretedBlocks.length} 个解读块 · ${terms.length} 个术语`
            : `${paragraphs.length} 段 · ${terms.length} 个术语`}
        </span>
        <button
          onClick={() => {
            removeDocument(doc.id);
            setActiveDocId("__library__");
          }}
          aria-label="删除文档"
          title="删除文档"
          className="text-text-quaternary hover:text-destructive transition-colors shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* 解读/原文对话流 + 桌面问答列 */}
      <div className="flex-1 flex min-h-0">
        {/* 对话流：AI 解读块（语义分块 + 翻译 + 工整）优先，可切回原文段落 */}
        <div className="flex-1 overflow-y-auto scrollbar-card-std px-4 sm:px-6 py-4">
          <div className="max-w-[760px] mx-auto flex flex-col gap-3">
            {doc.interpreted !== undefined && !showOriginal && !(interpreting && !hasCompleteBlocks) ? (
              /* AI 解读版（流式生成中：首个完整块出现后随进度逐块浮现） */
              interpretedBlocks.map((block, i) =>
                block.body.trim().length < 12 ? (
                  /* 元数据类碎块（作者/日期/脚注）：紧凑附注行，不占卡片 */
                  <div
                    key={i}
                    className="px-1 py-0.5 text-xs text-text-quaternary select-none"
                  >
                    📌 {block.title}
                    {block.body.trim() ? `：${block.body.trim()}` : ""}
                  </div>
                ) : (
                <div key={i} className="rounded-xl border border-std bg-card-std/60 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2 select-none">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand/30 bg-brand/10 text-brand shrink-0">
                      解读块 {i + 1}
                    </span>
                    <span className="text-xs font-semibold text-text-turn-title truncate min-w-0">
                      {block.title}
                    </span>
                  </div>
                  {block.body && (
                    <div className="markdown-content text-sm leading-relaxed text-text-content select-text">
                      <ReactMarkdown>{block.body}</ReactMarkdown>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 select-none">
                    <button
                      type="button"
                      disabled={interpreting}
                      onClick={() => divergeFromPara(block.body || block.title)}
                      className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-diverge/40 bg-diverge/10 px-3 text-[11px] text-diverge transition-colors hover:bg-diverge/20 disabled:cursor-default disabled:opacity-50"
                      title={
                        interpreting
                          ? "解读进行中，生成完成后可创建卡片"
                          : "以该块为主题开平行会话（不打断当前对话）"
                      }
                    >
                      <Waypoints size={12} /> 创建发散卡片
                    </button>
                    <button
                      type="button"
                      disabled={interpreting}
                      onClick={() => branchFromPara(block.body || block.title)}
                      className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 text-[11px] text-brand transition-colors hover:bg-brand/20 disabled:cursor-default disabled:opacity-50"
                      title={
                        interpreting
                          ? "解读进行中，生成完成后可创建卡片"
                          : "以该块为主题开分支对话（继承块上下文）"
                      }
                    >
                      <GitFork size={12} /> 创建分支卡片
                    </button>
                  </div>
                </div>
              ))
            ) : interpreting ? (
              /* AI 解读中：卡片分配由解读结果决定，首块生成前不显示机械分段 */
              <div className="flex flex-col items-center justify-center gap-4 py-24 select-none">
                <div className="relative h-14 w-14">
                  <span className="absolute inset-0 rounded-full border-2 border-brand/20" />
                  <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
                </div>
                <p className="text-sm text-text-secondary">AI 正在理解《{doc.name}》…</p>
                <p className="text-[11px] text-text-quaternary">语义分块 → 双语对照 → 格式整理</p>
              </div>
            ) : (
              /* 原文段落流（解读完成后可切换查看） */
              paragraphs.map((para, i) => (
              <div key={i} className="rounded-xl border border-std bg-card-std/60 px-4 py-3">
                <div className="flex items-center gap-2 mb-2 select-none">
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-std text-text-quaternary">
                    第 {i + 1} 段
                  </span>
                  <span className="text-[10px] text-text-quaternary">{para.length} 字</span>
                  <span className="ml-auto text-[10px] text-text-quaternary">
                    点击术语可问 AI
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-content select-text">
                  <HighlightedText
                    text={para}
                    terms={terms}
                    termStates={termStates}
                    onTermClick={openTermPanel}
                  />
                </div>
                <div className="flex items-center gap-2 mt-3 select-none">
                  <button
                    type="button"
                    onClick={() => divergeFromPara(para)}
                    className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-diverge/40 bg-diverge/10 px-3 text-[11px] text-diverge transition-colors hover:bg-diverge/20"
                    title="以该段为主题开平行会话（不打断当前对话）"
                  >
                    <Waypoints size={12} /> 创建发散卡片
                  </button>
                  <button
                    type="button"
                    onClick={() => branchFromPara(para)}
                    className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 text-[11px] text-brand transition-colors hover:bg-brand/20"
                    title="以该段为主题开分支对话（继承段落上下文）"
                  >
                    <GitFork size={12} /> 创建分支卡片
                  </button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>

        {/* 桌面端问答列（可折叠成 20px 窄条） */}
        <div className="hidden sm:flex flex-col shrink-0 border-l border-divider bg-bg/40 min-h-0">
          {panelOpen ? (
            <div className="w-[420px] flex flex-col min-h-0">
              <TermPanel
                term={panelTerm}
                candidate={candidate}
                doc={doc}
                onClose={() => setPanelOpen(false)}
                onAsk={askAbout}
              />
            </div>
          ) : (
            <div className="w-5 flex flex-col items-center pt-1.5">
              <button
                onClick={() => setPanelOpen(true)}
                className="text-text-quaternary hover:text-text-primary transition-colors"
                title="打开术语问答"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 移动端：底部抽屉（点术语打开，外部点击关闭） */}
      {panelOpen && (
        <div
          className="sm:hidden fixed inset-0 z-20 bg-overlay-modal"
          onClick={() => setPanelOpen(false)}
        />
      )}
      {panelOpen && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 top-1/3 z-30 bg-modal-std rounded-t-2xl shadow-card flex flex-col overflow-hidden">
          <div className="h-1 w-10 mx-auto mt-2 rounded-full bg-item-std shrink-0" />
          <TermPanel
            term={panelTerm}
            candidate={candidate}
            doc={doc}
            onClose={() => setPanelOpen(false)}
            onAsk={askAbout}
          />
        </div>
      )}

      {/* 底部 AI 对话框：围绕文档提问（AI 基于全文解读） */}
      <div className="shrink-0 px-2 sm:px-4 pb-3 pt-1">
        <InputArea />
      </div>
    </div>
  );
}
