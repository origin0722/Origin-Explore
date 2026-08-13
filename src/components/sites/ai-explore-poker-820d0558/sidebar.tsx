"use client";

/**
 * Explore — Sidebar（左侧边栏）
 * 结构：顶部功能按钮 / 本地文档分组 / 项目滚动区（常驻聊天 + 本地/云端分组）/ 底部设置·账户
 * 状态全部来自 useApp()（无 props）；折叠态仅显示 44×44 图标块。
 * 视觉自由发挥，结构按 02-sidebar.md。
 */
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Cloud,
  FileText,
  Folder,
  FolderPlus,
  FolderTree,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Settings,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "./app-context";

interface TopAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export function Sidebar() {
  const {
    projects,
    activeProjectId,
    selectProject,
    deleteProject,
    createProject,
    collapsed,
    toggleSidebar,
    openModal,
    profile,
    documents,
    setActiveDocId,
  } = useApp();

  const [openGroups, setOpenGroups] = useState({ local: true, cloud: true });
  const [menuFor, setMenuFor] = useState<string | null>(null);
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

  const topActions: TopAction[] = [
    { key: "toggle", icon: PanelLeftClose, label: "收起侧边栏", onClick: toggleSidebar },
    { key: "folder", icon: FolderPlus, label: "新建文件夹", onClick: () => showToast("文件夹分组（演示功能）") },
    { key: "new", icon: Plus, label: "新建项目", onClick: createProject },
    { key: "import", icon: Upload, label: "导入项目", onClick: () => showToast("导入项目（演示功能）") },
  ];

  const localProjects = projects.filter((p) => !p.cloud);
  const cloudProjects = projects.filter((p) => p.cloud);

  const renderTopButton = (a: TopAction) => (
    <button
      key={a.key}
      onClick={a.onClick}
      title={collapsed ? a.label : undefined}
      className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow">
        <a.icon size={24} />
      </span>
      {!collapsed && (
        <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3">
          {a.label}
        </span>
      )}
    </button>
  );

  const renderGroupHeader = (
    key: "local" | "cloud",
    icon: LucideIcon,
    label: string,
    open: boolean,
    pill?: string
  ) => {
    const GroupIcon = icon;
    return (
    <button
      key={key}
      onClick={() => setOpenGroups((g) => ({ ...g, [key]: !g[key] }))}
      className={`flex items-center w-full gap-2 py-1.5 px-1 rounded-lg transition-colors hover:bg-item-std-hover ${
        collapsed ? "justify-center" : ""
      }`}
    >
      {!collapsed && (
        <ChevronRight
          size={13}
          className={`text-text-tertiary transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      )}
      <GroupIcon size={14} className="text-text-tertiary shrink-0" />
      {!collapsed && (
        <span className="flex-1 text-left text-xs text-text-tertiary font-medium truncate">{label}</span>
      )}
      {!collapsed && pill && (
        <span className="text-xs text-text-tertiary border border-std rounded px-1.5 py-0.5 whitespace-nowrap">
          {pill}
        </span>
      )}
    </button>
    );
  };

  const renderProjectRow = (p: (typeof projects)[number]) => {
    const isActive = p.id === activeProjectId;
    return (
      <div
        key={p.id}
        role="button"
        tabIndex={0}
        onClick={() => selectProject(p.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectProject(p.id);
          }
        }}
        title={collapsed ? p.title : undefined}
        className={`group flex items-center w-full p-1.5 rounded-xl relative border-2 cursor-pointer transition-colors ${
          isActive ? "border-brand/40 bg-item-std" : "border-transparent hover:bg-item-std-hover"
        } ${collapsed ? "justify-center" : ""}`}
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
        {!collapsed && <span className="block flex-1 min-w-0 truncate text-sm text-primary ml-1">{p.title}</span>}
        {!collapsed && (
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
        {menuFor === p.id && !collapsed && (
          <div
            className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg bg-card-floating border border-std shadow-card p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                deleteProject(p.id);
                setMenuFor(null);
                showToast("已删除项目");
              }}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-primary hover:bg-item-std-active"
            >
              删除
            </button>
            <button
              onClick={() => {
                setMenuFor(null);
                showToast("重命名（演示功能）");
              }}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm text-primary hover:bg-item-std-active"
            >
              重命名
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="h-full flex flex-col text-primary relative z-10 bg-transparent transition-[width] duration-200"
      style={{ width: collapsed ? 56 : 225 }}
    >
      {/* 顶部功能按钮区 */}
      <div className="p-4 space-y-2">{topActions.map(renderTopButton)}</div>

      {/* 本地文档分组（常驻） */}
      {collapsed ? (
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
          <span className="flex items-center gap-2 text-xs text-text-tertiary font-medium min-w-0">
            <BookOpen size={14} className="shrink-0" />
            <span className="truncate">本地文档</span>
          </span>
          <button
            aria-label="打开文档库"
            onClick={(e) => {
              e.stopPropagation();
              setActiveDocId("__library__");
            }}
            className="w-6 h-6 rounded-full bg-btn-control hover:bg-btn-control-hover flex items-center justify-center text-text-tertiary hover:text-primary transition-colors shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
      {!collapsed &&
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
        {/* 常驻聊天 */}
        <div
          className={`flex items-center w-full gap-2 rounded-xl p-2 hover:bg-item-std transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <MessageSquare size={18} className="text-text-icon-secondary shrink-0" />
          {!collapsed && <span className="flex-1 min-w-0 truncate text-sm text-primary">常驻聊天</span>}
          {!collapsed && (
            <div className="flex items-center gap-1 shrink-0">
              <button aria-label="聊天模式" className="p-1 rounded-md bg-card-floating text-primary">
                <MessageSquare size={13} />
              </button>
              <button
                aria-label="智能模式"
                onClick={() => showToast("AI 智能模式（演示功能）")}
                className="p-1 rounded-md text-text-tertiary hover:text-primary hover:bg-item-std-hover"
              >
                <Sparkles size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 本地项目 */}
        <div className="mt-1">
          {renderGroupHeader("local", Folder, "本地项目", openGroups.local)}
          {openGroups.local && localProjects.map(renderProjectRow)}
        </div>

        {/* 云端项目 */}
        <div className="mt-1">
          {renderGroupHeader("cloud", Cloud, "云端项目", openGroups.cloud, "仅会员")}
          {openGroups.cloud && cloudProjects.map(renderProjectRow)}
        </div>
      </div>

      {/* 底部固定区 */}
      <div className="mt-auto p-4 py-6 space-y-2">
        <button
          onClick={() => openModal("settings")}
          title={collapsed ? "设置" : undefined}
          className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="relative p-2.5 bg-btn-control group-hover:bg-btn-control-hover rounded-lg shadow">
            <Settings size={24} />
          </span>
          {!collapsed && (
            <span className="text-base font-normal text-primary whitespace-nowrap transition-all duration-300 ml-3">
              设置
            </span>
          )}
        </button>

        <button
          onClick={() => openModal("login")}
          title={collapsed ? (profile ? profile.name : "账户") : undefined}
          className={`group relative flex items-center w-full rounded-lg shadow-card overflow-hidden transition-all duration-200 ${
            collapsed ? "justify-center" : ""
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
          {!collapsed && (
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

      {/* 演示提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-card-floating border border-std shadow-card px-4 py-2 text-sm text-primary whitespace-nowrap">
          {toast}
        </div>
      )}
    </aside>
  );
}
