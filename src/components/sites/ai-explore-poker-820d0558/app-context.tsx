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
  ByokModel,
  ChatProject,
  ChatSettings,
  DocumentItem,
  Message,
  ModelInfo,
  Profile,
  TermState,
  ThoughtNode,
  Turn,
} from "@/types/sites/ai-explore-poker-820d0558";
import {
  DEFAULT_SETTINGS,
  generateReply,
  makeDemoProject,
  makeDemoTurn,
  themeId,
} from "@/lib/sites/ai-explore-poker-820d0558/mock";

/**
 * OpenAI 兼容的 chat/completions 流式调用（`stream: true` + SSE，浏览器直连，密钥不落盘到服务器）。
 * 逐 delta 回调 `onDelta`；首个增量到达时触发 `onFirst`（用于解除"首字超时"）。
 * 少数网关忽略 stream:true 仍返回整段 JSON -> 按整体输出兜底。
 */
async function streamOpenAICompatible(
  byok: ByokModel,
  messages: { role: string; content: string }[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
  onFirst?: () => void
): Promise<void> {
  const url = byok.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${byok.apiKey}`,
    },
    body: JSON.stringify({ model: byok.modelId, messages, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // 解析一行 SSE data -> 取 delta.content；心跳/半包静默跳过。
  const handleLine = (line: string, state: { received: boolean }) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (payload === "[DONE]") return;
    let delta: unknown;
    try {
      delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
    } catch {
      return;
    }
    if (typeof delta === "string" && delta) {
      if (!state.received) {
        state.received = true;
        onFirst?.();
      }
      onDelta(delta);
    }
  };

  const ctype = res.headers.get("content-type") ?? "";
  if (!res.body || ctype.includes("application/json")) {
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("空响应");
    handleLine("data: " + JSON.stringify({ choices: [{ delta: { content: text.trim() } }] }), { received: false });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const state = { received: false };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) handleLine(line, state);
  }
  if (buf) handleLine(buf, state);
  if (!state.received) throw new Error("空响应");
}

export interface AppState {
  settings: ChatSettings;
  setSettings(partial: Partial<ChatSettings>): void;
  projects: ChatProject[];
  activeProjectId: string | null;
  createProject(): void;
  /** 空态 "?" 按钮：载入一个带示例对话的项目 */
  loadSampleProject(): void;
  selectProject(id: string): void;
  /** 打开常驻聊天（跨项目保留的会话）。 */
  selectResident(): void;
  deleteProject(id: string): void;
  renameProject(id: string, name: string): void;
  /** 项目文件夹（分组） */
  folders: string[];
  createFolder(name: string): void;
  removeFolder(name: string): void;
  moveProjectToFolder(id: string, folder: string | null): void;
  /** 常驻聊天 AI 智能模式开关 */
  smartMode: boolean;
  toggleSmartMode(): void;
  /** 导入一个项目（导出/导入为 JSON） */
  importProject(data: { title?: string; turns?: Turn[] }): void;
  /** 用户自带的 BYOK 模型（密钥仅存本机） */
  byokModels: ByokModel[];
  addByokModel(input: { name: string; baseUrl: string; modelId: string; apiKey: string }): void;
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

/** 常驻聊天的固定项目 id（跨项目保留的会话）。 */
const RESIDENT_CHAT_ID = "resident";

interface PersistedState {
  settings?: ChatSettings;
  projects?: ChatProject[];
  activeProjectId?: string | null;
  thoughtNodes?: ThoughtNode[];
  termStates?: Record<string, TermState>;
  profile?: Profile | null;
  documents?: DocumentItem[];
  folders?: string[];
  smartMode?: boolean;
  byokModels?: ByokModel[];
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
  // 常驻聊天：固定项目（不可删、不进列表），首次启动自动创建。
  const [projects, setProjects] = useState<ChatProject[]>(() => {
    const list = boot.projects?.length ? boot.projects : [makeDemoProject()];
    return list.some((p) => p.resident)
      ? list
      : [{ ...makeDemoProject(), id: RESIDENT_CHAT_ID, title: "常驻聊天", resident: true }, ...list];
  });
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
  const [folders, setFolders] = useState<string[]>(boot.folders ?? []);
  const [smartMode, setSmartModeState] = useState<boolean>(boot.smartMode ?? false);
  const [byokModels, setByokModels] = useState<ByokModel[]>(boot.byokModels ?? []);

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
        folders,
        smartMode,
        byokModels,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota / unavailable — skip */
    }
  }, [settings, projects, activeProjectId, thoughtNodes, termStates, profile, documents, folders, smartMode, byokModels]);

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

  const loadSampleProject = useCallback(() => {
    const turn = makeDemoTurn("什么是量子纠缠？");
    turn.messages = [
      { id: uid(), role: "user", content: "什么是量子纠缠？", createdAt: Date.now() },
      { id: uid(), role: "assistant", content: generateReply("什么是量子纠缠？"), createdAt: Date.now() },
    ];
    const p: ChatProject = {
      ...makeDemoProject(),
      id: uid(),
      title: "示例：量子纠缠",
      turns: [turn],
    };
    setProjects((list) => [p, ...list]);
    setActiveProjectId(p.id);
    setActiveDocId(null);
  }, []);

  const selectProject = useCallback((id: string) => setActiveProjectId(id), []);

  const selectResident = useCallback(() => setActiveProjectId(RESIDENT_CHAT_ID), []);

  const deleteProject = useCallback((id: string) => {
    // 常驻聊天不可删除。
    if (id === RESIDENT_CHAT_ID) return;
    setProjects((list) => list.filter((p) => p.id !== id));
    setActiveProjectId((cur) => (cur === id ? null : cur));
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    const title = name.trim();
    if (!title) return;
    setProjects((list) =>
      list.map((p) => (p.id === id ? { ...p, title, updatedAt: Date.now() } : p))
    );
  }, []);

  const createFolder = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setFolders((list) => (list.includes(n) ? list : [...list, n]));
  }, []);

  const removeFolder = useCallback((name: string) => {
    setFolders((list) => list.filter((f) => f !== name));
    setProjects((list) =>
      list.map((p) => (p.folder === name ? { ...p, folder: null } : p))
    );
  }, []);

  const moveProjectToFolder = useCallback((id: string, folder: string | null) => {
    setProjects((list) =>
      list.map((p) => (p.id === id ? { ...p, folder } : p))
    );
  }, []);

  const toggleSmartMode = useCallback(() => setSmartModeState((v) => !v), []);

  const importProject = useCallback(
    (data: { title?: string; turns?: Turn[] }) => {
      const p: ChatProject = {
        ...makeDemoProject(),
        id: uid(),
        title: data.title?.trim() || "Untitled",
        turns: Array.isArray(data.turns) ? data.turns : [],
      };
      setProjects((list) => [p, ...list]);
      setActiveProjectId(p.id);
    },
    []
  );

  const addByokModel = useCallback(
    (input: { name: string; baseUrl: string; modelId: string; apiKey: string }) => {
      const name = input.name.trim();
      if (!name) return;
      const m: ByokModel = {
        id: "byok:" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        provider: "BYOK",
        description: input.apiKey.trim() ? "自定义模型（密钥仅存本机）" : "自定义模型",
        baseUrl: input.baseUrl.trim().replace(/\/+$/, "") || "https://api.openai.com/v1",
        modelId: input.modelId.trim() || name,
        apiKey: input.apiKey.trim(),
      };
      setByokModels((list) => [...list, m]);
    },
    []
  );

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

  /** 在目标项目最后一个 turn 追加一条空 assistant 消息（打字机/SSE 共用的写入目标）。 */
  const appendAssistantMessage = useCallback((targetId: string) => {
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
                          content: "",
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
  }, []);

  /** 覆写目标项目最后一条 assistant 消息的内容。 */
  const setLastAssistantContent = useCallback(
    (targetId: string, content: string) => {
      setProjects((list) =>
        list.map((p) =>
          p.id === targetId
            ? {
                ...p,
                turns: p.turns.map((t, i) =>
                  i === p.turns.length - 1
                    ? {
                        ...t,
                        messages: t.messages.map((m, mi) =>
                          mi === t.messages.length - 1 ? { ...m, content } : m
                        ),
                      }
                    : t
                ),
              }
            : p
        )
      );
    },
    []
  );

  /**
   * 打字机式把 `reply` 写入最后一条 assistant 消息。
   * `opts.append === false`：复用已有消息（SSE 已追加过 / 覆写部分内容）。
   * `opts.prefix`：从头就显示的前缀（用于保留流式中断前已收到的部分）。
   */
  const streamReply = useCallback(
    (
      reply: string,
      targetId: string,
      onDone?: () => void,
      opts?: { append?: boolean; prefix?: string }
    ) => {
      if (opts?.append !== false) appendAssistantMessage(targetId);
      const prefix = opts?.prefix ?? "";
      let pos = 0;
      const step = 12;
      const timer = window.setInterval(() => {
        pos = Math.min(pos + step, reply.length);
        setLastAssistantContent(targetId, prefix + reply.slice(0, pos));
        if (pos >= reply.length) {
          window.clearInterval(timer);
          setBusy(false);
          onDone?.();
        }
      }, 20);
    },
    [appendAssistantMessage, setLastAssistantContent]
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
      // 自动标题：给"Untitled"项目用首条消息命名（设置可关）。
      if (settings.autoTitleEnabled) {
        setProjects((list) =>
          list.map((p) =>
            p.id === targetId && (p.title === "Untitled" || !p.title.trim())
              ? { ...p, title, updatedAt: Date.now() }
              : p
          )
        );
      }
      setBusy(true);
      const done = () => {
        // 发消息后自动折叠侧边栏（桌面端）
        if (wasDesktop) setCollapsed(true);
      };

      // 最近对话历史（离线回复与 BYOK 共用；当前问题单独传）。
      const history = turns
        .flatMap((t) => t.messages)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      // 当前激活的是 BYOK 模型且有完整配置 → 走真实流式 API（失败回退离线）。
      const byok = byokModels.find(
        (m) => m.id === settings.activeModelId && m.provider === "BYOK"
      );
      if (byok && byok.apiKey && byok.baseUrl && byok.modelId) {
        const controller = new AbortController();
        // 15s 内没有任何增量 -> 放弃回退；开始出字后不再限时（流可能很长）。
        const timer = window.setTimeout(() => controller.abort(), 15000);
        appendAssistantMessage(targetId); // SSE 直接往这条消息里流
        let acc = "";
        streamOpenAICompatible(
          byok,
          [...history, { role: "user", content }],
          (delta) => {
            acc += delta;
            setLastAssistantContent(targetId, acc);
          },
          controller.signal,
          () => window.clearTimeout(timer)
        )
          .then(() => {
            window.clearTimeout(timer);
            setBusy(false);
            done();
          })
          .catch((err: unknown) => {
            window.clearTimeout(timer);
            const why =
              err instanceof Error && err.name === "AbortError"
                ? "请求超时"
                : err instanceof Error && err.message
                  ? err.message
                  : "网络错误";
            if (acc) {
              // 流中断：保留已收到的部分，接着补一段离线回复。
              streamReply(generateReply(content, history), targetId, done, {
                append: false,
                prefix: `${acc}\n\n> ⚠️ BYOK 流式中断（${why}），以下为离线知识库补充：\n\n`,
              });
            } else {
              const fallback = `> ⚠️ BYOK 请求失败（${why}），已回退到离线知识库。\n\n${generateReply(content, history)}`;
              streamReply(fallback, targetId, done, { append: false });
            }
          });
      } else {
        // 离线 mock 路径：短暂延迟后按知识库生成回复（带上下文记忆）。
        window.setTimeout(() => {
          streamReply(generateReply(content, history), targetId, done);
        }, 1200);
      }
    },
    [
      activeProjectId,
      busy,
      appendTurn,
      settings.autoTitleEnabled,
      settings.activeModelId,
      byokModels,
      turns,
      streamReply,
      appendAssistantMessage,
      setLastAssistantContent,
    ]
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
      appendTurn(targetId, title, `继续深挖：${title}`, aiContent ?? generateReply(title));
      setMindscapeOpen(false);
    },
    [activeProjectId, appendTurn]
  );

  /** 文档问答：同名项目（论文: xxx）不存在则创建，然后开新 turn */
  const openDocQuestion = useCallback(
    (term: string, docName: string) => {
      const projectTitle = `论文：${docName}`;
      const ai = generateReply(term);
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
    loadSampleProject,
    selectProject,
    selectResident,
    deleteProject,
    renameProject,
    folders,
    createFolder,
    removeFolder,
    moveProjectToFolder,
    smartMode,
    toggleSmartMode,
    importProject,
    byokModels,
    addByokModel,
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
