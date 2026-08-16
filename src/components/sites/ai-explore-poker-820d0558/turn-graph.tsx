"use client";

/**
 * Explore — TurnTree（轮次导航卡片树，透明浮层）
 * 借鉴原站卡片树：树状列表常显标题，缩进 + 引导线表达关系——
 *  - 根行 = 轮次（○ 节点 + 标题 + ⭐ 收藏 + 未读绿点），按时间纵排；
 *  - 发散卡片轮次（kind="diverge"）紧跟在来源轮次之后、**同一层级**，横向右移一档
 *    （引导轨 + 🪢，来源行带 ⇄ 计数），即"位于来源卡片右侧"；
 *  - 分支轮次（parentTurnId）嵌套在来源轮次之下，⬇️ 前缀；
 *  - 术语卡片按探索链条缩进挂在所属轮次下（↗️ 子 / ➡️ 关联 / ⬇️ 分支图标）；
 *  - 点击轮次跳转、点击卡片重开卡片、右键轮次切换未读。
 */
import { useEffect, useMemo, useRef } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Star,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { Turn } from "@/types/sites/ai-explore-poker-820d0558";
import { useApp } from "./app-context";

/* ------------------------------------------------------------------ */
/* 探索路径链（与 chat-card 共用）                                       */
/* ------------------------------------------------------------------ */

/** 卡片树行入场动画记忆：已渲染过的行 key（模块级，跨项目切换保留）。
    渲染期只读，useEffect 提交期写入——严格模式双渲染幂等，动画不被中途移除。 */
const seenRowKeys = new Set<string>();

/** 轮次探索路径的一条记录。 */
export type ExploreEntry = { term: string; kind: TermKindLike; at: number; parentTerm: string | null };
type TermKindLike = "child" | "related" | "branch" | "diverge";

/** 按 parentTerm 把扁平记录重组为链条（每条链一个根，术语只属于一条链）。 */
export function explorationChains(explored: ExploreEntry[]): ExploreEntry[][] {
  const ordered = [...explored].sort((a, b) => a.at - b.at);
  const owner = new Map<string, ExploreEntry[]>();
  const chains: ExploreEntry[][] = [];
  for (const e of ordered) {
    let chain = e.parentTerm ? owner.get(e.parentTerm) : undefined;
    if (!chain) {
      chain = [];
      chains.push(chain);
    } else if (chain.some((c) => c.term === e.term)) {
      owner.set(e.term, chain);
      continue; // cycle-safe
    }
    chain.push(e);
    owner.set(e.term, chain);
  }
  return chains;
}

/** 卡片类型图标（子 ↗ / 关联 → / 分支 ↓ / 发散 🪢） */
const KIND_ICON: Record<TermKindLike, LucideIcon> = {
  child: ArrowUpRight,
  related: ArrowRight,
  branch: ArrowDown,
  diverge: Waypoints,
};

/* ------------------------------------------------------------------ */
/* 树构建                                                               */
/* ------------------------------------------------------------------ */

interface TreeRow {
  key: string;
  depth: number;
  turn?: Turn;
  card?: { term: string; kind: TermKindLike; turnId: string };
  /** 发散卡片轮次：与来源卡片同层、渲染在来源右侧（横向右移一档） */
  diverge?: boolean;
  /** 发散组内序号（0 = 首条，引导轨向上探到来源行） */
  divergeOrdinal?: number;
  /** 发散组最后一条（引导轨在横向臂处收口） */
  divergeLast?: boolean;
  /** 来源轮次名下平行会话数（渲染 ⇄ 计数 chip） */
  divergeCount?: number;
}

function buildRows(turns: Turn[]): TreeRow[] {
  const byId = new Map(turns.map((t) => [t.id, t]));
  const children = new Map<string, Turn[]>();
  const diverges = new Map<string, Turn[]>();
  for (const t of turns) {
    if (t.parentTurnId && byId.has(t.parentTurnId)) {
      const list = children.get(t.parentTurnId) ?? [];
      list.push(t);
      children.set(t.parentTurnId, list);
    }
    if (t.kind === "diverge" && t.divergeSourceId && byId.has(t.divergeSourceId)) {
      const list = diverges.get(t.divergeSourceId) ?? [];
      list.push(t);
      diverges.set(t.divergeSourceId, list);
    }
  }
  const rows: TreeRow[] = [];
  const pushDivergeRows = (source: Turn, depth: number) => {
    const ds = diverges.get(source.id) ?? [];
    ds.forEach((d, i) => {
      rows.push({
        key: `d-${d.id}`,
        depth,
        turn: d,
        diverge: true,
        divergeOrdinal: i,
        divergeLast: i === ds.length - 1,
      });
      // 发散会话内的探索路径同样挂到树上（发散卡片之下，与分支/普通轮次一致）。
      for (const chain of explorationChains(d.explored ?? [])) {
        chain.forEach((e, k) => {
          // 兼容旧数据：发散种子项（term == 发散卡标题）与发散行节点重复，跳过。
          if (k === 0 && e.term === d.title) return;
          rows.push({
            key: `c-${d.id}-${e.term}`,
            depth: depth + 1 + k,
            card: { term: e.term, kind: e.kind, turnId: d.id },
          });
        });
      }
      // 修（4-1）：发散卡不是叶子——它下面可能还有分支（parentTurnId = 发散卡）
      // 与更深一层的发散（divergeSourceId = 发散卡）。此前 ds.forEach 直接 push、
      // 不递归，导致这些节点在树中整体消失（视图层却渲染它们，树与视图不一致）。
      for (const c of children.get(d.id) ?? []) pushTurn(c, depth + 1);
      pushDivergeRows(d, depth);
    });
  };
  const pushTurn = (t: Turn, depth: number) => {
    const ds = diverges.get(t.id) ?? [];
    rows.push({ key: `t-${t.id}`, depth, turn: t, divergeCount: ds.length || undefined });
    // 来源轮次的探索链先渲染，随后是整个发散组（发散行 + 其子树）——
    // 发散组作为来源的"平行影子"整体紧随来源，链顺序不再倒挂。
    for (const chain of explorationChains(t.explored ?? [])) {
      chain.forEach((e, k) => {
        rows.push({
          key: `c-${t.id}-${e.term}`,
          depth: depth + 1 + k,
          card: { term: e.term, kind: e.kind, turnId: t.id },
        });
      });
    }
    pushDivergeRows(t, depth);
    for (const c of children.get(t.id) ?? []) pushTurn(c, depth + 1);
  };
  turns
    .filter(
      (t) =>
        (!t.parentTurnId || !byId.has(t.parentTurnId)) &&
        !(t.kind === "diverge" && t.divergeSourceId && byId.has(t.divergeSourceId))
    )
    .forEach((t) => pushTurn(t, 0));
  return rows;
}

/* ------------------------------------------------------------------ */
/* 组件                                                                 */
/* ------------------------------------------------------------------ */

function CardKindIcon({ kind }: { kind: TermKindLike }) {
  const Icon = KIND_ICON[kind];
  return <Icon size={12} strokeWidth={2.4} className="shrink-0 text-brand/80" />;
}

/** 引导曲线：贝塞尔平滑连接上游节点。
    diverge = 从来源行横向分流（同级平行）· branch = 纵向分支 · card = 术语挂接。 */
function TreeConnector({
  type,
  delay = 0,
}: {
  type: "diverge" | "branch" | "card";
  delay?: number;
}) {
  const d =
    type === "diverge"
      ? "M4 -9 C 4 10, 17 5, 17 13"
      : type === "branch"
        ? "M4 -9 C 4 3, 4 12, 14 12"
        : "M4 -4 C 4 4, 13 5, 13 12";
  const stroke =
    type === "diverge" ? "rgba(var(--diverge-rgb), 0.65)" : "rgba(var(--brand-rgb), 0.45)";
  return (
    <svg
      width="22"
      height="24"
      viewBox="0 0 22 24"
      className="shrink-0 self-center overflow-visible"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        className="tree-path"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
  );
}

interface TurnTreeProps {
  turns: Turn[];
  /** 当前聚焦卡片 + 平行组来源（供"你在这里"高亮与自动滚动） */
  focus: { cardId: string; groupSourceId: string | null } | null;
  onJump(id: string): void;
  onToggleUnread(id: string): void;
  onOpenCard(turnId: string, term: string): void;
}

export function TurnGraph({ turns, focus, onJump, onToggleUnread, onOpenCard }: TurnTreeProps) {
  const rows = useMemo(() => buildRows(turns), [turns]);
  const rootRef = useRef<HTMLDivElement>(null);

  // 入场动画记忆：模块级 Set 跨挂载/跨项目保留已渲染过的行 key。
  // 渲染期只读（幂等、不触发重渲染）；提交后 useEffect 写入——
  // 首次见到某行播放入场（新对话/新发散浮现），A→B→A 切回不再重放（消除逐行闪烁）。
  useEffect(() => {
    for (const r of rows) seenRowKeys.add(r.key);
  }, [rows]);
  const rowAnimClass = (key: string) => (seenRowKeys.has(key) ? "" : "tree-row-in");

  // 当前聚焦卡片变化 → 自动滚动到可见（"地图跟着你走"）。
  useEffect(() => {
    if (!focus) return;
    const el = rootRef.current?.querySelector(`[data-turn-node="${focus.cardId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focus?.cardId]);

  return (
    <div
      ref={rootRef}
      className="w-full animate-[fadeIn_300ms_ease-out] px-2.5 py-2"
      role="tree"
      aria-label="轮次导航图"
    >
      {rows.map((row, rowIdx) =>
        row.turn ? (
          (() => {
            const isFocused = row.turn!.id === focus?.cardId;
            const inGroup =
              !!focus?.groupSourceId &&
              (row.turn!.id === focus.groupSourceId ||
                (row.diverge && row.turn!.divergeSourceId === focus.groupSourceId));
            const isBranchRow = !row.diverge && !!row.turn!.parentTurnId;
            const connector = row.diverge ? (
              <TreeConnector type="diverge" delay={rowIdx * 18} />
            ) : isBranchRow ? (
              <TreeConnector type="branch" delay={rowIdx * 18} />
            ) : row.depth === 0 ? null : (
              <TreeConnector type="card" delay={rowIdx * 18} />
            );
            return (
          <div
            key={row.key}
            data-turn-node={row.turn!.id}
            data-diverge={row.diverge || undefined}
            role="treeitem"
            onClick={() => onJump(row.turn!.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onToggleUnread(row.turn!.id);
            }}
            className={`${rowAnimClass(row.key)} group flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-1.5 transition-colors hover:bg-item-std-hover ${
              isFocused
                ? "tree-focus-bg tree-focus-glow"
                : inGroup
                  ? "tree-group-bg"
                  : row.diverge
                    ? "rounded-r-md bg-diverge/[0.05]"
                    : ""
            }`}
            style={{
              // 统一左缘对齐：曲线连接器承载层级引导，内容按深度缩进。
              paddingLeft: 6 + row.depth * 18,
              animationDelay: `${Math.min(rowIdx * 18, 420)}ms`,
            }}
            title={
              row.diverge
                ? `「${row.turn!.title}」平行会话 · 从「${
                    turns.find((t) => t.id === row.turn!.divergeSourceId)?.title ?? "上游对话"
                  }」发散`
                : isFocused
                  ? "当前所在卡片"
                  : undefined
            }
          >
            {connector}
            {row.diverge ? (
              <Waypoints
                size={13}
                strokeWidth={2.4}
                className="shrink-0 text-diverge"
                aria-label="发散卡片"
              />
            ) : (
              <span
                className={`h-3 w-3 shrink-0 rounded-full border ${
                  row.turn!.favorite ? "border-brand bg-brand" : "border-brand bg-brand/25"
                }`}
              />
            )}
            {row.turn!.parentTurnId && !row.diverge && (
              <ArrowDown size={12} className="shrink-0 text-brand/80" aria-label="分支轮次" />
            )}
            <span
              className={`min-w-0 flex-1 truncate text-[13px] group-hover:text-primary ${
                row.diverge ? "text-diverge" : "text-text-secondary"
              }`}
            >
              {row.diverge ? (
                <>
                  <span>{row.turn.title}</span>
                  <span className="text-text-quaternary">（平行）</span>
                </>
              ) : (
                row.turn.title
              )}
            </span>
            {row.divergeCount ? (
              <span
                className="shrink-0 select-none rounded-full border border-diverge/40 bg-diverge/10 px-1.5 py-px text-[9px] leading-4 text-diverge"
                title={`${row.divergeCount} 个平行会话`}
              >
                ⇄ {row.divergeCount}
              </span>
            ) : null}
            {row.turn.favorite && <Star size={12} className="shrink-0 text-brand" fill="currentColor" />}
            {row.turn.unread && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="未读" />
            )}
          </div>
            );
          })()
        ) : (
          <div
            key={row.key}
            data-card-node={row.card!.term}
            role="treeitem"
            onClick={() => onOpenCard(row.card!.turnId, row.card!.term)}
            className={`${rowAnimClass(row.key)} group flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-1.5 transition-colors hover:bg-item-std-hover`}
            style={{
              paddingLeft: 6 + row.depth * 18,
              animationDelay: `${Math.min(rowIdx * 18, 420)}ms`,
            }}
          >
            <TreeConnector type="card" delay={rowIdx * 18} />
            <CardKindIcon kind={row.card!.kind} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-brand/85">{row.card!.term}</span>
          </div>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 浮层接线（无框架，直接浮在页面背景上）                                 */
/* ------------------------------------------------------------------ */

export function TurnGraphPanel() {
  const { projects, activeProjectId, focusTurn, setTurnUnread, requestCardOpen, treeFocus } =
    useApp();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const turns = activeProject?.turns ?? [];

  if (turns.length === 0) return null;
  return (
    <TurnGraph
      turns={turns}
      focus={treeFocus}
      onJump={(id) => {
        if (activeProjectId) focusTurn(activeProjectId, id);
      }}
      onToggleUnread={(id) => {
        const t = turns.find((x) => x.id === id);
        if (t) setTurnUnread(id, !t.unread);
      }}
      onOpenCard={(turnId, term) => requestCardOpen(turnId, term)}
    />
  );
}
