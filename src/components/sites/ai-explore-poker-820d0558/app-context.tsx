"use client";

/**
 * Explore — global app state (site: ai.explore.poker/chat clone)
 * Contract hub: every component imports { useApp } from this file.
 * Personal tool: everything persists to localStorage (no backend).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ChatProject,
  ChatSettings,
  DocumentItem,
  Message,
  Profile,
  TermState,
  ThoughtNode,
  Turn,
} from "@/types/sites/ai-explore-poker-820d0558";
import {
  DEFAULT_SETTINGS,
  MOCK_REPLY_MARKDOWN,
  findTerm,
  genericTermSummary,
  makeDemoProject,
  makeDemoTurn,
  themeId,
} from "@/lib/sites/ai-explore-poker-820d0558/mock";

export interface AppState {
  settings: ChatSettings;
  setSettings(partial: Partial<ChatSettings>): void;
  projects: ChatProject[];
  activeProjectId: string | null;
  createProject(): void;
  selectProject(id: string): void;
  deleteProject(id: string): void;
  collapsed: boolean;
  toggleSidebar(): void;
  mindscapeOpen: boolean;
  setMindscapeOpen(v: boolean): void;
  modals: { settings: boolean; onboarding: boolean; login: boolean };
  openModal(k: keyof AppState["modals"]): void;
  closeModal(k: keyof AppState["modals"]): void;
  turns: Turn[];
  activeTurn: Turn | null;
  sendMessage(text: string): void;
  busy: boolean;
  /** 分支卡片 → 在当前项目开新 turn（继承上下文另起炉灶） */
  openBranchTurn(title: string, aiContent?: string): void;
  /** 本地档案（"登录"） */
  profile: Profile | null;
  setProfile(p: Profile | null): void;
  /** 思维宇宙节点 */
  thoughtNodes: ThoughtNode[];
  /** 从对话/文档收录：pending 状态，待面板验证 */
  addThoughtNode(subject: string, content: string, category?: string): void;
  /** mock AI 验证通过 */
  validateThoughtNode(id: string): void;
  removeThoughtNode(id: string): void;
  /** 个人理解度状态（"越来越懂用户"） */
  termStates: Record<string, TermState>;
  markTermState(term: string, state: TermState): void;
  /** 本地文档库 */
  documents: DocumentItem[];
  addDocument(doc: DocumentItem): void;
  removeDocument(id: string): void;
  activeDocId: string | null;
  setActiveDocId(id: string | null): void;
  /** 文档里问术语 → 自动建同名项目 + 新 turn（mock AI 回复取自术语树） */
  openDocQuestion(term: string, docName: string): void;
  universeOpen: boolean;
  setUniverseOpen(v: boolean): void;
}

const AppContext = createContext<AppState | null>(null);

const uid = () => "id-" + Math.random().toString(36).slice(2, 10);
const isDesktop = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;

const STORAGE_KEY = "explore-state-v1";

interface PersistedState {
  settings?: ChatSettings;
  projects?: ChatProject[];
  activeProjectId?: string | null;
  thoughtNodes?: ThoughtNode[];
  termStates?: Record<string, TermState>;
  profile?: Profile | null;
  documents?: DocumentItem[];
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedState;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const boot = useMemo(loadState, []);

  const [settings, setSettingsState] = useState<ChatSettings>({
    ...DEFAULT_SETTINGS,
    ...boot.settings,
  });
  const [projects, setProjects] = useState<ChatProject[]>(
    boot.projects?.length ? boot.projects : [makeDemoProject()]
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    boot.activeProjectId ?? null
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mindscapeOpen, setMindscapeOpen] = useState(false);
  const [universeOpen, setUniverseOpen] = useState(false);
  const [modals, setModals] = useState<AppState["modals"]>({
    settings: false,
    onboarding: false,
    login: false,
  });
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(boot.profile ?? null);
  const [thoughtNodes, setThoughtNodes] = useState<ThoughtNode[]>(boot.thoughtNodes ?? []);
  const [termStates, setTermStates] = useState<Record<string, TermState>>(
    boot.termStates ?? {}
  );
  const [documents, setDocuments] = useState<DocumentItem[]>(boot.documents ?? []);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // First visit → auto-open onboarding wizard once.
  useEffect(() => {
    try {
      if (!localStorage.getItem("explore-onboarded")) {
        setModals((m) => ({ ...m, onboarding: true }));
      }
    } catch {
      /* localStorage unavailable — skip */
    }
  }, []);

  // Persist everything (auto-save).
  useEffect(() => {
    try {
      const data: PersistedState = {
        settings,
        projects,
        activeProjectId,
        thoughtNodes,
        termStates,
        profile,
        documents,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota / unavailable — skip */
    }
  }, [settings, projects, activeProjectId, thoughtNodes, termStates, profile, documents]);

  // Theme → <html data-theme> (runtime re-skin).
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeId(settings.theme));
  }, [settings.theme]);

  const setSettings = useCallback((partial: Partial<ChatSettings>) => {
    setSettingsState((s) => ({ ...s, ...partial }));
  }, []);

  const createProject = useCallback(() => {
    const p: ChatProject = { ...makeDemoProject(), id: uid(), title: "Untitled" };
    setProjects((list) => [p, ...list]);
    setActiveProjectId(p.id);
  }, []);

  const selectProject = useCallback((id: string) => setActiveProjectId(id), []);

  const deleteProject = useCallback((id: string) => {
    setProjects((list) => list.filter((p) => p.id !== id));
    setActiveProjectId((cur) => (cur === id ? null : cur));
  }, []);

  const toggleSidebar = useCallback(() => setCollapsed((c) => !c), []);

  const openModal = useCallback((k: keyof AppState["modals"]) => {
    setModals((m) => ({ ...m, [k]: true }));
  }, []);
  const closeModal = useCallback((k: keyof AppState["modals"]) => {
    setModals((m) => ({ ...m, [k]: false }));
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const turns = useMemo(() => activeProject?.turns ?? [], [activeProject]);
  const activeTurn = useMemo(() => turns[turns.length - 1] ?? null, [turns]);

  /** Append a turn (user message + optional mock AI reply) to a project. */
  const appendTurn = useCallback(
    (
      projectId: string,
      title: string,
      userContent: string,
      aiContent?: string
    ) => {
      const turn = makeDemoTurn(title);
      const messages: Message[] = [
        { id: uid(), role: "user", content: userContent, createdAt: Date.now() },
      ];
      if (aiContent) {
        messages.push({ id: uid(), role: "assistant", content: aiContent, createdAt: Date.now() });
      }
      setProjects((list) =>
        list.map((p) =>
          p.id === projectId
            ? { ...p, turns: [...p.turns, { ...turn, messages }], updatedAt: Date.now() }
            : p
        )
      );
      setActiveProjectId(projectId);
    },
    []
  );

  const sendMessage = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || busy) return;

      const wasDesktop = isDesktop();
      let targetId = activeProjectId;
      if (!targetId) {
        const p: ChatProject = { ...makeDemoProject(), id: uid(), title: "Untitled" };
        setProjects((list) => [p, ...list]);
        targetId = p.id;
      }
      setActiveProjectId(targetId);

      const title = content.length > 18 ? content.slice(0, 18) + "…" : content;
      appendTurn(targetId, title, content);
      setBusy(true);

      // Mock AI reply (knowledge-tree card content).
      window.setTimeout(() => {
        setProjects((list) =>
          list.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  turns: p.turns.map((t, i) =>
                    i === p.turns.length - 1
                      ? {
                          ...t,
                          messages: [
                            ...t.messages,
                            {
                              id: uid(),
                              role: "assistant" as const,
                              content: MOCK_REPLY_MARKDOWN,
                              createdAt: Date.now(),
                            },
                          ],
                        }
                      : t
                  ),
                }
              : p
          )
        );
        setBusy(false);
        // 发消息后自动折叠侧边栏（桌面端）
        if (wasDesktop) setCollapsed(true);
      }, 1200);
    },
    [activeProjectId, busy, appendTurn]
  );

  /** 分支卡片：以术语开新 turn，AI 直接给出术语内容（继承上下文） */
  const openBranchTurn = useCallback(
    (title: string, aiContent?: string) => {
      let targetId = activeProjectId;
      if (!targetId) {
        const p: ChatProject = { ...makeDemoProject(), id: uid(), title: "Untitled" };
        setProjects((list) => [p, ...list]);
        targetId = p.id;
      }
      appendTurn(targetId, title, `继续深挖：${title}`, aiContent ?? genericTermSummary(title));
      setMindscapeOpen(false);
    },
    [activeProjectId, appendTurn]
  );

  /** 文档问答：同名项目（论文: xxx）不存在则创建，然后开新 turn */
  const openDocQuestion = useCallback(
    (term: string, docName: string) => {
      const projectTitle = `论文：${docName}`;
      const node = findTerm(term);
      const ai = node?.summary ?? genericTermSummary(term);
      let pid: string | null = null;
      setProjects((list) => {
        const existing = list.find((p) => p.title === projectTitle);
        if (existing) {
          pid = existing.id;
          return list;
        }
        const p: ChatProject = {
          ...makeDemoProject(),
          id: uid(),
          title: projectTitle,
          folder: "doc",
        };
        pid = p.id;
        return [p, ...list];
      });
      // setProjects updater runs async — schedule the turn after state commit.
      window.setTimeout(() => {
        if (!pid) return;
        appendTurn(pid, term, `什么是「${term}」？\n\n> 来自论文《${docName}》`, ai);
        setActiveDocId(null); // 回到对话视图看回答
      }, 0);
      // Mark term as asked (personalization).
      setTermStates((s) => ({ ...s, [term]: "asked" }));
    },
    [appendTurn]
  );

  const addThoughtNode = useCallback(
    (subject: string, content: string, category = "概念") => {
      setThoughtNodes((list) => [
        ...list,
        {
          id: uid(),
          subject,
          content,
          category,
          createdAt: Date.now(),
          status: "pending",
        },
      ]);
    },
    []
  );

  const validateThoughtNode = useCallback((id: string) => {
    setThoughtNodes((list) =>
      list.map((n) => (n.id === id ? { ...n, status: "validated", validatedAt: Date.now() } : n))
    );
  }, []);

  const removeThoughtNode = useCallback((id: string) => {
    setThoughtNodes((list) => list.filter((n) => n.id !== id));
  }, []);

  const markTermState = useCallback((term: string, state: TermState) => {
    setTermStates((s) => ({ ...s, [term]: state }));
  }, []);

  const addDocument = useCallback((doc: DocumentItem) => {
    setDocuments((list) => [doc, ...list]);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((list) => list.filter((d) => d.id !== id));
    setActiveDocId((cur) => (cur === id ? null : cur));
  }, []);

  const value: AppState = {
    settings,
    setSettings,
    projects,
    activeProjectId,
    createProject,
    selectProject,
    deleteProject,
    collapsed,
    toggleSidebar,
    mindscapeOpen,
    setMindscapeOpen,
    modals,
    openModal,
    closeModal,
    turns,
    activeTurn,
    sendMessage,
    busy,
    openBranchTurn,
    profile,
    setProfile,
    thoughtNodes,
    addThoughtNode,
    validateThoughtNode,
    removeThoughtNode,
    termStates,
    markTermState,
    documents,
    addDocument,
    removeDocument,
    activeDocId,
    setActiveDocId,
    openDocQuestion,
    universeOpen,
    setUniverseOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
