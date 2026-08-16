"use client";

/**
 * Explore — WelcomeView (empty-state welcome page)
 * Centered Monoton neon-tube logo + tagline + action buttons + optional feature cards.
 * "如何使用" opens an internal help popover (8 features); the round help
 * button opens the onboarding wizard via AppContext.
 */
import {
  BookOpen,
  Highlighter,
  Network,
  Orbit,
} from "lucide-react";
import { useApp } from "./app-context";

interface Feature {
  icon: typeof Highlighter;
  label: string;
  desc: string;
}

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
  const isFirstRun = projects.length === 0;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {/* 流体光斑背景（品牌色液态能量团，随主题切换） */}
      <div className="fluid-blobs" aria-hidden="true">
        <div className="fluid-blob blob-a" />
        <div className="fluid-blob blob-b" />
        <div className="fluid-blob blob-c" />
      </div>

      {/* Logo — Monoton neon-tube brand treatment (飘逸霓虹管 + 赛博光晕) */}
      <h1
        className="font-monoton brand-neon select-none text-center"
        style={{
          fontSize: "clamp(1.4rem, 5.2vw, 4.5rem)",
          lineHeight: 1,
        }}
      >
        OriginExplore
      </h1>

      {/* Actions（定位语已移入使用指南弹窗，主页保持极简） */}
      <div className="mt-10 flex items-center justify-center">
        <button
          type="button"
          onClick={() => openModal("docs")}
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
            onClick={() => openModal("docs")}
            className="mt-4 cursor-pointer rounded-full bg-btn-std px-4 py-1.5 text-xs text-primary transition-colors hover:bg-btn-std-hover"
          >
            查看完整引导
          </button>
        </div>
      )}
    </div>
  );
}
