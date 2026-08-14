"use client";

/**
 * Explore — TurnGraph（轮次导航有向图，透明浮层）
 * 借鉴原站卡片树：轮次 + 术语卡片同图呈现——
 *  - 轮次节点：左侧主干纵排；边 = parentTurnId（分支来源）?? 顺序上一轮；
 *  - 卡片节点：来自 Turn.explored 探索链条——↗️ 子卡片向右分支、
 *    ➡️ 关联卡片向左分支、⬇️ 分支卡片向右；
 *  - 点击轮次节点跳转对话；点击卡片节点重新打开该卡片；右键轮次切换未读。
 */
import { useMemo } from "react";
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

/* ------------------------------------------------------------------ */
/* 图布局                                                               */
/* ------------------------------------------------------------------ */

const ROW_H = 88; // 轮次行距（宽松防重叠）
const TURN_X = 90; // 主干列（归一化前；左侧留 关联卡片 分支位）
const ROOT_DX = 64; // 链条根卡片与主干的距离
const DEEP_DX = 56; // 链条内更深一层的距离
const KIND_EMOJI: Record<string, string> = { child: "↗️", related: "➡️", branch: "⬇️" };

interface GNode {
  id: string;
  kind: "turn" | "card";
  turnId: string;
  term: string;
  label: string;
  x: number;
  y: number;
  unread?: boolean;
  favorite?: boolean;
  /** 卡片节点类型（子/关联/分支），决定分支方向与图标 */
  cardKind?: "child" | "related" | "branch";
}

interface GEdge {
  from: string;
  to: string;
  kind: "turn" | "card";
  /** 从父节点左侧出（关联卡片向左分支） */
  fromLeft?: boolean;
}

function shortLabel(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

interface TurnGraphProps {
  turns: Turn[];
  onJump(id: string): void;
  onToggleUnread(id: string): void;
  onOpenCard(turnId: string, term: string): void;
}

export function TurnGraph({ turns, onJump, onToggleUnread, onOpenCard }: TurnGraphProps) {
  const { nodes, edges, width, height } = useMemo(() => {
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];
    const byId = new Map(turns.map((t) => [t.id, t]));

    // 轮次节点（左侧主干纵排） + 轮次间有向边
    turns.forEach((t, i) => {
      nodes.push({
        id: `t-${t.id}`,
        kind: "turn",
        turnId: t.id,
        term: "",
        label: shortLabel(t.title, 7),
        x: TURN_X,
        y: i * ROW_H + 44,
        unread: t.unread,
        favorite: t.favorite,
      });
      const parent = t.parentTurnId ? byId.get(t.parentTurnId) : undefined;
      const from = parent?.id ?? (i > 0 ? turns[i - 1].id : undefined);
      if (from) edges.push({ from: `t-${from}`, to: `t-${t.id}`, kind: "turn" });
    });

    // 卡片节点：每条探索链条从所属轮次出发，沿 parentTerm 连续分支
    turns.forEach((t, i) => {
      const chains = explorationChains(t.explored ?? []);
      const baseY = i * ROW_H + 44;
      chains.forEach((chain, ci) => {
        const lane = (ci - (chains.length - 1) / 2) * 30;
        const py = baseY + lane;
        let px = TURN_X;
        let parentId = `t-${t.id}`;
        chain.forEach((e, k) => {
          const dir = e.kind === "related" ? -1 : 1; // 关联卡片 → 左侧
          const nx = px + dir * (k === 0 ? ROOT_DX : DEEP_DX);
          const nodeId = `c-${t.id}-${e.term}`;
          nodes.push({
            id: nodeId,
            kind: "card",
            turnId: t.id,
            term: e.term,
            label: shortLabel(e.term, 5),
            x: nx,
            y: py,
            cardKind: e.kind,
          });
          edges.push({
            from: parentId,
            to: nodeId,
            kind: "card",
            fromLeft: dir === -1 && k > 0,
          });
          parentId = nodeId;
          px = nx;
        });
      });
    });

    // 归一化：整体右移使最左节点 x=14；宽 = 跨度 + 标签区
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x));
    const shift = 14 - minX;
    for (const n of nodes) n.x += shift;
    return {
      nodes,
      edges,
      width: Math.max(232, maxX - minX + 150),
      height: Math.max(turns.length * ROW_H + 20, 80),
    };
  }, [turns]);

  const pos = useMemo(() => {
    const m = new Map<string, GNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  return (
    <div className="w-full px-1 py-2">
      <svg width={width} height={height} className="block" role="img" aria-label="轮次导航图">
        <defs>
          <marker
            id="turn-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6.5"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L7,3 L0,6 z" fill="#13e425" opacity="0.8" />
          </marker>
        </defs>

        {/* 有向边：主干垂直连接；卡片分支平滑弧线 */}
        {edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          if (e.kind === "turn") {
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y + 13}
                x2={b.x}
                y2={b.y - 13}
                stroke="#13e425"
                strokeOpacity="0.35"
                strokeWidth="1.5"
                markerEnd="url(#turn-arrow)"
              />
            );
          }
          const dir = b.x >= a.x ? 1 : -1;
          const d = `M ${a.x + dir * 12} ${a.y} C ${a.x + dir * 44} ${a.y}, ${b.x - dir * 44} ${b.y}, ${b.x - dir * 10} ${b.y}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#13e425"
              strokeOpacity="0.45"
              strokeWidth="1.4"
              strokeDasharray={e.fromLeft ? "3 3" : undefined}
              markerEnd="url(#turn-arrow)"
            />
          );
        })}

        {nodes.map((n) => {
          const isTurn = n.kind === "turn";
          const r = isTurn ? 10 : 8;
          return (
            <g
              key={n.id}
              data-turn-node={isTurn ? n.turnId : undefined}
              data-card-node={isTurn ? undefined : n.term}
              transform={`translate(${n.x}, ${n.y})`}
              className="group cursor-pointer"
              onClick={() => (isTurn ? onJump(n.turnId) : onOpenCard(n.turnId, n.term))}
              onContextMenu={
                isTurn
                  ? (e) => {
                      e.preventDefault();
                      onToggleUnread(n.turnId);
                    }
                  : undefined
              }
            >
              {/* 点击热区（轮次整行 / 卡片局部） */}
              <rect
                x={isTurn ? -12 : -10}
                y={isTurn ? -20 : -12}
                width={isTurn ? width - n.x + 12 : 96}
                height={isTurn ? 40 : 24}
                fill="transparent"
              />
              <circle
                r={r}
                fill={isTurn ? "rgba(19,228,37,0.16)" : "rgba(19,228,37,0.07)"}
                stroke="#13e425"
                strokeOpacity={isTurn ? 0.95 : 0.6}
                strokeWidth="1.5"
                className="transition-all duration-150 group-hover:fill-[rgba(19,228,37,0.3)] group-hover:stroke-opacity-100"
              />
              {n.unread && <circle r="3.5" fill="#13e425" aria-label="未读" />}
              {n.cardKind && (
                <text x={-4} y={3} fontSize="7" style={{ userSelect: "none" }}>
                  {KIND_EMOJI[n.cardKind]}
                </text>
              )}
              {/* 文字只在悬停时浮现 */}
              <text
                x={isTurn ? 16 : 13}
                y={isTurn ? 4 : 3.5}
                fontSize={isTurn ? 12 : 10}
                fill={isTurn ? "rgba(226,232,240,0.95)" : "rgba(19,228,37,0.95)"}
                className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                style={{ userSelect: "none" }}
              >
                {n.favorite ? "⭐ " : ""}
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
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
