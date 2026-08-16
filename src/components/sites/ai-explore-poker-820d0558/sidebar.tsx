"use client";

/**
 * Explore — Sidebar（左侧边栏）
 * 结构：顶部功能按钮 / 本地文档分组 / 项目滚动区（常驻聊天 + 本地/云端分组）/ 底部设置·账户
 * 状态全部来自 useApp()（无 props）；折叠态仅显示 44×44 图标块。
 * 视觉自由发挥，结构按 02-sidebar.md。
 */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  BookMarked,
  BookOpen,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  FolderTree,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Pin,
  Plus,
  Settings,
  Sparkles,
  Star,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "./app-context";
import {
  extractTextFromFile,
  isParseable,
} from "@/lib/sites/ai-explore-poker-820d0558/doc-parser";

interface TopAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export function Sidebar({ expanded, onClearHover }: { expanded?: boolean; onClearHover?: () => void }) {
  const {
    projects,
    activeProjectId,
    selectProject,
    selectResident,
    deleteProject,
    createProject,
    renameProject,
    folders,
    createFolder,
    removeFolder,
    moveProjectToFolder,
    smartMode,
    toggleSmartMode,
    importProject,
    exportBackup,
    importBackup,
    addDocument,
    collapsed,
    toggleSidebar,
    openModal,
    profile,
    documents,
    setActiveDocId,
    toggleFavorite,
    focusTurn,
    turnSummaries,
    summarizingTurnId,
    summarizeTurn,
  } = useApp();

  /** 有效展开态：shell 的 hover 临时展开（折叠窄条碰触即展）优先；
      未传 prop 时回落到用户偏好（collapsed）。内容渲染/样式全部以此为准。 */
  const show = expanded ?? !collapsed;

  const [openGroups, setOpenGroups] = useState<{ local: boolean }>({ local: true });
  /** 用户文件夹的折叠状态（缺省展开） */
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [favOpen, setFavOpen] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);
  const [docUploading, setDocUploading] = useState(false);

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

  const startRename = (id: string, current: string) => {
    setMenuFor(null);
    setRenamingId(id);
    setRenameDraft(current);
  };
  const confirmRename = (id: string) => {
    renameProject(id, renameDraft);
    setRenamingId(null);
  };
  const confirmFolder = () => {
    createFolder(folderDraft);
    setFolderDraft("");
    setCreatingFolder(false);
  };

  const downloadProject = (p: (typeof projects)[number]) => {
    const data = { title: p.title, turns: p.turns };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.title || "project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuFor(null);
    showToast("已导出项目");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = importBackup(parsed);
        showToast(res.ok ? res.message : `导入失败：${res.message}`);
      } catch {
        showToast("导入失败：无效的 JSON 文件");
      }
    };
    reader.readAsText(file);
  };

  /** 全量备份下载：项目 + 思维宇宙 + 文档 + 术语状态 + 文件夹 + 档案 + 设置。 */
  const handleExportBackup = () => {
    exportBackup();
    showToast("✓ 已导出完整备份");
  };

  /** 侧边栏"+"：直接上传文档并进入文档库。 */
  const handleDocFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || docUploading) return;
    setDocUploading(true);
    for (const file of files) {
      try {
        const { kind, content } = await extractTextFromFile(file);
        if (!isParseable(content)) {
          showToast(`「${file.name}」解析为空`);
          continue;
        }
        addDocument({
          id: "doc-" + Math.random().toString(36).slice(2, 10),
          name: file.name,
          kind,
          content,
          addedAt: Date.now(),
        });
      } catch {
        showToast(`「${file.name}」解析失败`);
      }
    }
    setDocUploading(false);
    setActiveDocId("__library__");
    showToast("已上传文档");
  };

  /** 新建项目后自动定位：展开所在分组 + 滚动到新项目行（避免分组折叠时"以为没建成功"）。 */
  const scrollToProject = (id: string) => {
    requestAnimationFrame(() => {
      document
        .getElementById(`project-row-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const topActions: TopAction[] = [
    {
      // 语义跟随"用户偏好"而非有效展开态：
      // 折叠（含 hover 临时展开）→ 「固定展开」：把临时展开锁定为持久；
      // 偏好展开 → 「收起侧边栏」：立即收起（同时结束 hover 临时展开，不被鼠标顶住）。
      key: "toggle",
      icon: collapsed ? Pin : PanelLeftClose,
      label: collapsed ? "固定展开" : "收起侧边栏",
      onClick: () => {
        if (!collapsed) onClearHover?.();
        toggleSidebar();
      },
    },
    { key: "folder", icon: FolderPlus, label: "新建文件夹", onClick: () => setCreatingFolder(true) },
    { key: "import", icon: Upload, label: "导入项目/恢复备份", onClick: () => importRef.current?.click() },
    { key: "export-backup", icon: Download, label: "导出完整备份", onClick: handleExportBackup },
  ];

  const localProjects = projects.filter((p) => !p.cloud && !p.resident);

  /** 收藏的轮次（跨项目聚合 → 收藏区 + 智能摘要） */
  const favTurns = projects.flatMap((p) =>
    p.turns.filter((t) => t.favorite).map((t) => ({ project: p, turn: t }))
  );

  const renderTopButton = (a: TopAction) => (
    <button
      key={a.key}
      onClick={a.onClick}
      title={!show ? a.label : undefined}
      className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-card ${
        !show ? "justify-center" : ""
      }`}
    >
      <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow transition-all duration-200 group-hover:scale-[1.1] group-hover:-translate-y-px group-hover:shadow-md">
        <a.icon size={24} />
      </span>
      {show && (
        <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3">
          {a.label}
        </span>
      )}
    </button>
  );

  const renderGroupHeader = (
    key: "local",
    icon: LucideIcon,
    label: string,
    open: boolean,
    onAdd?: () => void
  ) => {
    const GroupIcon = icon;
    return (
      <div className="group flex items-center gap-1">
        <button
          key={key}
          onClick={() => setOpenGroups((g) => ({ ...g, [key]: !g[key] }))}
          className={`flex items-center w-full gap-2 py-1.5 px-1 rounded-lg transition-colors hover:bg-item-std-hover ${
            !show ? "justify-center" : ""
          }`}
        >
          {show && (
            <ChevronRight
              size={13}
              className={`text-text-tertiary transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          )}
          <GroupIcon size={14} className="text-text-tertiary shrink-0" />
          {show && (
            <span className="flex-1 text-left text-sm text-text-tertiary font-medium truncate">{label}</span>
          )}
        </button>
        {/* 分组内新建项目（与文件夹一致：各分组/文件夹点「+」创建） */}
        {onAdd && show && (
          <button
            onClick={onAdd}
            aria-label={`在「${label}」中新建项目`}
            title={`在「${label}」中新建项目`}
            className="w-5 h-5 rounded flex items-center justify-center text-text-quaternary hover:text-brand shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    );
  };

  const renderProjectRow = (p: (typeof projects)[number]) => {
    const isActive = p.id === activeProjectId;
    const isRenaming = renamingId === p.id;
    return (
      <div
        key={p.id}
        id={`project-row-${p.id}`}
        role="button"
        tabIndex={0}
        onClick={() => selectProject(p.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectProject(p.id);
          }
        }}
        title={!show ? p.title : undefined}
        className={`group flex items-center w-full p-1.5 rounded-xl relative border-2 cursor-pointer transition-colors ${
          isActive ? "border-brand/40 bg-item-std" : "border-transparent hover:bg-item-std-hover"
        } ${!show ? "justify-center" : ""}`}
      >
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            isActive ? "bg-item-std-active text-brandtw" : "text-text-tertiary group-hover:text-text-secondary"
          }`}
        >
          {p.folder === "doc" ? (
            <FolderTree size={14} />
          ) : (
            <ChevronRight size={14} className={`transition-transform duration-200 ${isActive ? "rotate-90" : ""}`} />
          )}
        </span>
        {show &&
          (isRenaming ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") confirmRename(p.id);
                else if (e.key === "Escape") setRenamingId(null);
              }}
              onBlur={() => confirmRename(p.id)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 rounded bg-item-std px-1.5 py-0.5 text-sm text-primary outline-none ring-1 ring-brand/50 ml-1"
            />
          ) : (
            <span className="block flex-1 min-w-0 truncate text-sm text-primary ml-1">{p.title}</span>
          ))}
        {show && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuFor(menuFor === p.id ? null : p.id);
            }}
            aria-label="项目菜单"
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-text-tertiary hover:bg-item-std-active hover:text-primary"
          >
            <MoreHorizontal size={15} />
          </button>
        )}
        {menuFor === p.id && show && (
          <div
            className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg bg-card-floating border border-std shadow-card p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => startRename(p.id, p.title)}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-primary hover:bg-item-std-active"
            >
              重命名
            </button>
            <button
              onClick={() => downloadProject(p)}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-primary hover:bg-item-std-active"
            >
              导出为 JSON
            </button>
            <div className="px-2 pt-1.5 pb-0.5 text-[10px] text-text-quaternary">移动到文件夹</div>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => {
                  moveProjectToFolder(p.id, f);
                  setMenuFor(null);
                }}
                className="w-full text-left pl-4 pr-2 py-1 rounded-md text-sm text-text-secondary hover:bg-item-std-active"
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => {
                moveProjectToFolder(p.id, null);
                setMenuFor(null);
              }}
              className="w-full text-left pl-4 pr-2 py-1 rounded-md text-sm text-text-secondary hover:bg-item-std-active"
            >
              无文件夹
            </button>
            <button
              onClick={() => {
                deleteProject(p.id);
                setMenuFor(null);
                showToast("已删除项目");
              }}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-destructive hover:bg-item-std-active"
            >
              删除
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      // key 随有效展开态切换：折叠窄条 → 展开时内容整体淡入（与宽度动画同步，丝滑浮现）
      key={show ? "sidebar-wide" : "sidebar-narrow"}
      className={`h-full flex flex-col text-primary relative z-10 bg-transparent transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        show ? "animate-[fadeIn_280ms_ease-out]" : ""
      }`}
      style={{ width: show ? 225 : 56 }}
    >
      {/* 顶部功能按钮区 */}
      <div className="p-4 space-y-2">{topActions.map(renderTopButton)}</div>

      {/* 常驻聊天：固定的跨项目会话（逻辑上排在本地文档之上） */}
      {!show ? (
        <button
          onClick={() => selectResident()}
          title="常驻聊天"
          className="flex items-center w-full justify-center py-1.5"
        >
          <MessageSquare size={15} className="text-text-tertiary shrink-0" />
        </button>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => selectResident()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectResident();
            }
          }}
          title="常驻聊天（跨项目保留）"
          className={`mx-2 flex items-center gap-2 rounded-xl px-2 pt-3 pb-1 cursor-pointer transition-colors ${
            activeProjectId === "resident" ? "bg-item-std" : "hover:bg-item-std"
          }`}
        >
          <MessageSquare size={18} className="text-text-tertiary shrink-0" />
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-primary">常驻聊天</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              aria-label="聊天模式"
              title="聊天模式"
              onClick={(e) => {
                e.stopPropagation();
                if (smartMode) {
                  toggleSmartMode();
                  showToast("已切回普通聊天");
                }
              }}
              className={`p-1 rounded-md transition-colors ${
                smartMode ? "text-text-tertiary hover:text-primary hover:bg-item-std-hover" : "bg-card-floating text-primary"
              }`}
            >
              <MessageSquare size={13} />
            </button>
            <button
              aria-label="智能模式"
              title="AI 智能模式（结合你的档案/思维宇宙/术语掌握度个性化回答）"
              onClick={(e) => {
                e.stopPropagation();
                if (smartMode) return; // 已开启：按钮无动作，不再误导性提示
                toggleSmartMode();
                showToast("已开启 AI 智能模式：常驻对话将结合你的探索档案回答");
              }}
              className={`p-1 rounded-md transition-colors ${
                smartMode ? "bg-card-floating text-brand" : "text-text-tertiary hover:text-primary hover:bg-item-std-hover"
              }`}
            >
              <Sparkles size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 本地文档分组（常驻聊天之下） */}
      {!show ? (
        <button
          onClick={() => setActiveDocId("__library__")}
          title="本地文档"
          className="flex items-center w-full justify-center py-1.5"
        >
          <BookOpen size={14} className="text-text-tertiary shrink-0" />
        </button>
      ) : (
        <div
          onClick={() => setActiveDocId("__library__")}
          className="flex items-center justify-between px-4 pt-4 pb-1 cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-tertiary min-w-0">
            <BookOpen size={14} className="shrink-0" />
            <span className="truncate">本地文档</span>
          </span>
          <button
            aria-label="上传文档"
            title="上传文档"
            onClick={(e) => {
              e.stopPropagation();
              docUploadRef.current?.click();
            }}
            className="w-6 h-6 rounded-full bg-btn-control hover:bg-btn-control-hover flex items-center justify-center text-text-tertiary hover:text-primary transition-colors shrink-0"
          >
            {docUploading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
          </button>
        </div>
      )}
      {show &&
        documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setActiveDocId(doc.id)}
            title={doc.name}
            className="w-full flex items-center gap-2 px-4 py-1.5 rounded-lg hover:bg-item-std-hover text-sm text-text-secondary"
          >
            <FileText size={14} className="text-text-tertiary shrink-0" />
            <span className="min-w-0 truncate">{doc.name}</span>
          </button>
        ))}

      {/* 项目滚动区 */}
      <div className="flex-1 overflow-y-auto scrollbar-card-std w-full max-w-xs self-center px-2">
        {/* 新建文件夹输入 */}
        {show && creatingFolder && (
          <div className="flex items-center gap-1 px-2 py-1 mt-1">
            <input
              autoFocus
              value={folderDraft}
              onChange={(e) => setFolderDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmFolder();
                else if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setFolderDraft("");
                }
              }}
              onBlur={confirmFolder}
              placeholder="文件夹名称，回车确认"
              className="flex-1 min-w-0 rounded bg-item-std px-2 py-1 text-sm text-primary outline-none ring-1 ring-brand/50 placeholder:text-text-quaternary"
            />
          </div>
        )}

        {/* 用户文件夹分组：点击标题折叠/展开；文件夹内可直接新建项目 */}
        {show &&
          folders.map((folderName) => {
            const folderProjects = localProjects.filter((p) => p.folder === folderName);
            const folderOpen = openFolders[folderName] !== false;
            return (
              <div key={folderName} className="mt-1">
                <div className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFolders((o) => ({ ...o, [folderName]: !folderOpen }))
                    }
                    title={folderOpen ? "折叠文件夹" : "展开文件夹"}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 px-1 text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-text-tertiary transition-transform duration-200 ${folderOpen ? "rotate-90" : ""}`}
                    />
                    <Folder size={14} className="text-text-tertiary shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-left text-sm text-text-tertiary font-medium">
                      {folderName}
                    </span>
                    <span className="shrink-0 text-[10px] text-text-quaternary">
                      {folderProjects.length}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      // 在文件夹内新建项目：自动展开该文件夹 + 滚动定位到新项目
                      const id = createProject(folderName);
                      setOpenFolders((o) => ({ ...o, [folderName]: true }));
                      scrollToProject(id);
                    }}
                    aria-label={`在「${folderName}」中新建项目`}
                    title={`在「${folderName}」中新建项目`}
                    className="w-5 h-5 rounded flex items-center justify-center text-text-quaternary hover:text-brand shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={() => {
                      removeFolder(folderName);
                      showToast("已删除文件夹");
                    }}
                    aria-label="删除文件夹"
                    className="w-5 h-5 rounded flex items-center justify-center text-text-tertiary hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={13} />
                  </button>
                </div>
                {folderOpen && folderProjects.map(renderProjectRow)}
              </div>
            );
          })}

        {/* 本地项目 */}
        <div className="mt-1">
          {renderGroupHeader("local", Folder, "本地项目", openGroups.local, () => {
            const id = createProject();
            setOpenGroups((g) => ({ ...g, local: true }));
            scrollToProject(id);
          })}
          {openGroups.local &&
            localProjects
              .filter((p) => !p.folder || !folders.includes(p.folder))
              .map(renderProjectRow)}
        </div>
      </div>

      {/* 底部固定区 */}
      <div className="mt-auto p-4 py-6 space-y-2">
        {/* 收藏区：与设置同款的入口 + 展开的收藏列表（常驻可见） */}
        <div>
          <button
            onClick={() => setFavOpen((v) => !v)}
            title={!show ? "收藏" : undefined}
            className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
              !show ? "justify-center" : ""
            }`}
          >
            <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow">
              <Star size={24} className={favTurns.length > 0 ? "text-brand" : ""} fill={favTurns.length > 0 ? "currentColor" : "none"} />
            </span>
            {show && (
              <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3 flex-1 text-left">
                收藏
              </span>
            )}
            {show && favTurns.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="rounded-full bg-brand/15 px-1.5 text-[10px] leading-4 text-brand">
                  {favTurns.length}
                </span>
                <ChevronRight
                  size={14}
                  className={`mr-2 text-text-tertiary transition-transform duration-200 ${
                    favOpen ? "rotate-90" : ""
                  }`}
                />
              </span>
            )}
          </button>
          {favOpen && show && favTurns.length > 0 && (
            <div className="mt-1 max-h-[168px] overflow-y-auto scrollbar-card-std space-y-0.5 pl-2 pr-1">
              {favTurns.map(({ project, turn }) => (
                  <div key={turn.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => focusTurn(project.id, turn.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          focusTurn(project.id, turn.id);
                        }
                      }}
                      title={`${project.title} · ${turn.title}（点击跳转）`}
                      className="group flex items-center gap-1.5 w-full p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-item-std-hover"
                    >
                      <Star size={13} className="text-brand shrink-0" fill="currentColor" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-text-secondary">{turn.title}</span>
                        <span className="block truncate text-[10px] text-text-quaternary">
                          {project.title}
                        </span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          summarizeTurn(turn.id);
                        }}
                        aria-label="智能摘要"
                        title="智能摘要"
                        className={`p-1 rounded-md shrink-0 transition-colors ${
                          summarizingTurnId === turn.id
                            ? "text-brand"
                            : "text-text-quaternary hover:text-brand hover:bg-item-std-active"
                        }`}
                      >
                        {summarizingTurnId === turn.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(turn.id);
                        }}
                        aria-label="取消收藏"
                        title="取消收藏"
                        className="p-1 rounded-md shrink-0 text-text-quaternary transition-colors hover:text-primary hover:bg-item-std-active"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {(turnSummaries[turn.id] !== undefined || summarizingTurnId === turn.id) && (
                      <div className="ml-3 mt-0.5 rounded-lg bg-item-std px-2.5 py-2 text-[11px] leading-5 text-text-secondary whitespace-pre-wrap break-words">
                        {summarizingTurnId === turn.id ? "✨ 正在生成摘要…" : turnSummaries[turn.id]}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* 使用文档：收藏下方、设置上方（合并"如何使用"+"使用指南"的完整教程） */}
        <button
          onClick={() => openModal("docs")}
          title={!show ? "使用文档" : undefined}
          className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
            !show ? "justify-center" : ""
          }`}
        >
          <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow">
            <BookMarked size={24} />
          </span>
          {show && (
            <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3">
              使用文档
            </span>
          )}
        </button>

        <button
          onClick={() => openModal("settings")}
          title={!show ? "设置" : undefined}
          className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
            !show ? "justify-center" : ""
          }`}
        >
          <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow">
            <Settings size={24} />
          </span>
          {show && (
            <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3">
              设置
            </span>
          )}
        </button>

        <button
          onClick={() => openModal("login")}
          title={!show ? (profile ? profile.name : "账户") : undefined}
          className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
            !show ? "justify-center" : ""
          }`}
        >
          <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow">
            {profile ? (
              <span
                className="block w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
                style={{ background: profile.avatarColor }}
              >
                {profile.name[0]}
              </span>
            ) : (
              <span className="block w-6 h-6 rounded-full border-2 border-primary" />
            )}
          </span>
          {show && (
            <span
              className={`${profile ? "text-sm" : "text-base"} font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3 min-w-0 truncate`}
            >
              {profile ? profile.name : "账户"}
            </span>
          )}
        </button>
      </div>

      {/* 菜单点击外部关闭 */}
      {menuFor && <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />}

      {/* 导入项目的隐藏文件输入 */}
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* 侧边栏"+"上传文档的隐藏文件输入 */}
      <input
        ref={docUploadRef}
        type="file"
        accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm"
        multiple
        onChange={handleDocFiles}
        className="hidden"
      />

      {/* 演示提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-card-floating border border-std shadow-card px-4 py-2 text-sm text-primary whitespace-nowrap">
          {toast}
        </div>
      )}
    </aside>
  );
}
