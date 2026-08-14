"use client";

/**
 * Explore — DocReader（本地文档库 + 分栏阅读器 + 划词问 AI）
 * 单文件导出 2 个组件：
 *   DocLibrary — 文档库视图（上传 / 列表 / 空态）
 *   DocReader  — 分栏阅读器（正文 + 术语高亮 + 问答列 + 划词问 AI）
 * 状态全部来自 useApp()（无 props）；Shell 按 activeDocId 切换：
 * "__library__" → DocLibrary；"doc-xxx" → DocReader；null → 聊天/欢迎。
 * 视觉按 08-docreader.md；个人工具，仅中文。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "./app-context";
import type {
  DocumentItem,
  TermState,
} from "@/types/sites/ai-explore-poker-820d0558";
import {
  extractTextFromFile,
  isParseable,
  kindLabel,
} from "@/lib/sites/ai-explore-poker-820d0558/doc-parser";
import {
  detectTerms,
  type TermCandidate,
} from "@/lib/sites/ai-explore-poker-820d0558/term-detect";
import { GLOSSARY, findTerm } from "@/lib/sites/ai-explore-poker-820d0558/mock";

const uid = () => "doc-" + Math.random().toString(36).slice(2, 10);

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
  const { documents, addDocument, removeDocument, setActiveDocId } = useApp();
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
    for (const file of files) {
      try {
        const { kind, content } = await extractTextFromFile(file);
        if (!isParseable(content)) {
          showToast(`「${file.name}」解析为空`);
          continue;
        }
        addDocument({
          id: uid(),
          name: file.name,
          kind,
          content,
          addedAt: Date.now(),
        });
      } catch {
        showToast(`「${file.name}」解析失败`);
      }
    }
    setParsing(false);
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
              onClick={() => setActiveDocId(doc.id)}
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
              className="w-full mt-3 py-2 rounded-full bg-brand text-black text-sm font-medium hover:opacity-90 transition-opacity"
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
  const { documents, activeDocId, setActiveDocId, termStates, openDocQuestion, removeDocument } =
    useApp();
  const doc = documents.find((d) => d.id === activeDocId) ?? null;

  // 打开文档时检测一次术语（上限 60 个）
  const terms = useMemo(() => (doc ? detectTerms(doc.content, 60) : []), [doc]);
  const [panelTerm, setPanelTerm] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selText, setSelText] = useState<string | null>(null);

  // 切换文档时重置问答列与划词状态
  useEffect(() => {
    setPanelTerm(null);
    setPanelOpen(false);
    setSelText(null);
  }, [doc?.id]);

  const openTermPanel = (term: string) => {
    setPanelTerm(term);
    setPanelOpen(true);
  };

  /** 划词问 AI：正文区鼠标抬起时读取选区 */
  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // 点击高亮术语按钮不算划词
    if ((e.target as HTMLElement).closest("button")) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    setSelText(text.length > 0 ? text : null);
  };

  /** 问 AI：自动建「论文：xxx」项目 + 新 turn + 切回对话视图，并收起面板 */
  const askAbout = (term: string) => {
    if (!doc) return;
    openDocQuestion(term, doc.name);
    setPanelTerm(null);
    setPanelOpen(false);
    setSelText(null);
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
        <span className="text-xs text-text-quaternary ml-auto shrink-0">
          已识别 {terms.length} 个术语
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

      {/* 正文 + 桌面问答列 */}
      <div className="flex-1 flex min-h-0">
        {/* 正文区 */}
        <div
          className="flex-1 overflow-y-auto scrollbar-card-std px-6 py-6"
          onMouseUp={handleMouseUp}
        >
          <div className="max-w-[760px] mx-auto">
            <h1 className="text-xl font-bold mb-4">{doc.name}</h1>
            <HighlightedText
              text={doc.content}
              terms={terms}
              termStates={termStates}
              onTermClick={openTermPanel}
            />
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

      {/* 划词问 AI 浮条 */}
      {selText && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-modal-floating border border-std rounded-full px-4 py-2 text-sm shadow-card flex items-center gap-2 whitespace-nowrap">
          <button
            onClick={() => askAbout(selText)}
            className="text-text-primary hover:text-brand transition-colors max-w-[70vw] truncate"
          >
            问 AI：『{selText.length > 16 ? selText.slice(0, 16) + "…" : selText}』
          </button>
          <button
            onClick={() => setSelText(null)}
            className="text-text-quaternary hover:text-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
