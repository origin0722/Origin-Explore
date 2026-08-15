"use client";

/**
 * Explore — WelcomeView (empty-state welcome page)
 * Centered Bruno Ace logo + tagline + action buttons + optional feature cards.
 * "如何使用" opens an internal help popover (8 features); the round help
 * button opens the onboarding wizard via AppContext.
 */
import { useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  Highlighter,
  Monitor,
  Network,
  Orbit,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { useApp } from "./app-context";

interface Feature {
  icon: typeof Highlighter;
  label: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: Highlighter, label: "智能标注", desc: "点击带下划线的术语，展开解释卡片" },
  { icon: Network, label: "层级对话", desc: "子卡读上游主题，层层深入" },
  { icon: BookOpen, label: "文档阅读", desc: "长文拆解，划词即问" },
  { icon: Orbit, label: "思维宇宙", desc: "自己的理解，AI 点亮成星球" },
  { icon: SlidersHorizontal, label: "引用回答", desc: "选中 AI 回复文本，多条引用" },
  { icon: Monitor, label: "沉浸界面", desc: "极简专注的阅读体验" },
  { icon: Compass, label: "探索路径", desc: "每轮深挖链条清晰可见" },
  { icon: User, label: "个性化", desc: "主题与偏好随心配" },
];

const HIGHLIGHTS: Feature[] = [
  { icon: Network, label: "层级对话", desc: "问题层层深入，答案连成树" },
  { icon: Orbit, label: "思维宇宙", desc: "俯瞰全局，连接每个分支" },
  { icon: BookOpen, label: "文档阅读", desc: "长文拆解，一读就懂" },
];

interface GuideStep {
  title: string;
  desc: string;
}

const GUIDE_STEPS: GuideStep[] = [
  { title: "输入问题开始探索", desc: "问点什么，AI 会分点作答，不懂的地方加粗标记" },
  { title: "点击术语深挖", desc: "↗️ 深挖背景 · ➡️ 横向对比 · ⬇️ 继承上下文另起炉灶" },
  { title: "收录进思维宇宙", desc: "点击卡片「收录」按钮，理解会被点亮成 3D 星球" },
  { title: "上传论文阅读", desc: "支持 PDF / Word / Markdown，划词问 AI，逐词读懂" },
];

export function WelcomeView() {
  const { openModal, projects } = useApp();
  const [helpOpen, setHelpOpen] = useState(false);
  const isFirstRun = projects.length === 0;

  // Close the help popover with Escape.
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {/* Logo — same Bruno Ace brand treatment as the empty chat state */}
      <h1
        className="font-bruno-ace select-none text-center text-brand"
        style={{
          fontSize: "clamp(3rem, 8vw, 7rem)",
          lineHeight: 1,
          textShadow: "0 0 24px rgba(var(--brand-rgb), 0.35)",
        }}
      >
        Explore
      </h1>

      {/* Actions（定位语已移入使用指南弹窗，主页保持极简） */}
      <div className="mt-10 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="cursor-pointer rounded-full bg-btn-std px-9 py-2.5 text-[15px] text-primary transition-colors hover:bg-btn-std-hover"
        >
          如何使用
        </button>
      </div>

      {/* Feature cards */}
      <div className="mt-12 hidden gap-5 sm:flex">
        {HIGHLIGHTS.map((f) => (
          <div
            key={f.label}
            className="flex w-36 flex-col items-center gap-2.5 rounded-2xl border border-std bg-card-std p-4 text-center shadow-card transition-colors hover:bg-item-std-hover"
          >
            <f.icon size={22} className="text-brand" strokeWidth={1.8} />
            <div className="text-sm font-medium text-text-secondary">{f.label}</div>
            <div className="text-xs leading-snug text-text-tertiary">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* First-run guide booklet (引导说明书) — shown while there are no projects */}
      {isFirstRun && (
        <div className="mt-8 hidden w-full max-w-2xl rounded-2xl border border-std bg-card-std/70 p-5 text-left shadow-card backdrop-blur-sm sm:block">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">新手上路 · 引导说明书</h2>
            <span className="text-[10px] text-text-quaternary">数据仅存本机 · 可随时重看</span>
          </div>
          <ol className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {GUIDE_STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3 rounded-xl bg-item-std px-3.5 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-fg">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-secondary">{s.title}</div>
                  <div className="mt-0.5 text-xs leading-snug text-text-tertiary">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => openModal("guide")}
            className="mt-4 cursor-pointer rounded-full bg-btn-std px-4 py-1.5 text-xs text-primary transition-colors hover:bg-btn-std-hover"
          >
            查看完整引导
          </button>
        </div>
      )}

      {/* Internal help popover */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-overlay-modal p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="如何使用"
            className="w-full max-w-2xl max-h-[85%] overflow-y-auto scrollbar-card-std rounded-2xl border border-std bg-modal-floating p-7 sm:p-9 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-primary">如何使用</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="关闭"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-item-std-hover hover:text-primary"
              >
                <X size={19} />
              </button>
            </div>
            <p className="mt-2 text-sm text-text-tertiary">
              八个核心能力，一步步搭起你的知识树：
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li
                  key={f.label}
                  className="flex items-start gap-3.5 rounded-xl bg-item-std px-4 py-3.5"
                >
                  <f.icon size={20} className="mt-0.5 shrink-0 text-brand" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-text-secondary">{f.label}</div>
                    <div className="mt-1 text-sm leading-snug text-text-tertiary">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setHelpOpen(false);
                openModal("guide");
              }}
              className="mt-7 w-full cursor-pointer rounded-full bg-btn-std px-6 py-3 text-[15px] text-primary transition-colors hover:bg-btn-std-hover"
            >
              继续
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
