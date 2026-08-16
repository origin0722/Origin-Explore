"use client";

/**
 * Explore — App shell (site: ai.explore.poker/chat clone)
 * Layout skeleton: sidebar + main (chat/welcome + input + mindscape) + modals.
 * Desktop: in-flow sidebar rail (225px / 56px). Mobile: off-canvas drawer +
 * hamburger; Mindscape opens via bottom-right FAB.
 * Views switch on activeDocId: null = chat/welcome · "__library__" = DocLibrary
 * · doc id = DocReader. MindUniverse renders as a fullscreen overlay on top.
 * Sibling components consume shared state via useApp() (no props) per the
 * shared contract — this file only assembles layout + viewport behavior.
 */
import { useEffect, useRef, useState } from "react";
import { BrainCircuit, ChevronLeft, Menu } from "lucide-react";

import { useApp } from "./app-context";
import { Sidebar } from "./sidebar";
import { ChatCard } from "./chat-card";
import { WelcomeView } from "./welcome-view";
import { TurnGraphPanel } from "./turn-graph";
import { InputArea } from "./input-area";
import { MindscapePanel } from "./mindscape-panel";
import { DocLibrary, DocReader } from "./doc-reader";
import { MindUniverse } from "./mind-universe";
import { OnboardingWizard, ProfileModal, SettingsModal, UsageDocModal } from "./modals";

/** 全局轻提示（底部 toast）：无 API / 请求失败等状态反馈，3 秒自动消失。 */
function AppNoticeToast() {
  const { appNotice, setAppNotice } = useApp();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!appNotice) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAppNotice(null), 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [appNotice, setAppNotice]);
  if (!appNotice) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-lg border border-std bg-card-floating px-4 py-2 text-sm text-primary shadow-card">
      {appNotice}
    </div>
  );
}

export function AppShell() {
  const {
    collapsed,
    projects,
    activeProjectId,
    activeDocId,
    documents,
    mindscapeOpen,
    setMindscapeOpen,
    universeOpen,
    setUniverseOpen,
    modals,
  } = useApp();

  // Mobile drawer state (desktop ignores it — the sidebar is in-flow there).
  const [mobileOpen, setMobileOpen] = useState(false);
  /** 折叠窄条时鼠标碰触侧边栏 → 临时展开（悬浮 overlay，不挤压内容）；移出收回。 */
  const [hoverExpand, setHoverExpand] = useState(false);
  /** 有效展开态 = 用户偏好展开 || hover 临时展开 */
  const expanded = !collapsed || hoverExpand;

  // 数据全部来自 localStorage（仅客户端）：服务端渲染的是空态，挂载后再渲染真实内容，
  // 避免 SSR 空态与客户端内容的水合不匹配警告（与 mind-universe 同一模式）。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close the drawer whenever the active project or document changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [activeProjectId, activeDocId]);

  const activeProject =
    activeProjectId != null
      ? projects.find((p) => p.id === activeProjectId) ?? null
      : null;
  /** 是否已有轮次（出现卡片树） */
  const hasTurns = (activeProject?.turns.length ?? 0) > 0;

  /**
   * 对话框左缘定位：按"无卡片树时的页面居中（略偏右 16px）"计算一次并固定——
   * 卡片树出现后左边不动、右缘随右侧留白平滑回收。
   */
  const dialogLeftMl =
    "mx-auto lg:ml-[max(0px,calc((100vw_-_min(990px,100vw))/2_-_209px))]";

  const activeDoc =
    activeDocId != null && activeDocId !== "__library__"
      ? documents.find((d) => d.id === activeDocId) ?? null
      : null;

  // View resolution: doc id → reader (stale id falls back to the library),
  // "__library__" → library, null → chat card or welcome.
  let content: React.ReactNode;
  if (activeDocId === "__library__" || (activeDocId != null && !activeDoc)) {
    content = <DocLibrary />;
  } else if (activeDoc) {
    content = <DocReader />;
  } else {
    content = activeProject ? <ChatCard /> : <WelcomeView />;
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden overscroll-none bg-bg">
      {mounted && (
        <>
      {/* ---- Sidebar: 悬浮式（桌面端 overlay，不占流，不挤压对话框；移动端抽屉） ---- */}
      <div
        className={`fixed inset-y-0 left-0 z-40 h-full shrink-0 overflow-hidden bg-bg transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:absolute sm:translate-x-0 sm:bg-transparent ${
          expanded ? "w-[225px]" : "w-[56px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        onMouseEnter={() => {
          // 桌面端：鼠标碰触侧边栏（折叠窄条）→ 丝滑展开（移出自动收回）
          if (window.matchMedia("(min-width: 640px)").matches) setHoverExpand(true);
        }}
        onMouseLeave={() => setHoverExpand(false)}
      >
        <Sidebar expanded={expanded} onClearHover={() => setHoverExpand(false)} />
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          aria-hidden
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 sm:hidden"
        />
      )}

      {/* ---- Main row：固定让出侧边栏宽度（sm 起侧边栏悬浮，内容让位 225px），
            对话框+卡片树保持页面居中，不随侧边栏折叠移动 ---- */}
      <main className="relative flex min-w-0 flex-1 overflow-hidden sm:pl-[225px]">
        {/* 对话区（聊天卡片在其中居中，最大 990px） */}
        <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col">
          {/* Mobile hamburger — opens the sidebar drawer */}
          <button
            type="button"
            aria-label="打开侧边栏"
            onClick={() => setMobileOpen(true)}
            className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-btn-std text-primary shadow-card transition-colors hover:bg-btn-std-hover sm:hidden"
          >
            <Menu size={18} />
          </button>

          {/* Main canvas column: content area + bottom input bar。
              无轮次：对话框按页面居中（略偏右）展开；
              有轮次：右侧让出 400px 给卡片树（padding 过渡），对话框左缘不动、右缘平滑回收 */}
          <div
            className={`relative z-10 flex h-full flex-col transition-[padding-right] duration-300 ease-in-out ${
              hasTurns ? "lg:pr-[400px]" : "lg:pr-0"
            }`}
          >
            <div
              data-dialog-root
              className={`relative min-h-0 w-full max-w-[990px] flex-1 ${dialogLeftMl}`}
            >
              {content}

              {/* 轮次导航卡片树：贴着对话框右缘，随右缘回收而浮现 */}
              <div className="absolute bottom-0 left-full top-0 ml-5 hidden w-[380px] flex-col pr-5 lg:flex">
                <div
                  className="my-auto max-h-[70%] overflow-y-auto overflow-x-hidden pt-[8vh]"
                  title="轮次导航图：点击跳转 · 右键切换已读/未读"
                >
                  <TurnGraphPanel />
                </div>
              </div>
            </div>
            <div
              className={`relative w-full max-w-[990px] flex-shrink-0 ${dialogLeftMl}`}
            >
              {activeDocId == null && <InputArea />}

              {/* 思维宇宙开关：相对对话框列水平居中（与输入框同轴），浮在输入框上方 */}
              <button
                type="button"
                aria-label={mindscapeOpen ? "关闭思维宇宙" : "打开思维宇宙"}
                onClick={() => setMindscapeOpen(!mindscapeOpen)}
                className="absolute -top-[76px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-btn-std text-brand shadow-card transition-colors hover:bg-btn-std-hover sm:h-9 sm:w-9"
              >
                <BrainCircuit className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* ICP footer strip */}
          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-0 select-none text-center text-xs text-text-quaternary">
            沪ICP备2025147118号 · 沪公网安备31010102008430号
          </div>
        </div>

        {/* 思维宇宙（贴最右侧）：Mindscape 面板 + 20px 折叠条 */}
        {mindscapeOpen && (
          <div className="absolute right-0 top-0 z-10 h-full w-[225px] border-l border-divider bg-bg/60 backdrop-blur-sm">
            <MindscapePanel onClose={() => setMindscapeOpen(false)} />
          </div>
        )}
        <div className="absolute right-0 top-0 z-20 hidden h-full w-[20px] sm:block">
          <button
            type="button"
            aria-label={mindscapeOpen ? "收起思维宇宙" : "打开思维宇宙"}
            title="思维宇宙"
            onClick={() => setMindscapeOpen(!mindscapeOpen)}
            className="absolute right-0 top-[52px] flex h-6 w-5 items-center justify-center rounded-l-lg bg-btn-std/40 text-text-tertiary transition-colors hover:bg-btn-std"
          >
            <ChevronLeft size={14} className={mindscapeOpen ? "" : "rotate-180"} />
          </button>
        </div>
      </main>

      {/* ---- Fullscreen 3D mind universe (covers everything) ---- */}
      {universeOpen && <MindUniverse onClose={() => setUniverseOpen(false)} />}

      {/* ---- Modals (self-contained; each manages its own close via useApp) ---- */}
      {modals.settings && <SettingsModal />}
      {modals.onboarding && <OnboardingWizard />}
      {modals.docs && <UsageDocModal />}
      {modals.login && <ProfileModal />}

      {/* ---- 全局轻提示 ---- */}
      <AppNoticeToast />
        </>
      )}
    </div>
  );
}

export default AppShell;
