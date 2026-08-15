"use client";

/**
 * Explore — TurnTree（轮次导航卡片树，透明浮层）
 * 借鉴原站卡片树：树状列表常显标题，缩进 + 引导线表达关系——
 *  - 根行 = 轮次（○ 节点 + 标题 + ⭐ 收藏 + 未读绿点），按时间纵排；
 *  - 发散卡片轮次（kind="diverge"）紧跟在来源轮次之后、**同一层级**，横向右移一档
 *    （🪢 虚线引导），即"位于来源卡片右侧"；
 *  - 分支轮次（parentTurnId）嵌套在来源轮次之下，⬇️ 前缀；
 *  - 术语卡片按探索链条缩进挂在所属轮次下（↗️ 子 / ➡️ 关联 / ⬇️ 分支图标）；
 *  - 点击轮次跳转、点击卡片重开卡片、右键轮次切换未读。
 */
import { useMemo } from "react";
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

/** 轮次探索路径的一条记录。 */
export type ExploreEntry = { term: string; kind: TermKindLike; at: number; parentTerm: string | null };
type TermKindLike = "child" | "related" | "branch";

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

/** 卡片类型图标（子 ↗ / 关联 → / 分支 ↓） */
const KIND_ICON: Record<TermKindLike, LucideIcon> = {
  child: ArrowUpRight,
  related: ArrowRight,
  branch: ArrowDown,
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
  const pushTurn = (t: Turn, depth: number) => {
    rows.push({ key: `t-${t.id}`, depth, turn: t });
    // 发散卡片：与来源卡片同一层级，紧跟其后、横向右移一档。
    for (const d of diverges.get(t.id) ?? []) {
      rows.push({ key: `d-${d.id}`, depth, turn: d, diverge: true });
    }
    for (const chain of explorationChains(t.explored ?? [])) {
      chain.forEach((e, k) => {
        rows.push({
          key: `c-${t.id}-${e.term}`,
          depth: depth + 1 + k,
          card: { term: e.term, kind: e.kind, turnId: t.id },
        });
      });
    }
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

interface TurnTreeProps {
  turns: Turn[];
  onJump(id: string): void;
  onToggleUnread(id: string): void;
  onOpenCard(turnId: string, term: string): void;
}

export function TurnGraph({ turns, onJump, onToggleUnread, onOpenCard }: TurnTreeProps) {
  const rows = useMemo(() => buildRows(turns), [turns]);

  return (
    <div className="w-full animate-[fadeIn_300ms_ease-out] px-2.5 py-2" role="tree" aria-label="轮次导航图">
      {rows.map((row) =>
        row.turn ? (
          <div
            key={row.key}
            data-turn-node={row.turn.id}
            data-diverge={row.diverge || undefined}
            role="treeitem"
            onClick={() => onJump(row.turn!.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onToggleUnread(row.turn!.id);
            }}
            className="group flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-1.5 transition-colors hover:bg-item-std-hover"
            style={{
              paddingLeft: row.diverge ? 10 + row.depth * 18 + 22 : 10 + row.depth * 18,
              borderLeft: row.diverge
                ? "1px dashed rgba(186,142,255,0.45)"
                : row.depth
                  ? "1px solid rgba(var(--brand-rgb), 0.18)"
                  : undefined,
              marginLeft: row.diverge ? 16 : row.depth ? 10 : 0,
            }}
            title={row.diverge ? "发散卡片：来源卡片的平行会话（不影响原对话）" : undefined}
          >
            {row.diverge ? (
              <Waypoints
                size={13}
                strokeWidth={2.4}
                className="shrink-0 text-[#ba8eff]"
                aria-label="发散卡片"
              />
            ) : (
              <span
                className={`h-3 w-3 shrink-0 rounded-full border ${
                  row.turn.favorite ? "border-brand bg-brand" : "border-brand bg-brand/25"
                }`}
              />
            )}
            {row.turn.parentTurnId && (
              <ArrowDown size={12} className="shrink-0 text-brand/80" aria-label="分支轮次" />
            )}
            <span
              className={`min-w-0 flex-1 truncate text-[13px] group-hover:text-primary ${
                row.diverge ? "text-[#ba8eff]" : "text-text-secondary"
              }`}
            >
              {row.turn.title}
            </span>
            {row.turn.favorite && <Star size={12} className="shrink-0 text-brand" fill="currentColor" />}
            {row.turn.unread && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="未读" />
            )}
          </div>
        ) : (
          <div
            key={row.key}
            data-card-node={row.card!.term}
            role="treeitem"
            onClick={() => onOpenCard(row.card!.turnId, row.card!.term)}
            className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-1.5 transition-colors hover:bg-item-std-hover"
            style={{
              paddingLeft: 10 + row.depth * 18,
              borderLeft: "1px solid rgba(var(--brand-rgb), 0.18)",
              marginLeft: 10,
            }}
          >
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
  const { projects, activeProjectId, focusTurn, setTurnUnread, requestCardOpen } = useApp();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const turns = activeProject?.turns ?? [];

  if (turns.length === 0) return null;
  return (
    <TurnGraph
      turns={turns}
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
