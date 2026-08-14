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
import { useEffect, useState } from "react";
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
import { OnboardingWizard, ProfileModal, SettingsModal, GuideModal } from "./modals";

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

  // Close the drawer whenever the active project or document changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [activeProjectId, activeDocId]);

  const activeProject =
    activeProjectId != null
      ? projects.find((p) => p.id === activeProjectId) ?? null
      : null;

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
      {/* ---- Sidebar: 桌面端为真实占位列（不遮挡对话框）；移动端 off-canvas 抽屉 ---- */}
      <div
        className={`fixed inset-y-0 left-0 z-40 h-full shrink-0 overflow-hidden bg-bg transition-all duration-200 sm:static sm:z-auto sm:translate-x-0 sm:bg-transparent ${
          collapsed ? "w-[56px]" : "w-[225px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar />
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          aria-hidden
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 sm:hidden"
        />
      )}

      {/* ---- Main row: 对话区 | 轮次导航卡片树 | 思维宇宙（贴最右） ---- */}
      <main className="relative flex min-w-0 flex-1 overflow-hidden">
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

          {/* Main canvas column: content area + bottom input bar */}
          <div className="relative z-10 flex h-full flex-col">
            <div className="mx-auto min-h-0 w-full max-w-[990px] flex-1">
              {content}
            </div>
            <div
              className={`mx-auto w-full max-w-[990px] flex-shrink-0 ${
                activeProjectId == null ? "max-sm:hidden" : ""
              }`}
            >
              {activeDocId == null && <InputArea />}
            </div>
          </div>

          {/* Centered Mind Universe toggle — bottom-center of the dialog area */}
          <button
            type="button"
            aria-label={mindscapeOpen ? "关闭思维宇宙" : "打开思维宇宙"}
            onClick={() => setMindscapeOpen(!mindscapeOpen)}
            className="absolute bottom-[90px] left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-btn-std text-brand shadow-card transition-colors hover:bg-btn-std-hover sm:bottom-[120px] sm:h-9 sm:w-9"
          >
            <BrainCircuit className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </button>

          {/* ICP footer strip */}
          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-0 select-none text-center text-xs text-text-quaternary">
            沪ICP备2025147118号 · 沪公网安备31010102008430号
          </div>
        </div>

        {/* 轮次导航卡片树：对话框与思维宇宙之间的独立区域 */}
        <div className="relative z-10 mr-5 hidden w-[340px] shrink-0 flex-col lg:flex xl:w-[380px]">
          <div
            className="my-auto max-h-[70%] overflow-y-auto overflow-x-hidden pt-[8vh]"
            title="轮次导航图：点击跳转 · 右键切换已读/未读"
          >
            <TurnGraphPanel />
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
      {modals.guide && <GuideModal />}
      {modals.login && <ProfileModal />}
    </div>
  );
}

export default AppShell;
