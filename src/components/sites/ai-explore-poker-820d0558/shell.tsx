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
      {/* ---- Sidebar: absolute overlay on desktop (does not take flow space —
             main stays full-screen so content centers on x=720 like the
             original), off-canvas drawer on mobile. Width tracks `collapsed`
             on every breakpoint (225px / 56px). ---- */}
      <div
        className={`fixed bottom-0 left-0 top-0 z-40 h-full overflow-hidden bg-bg transition-all duration-200 sm:absolute sm:translate-x-0 sm:bg-transparent ${
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

      {/* ---- Main column ---- */}
      <main className="relative flex-1 overflow-hidden">

        {/* Mobile hamburger — opens the sidebar drawer */}
        <button
          type="button"
          aria-label="打开侧边栏"
          onClick={() => setMobileOpen(true)}
          className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-btn-std text-primary shadow-card transition-colors hover:bg-btn-std-hover sm:hidden"
        >
          <Menu size={18} />
        </button>

        {/* Main canvas column: content area (flex-1, 806px at 900px viewport)
            + bottom input bar, so welcome/card center on y≈403 like the
            original; horizontal center x=720 via max-w-[990px]. */}
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

        {/* Desktop: right Mindscape panel (mobile opens its own fullscreen
            drawer via the FAB below — container stays decoration-free there) */}
        {mindscapeOpen && (
          <div className="absolute right-0 top-0 z-10 h-full sm:w-[225px] sm:border-l sm:border-divider sm:bg-bg/60 sm:backdrop-blur-sm">
            <MindscapePanel onClose={() => setMindscapeOpen(false)} />
          </div>
        )}
        {/* Desktop: always-visible 20px Mindscape rail (expand/collapse) */}
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

        {/* Centered Mind Universe toggle — original places it bottom-center above
            the input (32x32 @90px on mobile / 36x36 @120px on desktop) with a
            brand-green glyph. Click again to close the Mindscape panel. */}
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
      </main>

      {/* ---- Desktop: always-visible turn-graph panel (轮次导航有向图，右侧常驻) ---- */}
      <aside className="hidden lg:flex w-[270px] shrink-0 border-l border-divider bg-bg/70 backdrop-blur-sm relative z-10">
        <TurnGraphPanel />
      </aside>

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
