"use client";

/**
 * Explore — TurnGraph（轮次导航有向图，右侧常驻面板）
 * 借鉴原站卡片树：轮次 + 术语卡片同图呈现——
 *  - 轮次节点：按时间纵排；边 = parentTurnId（分支来源）?? 顺序上一轮；
 *  - 卡片节点：来自 Turn.explored 探索路径——↗️ 子卡片向右分支、
 *    ➡️ 关联卡片向左分支、⬇️ 分支卡片向右（指向其另起炉灶的轮次）；
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

const ROW_H = 62;
const TURN_X = 0; // 轮次列（归一化前）
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
  from: string; // node id
  to: string;
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

    // 轮次节点（纵排） + 轮次间有向边
    turns.forEach((t, i) => {
      nodes.push({
        id: `t-${t.id}`,
        kind: "turn",
        turnId: t.id,
        term: "",
        label: shortLabel(t.title, 8),
        x: TURN_X,
        y: i * ROW_H + 28,
        unread: t.unread,
        favorite: t.favorite,
      });
      const parent = t.parentTurnId ? byId.get(t.parentTurnId) : undefined;
      const from = parent?.id ?? (i > 0 ? turns[i - 1].id : undefined);
      if (from) edges.push({ from: `t-${from}`, to: `t-${t.id}` });
    });

    // 卡片节点：每个轮次的探索链条 — 子卡片向右、关联卡片向左、分支向右
    turns.forEach((t, i) => {
      const chains = explorationChains(t.explored ?? []);
      const baseY = i * ROW_H + 28;
      chains.forEach((chain, ci) => {
        const lane = (ci - (chains.length - 1) / 2) * 24;
        let px = TURN_X;
        const py = baseY + lane;
        chain.forEach((e, k) => {
          const dir = e.kind === "related" ? -1 : 1; // 关联卡片 → 左侧
          const nx = px + dir * (k === 0 ? 60 : 54);
          const nodeId = `c-${t.id}-${e.term}`;
          nodes.push({
            id: nodeId,
            kind: "card",
            turnId: t.id,
            term: e.term,
            label: shortLabel(e.term, 6),
            x: nx,
            y: py,
            cardKind: e.kind,
          });
          edges.push({ from: k === 0 ? `t-${t.id}` : nodes[nodes.length - 2].id, to: nodeId });
          px = nx;
        });
      });
    });

    // 归一化：整体右移使最左节点 x=14，宽 = 跨度 + 标签区
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x));
    const shift = 14 - minX;
    for (const n of nodes) n.x += shift;
    return {
      nodes,
      edges,
      width: Math.max(240, maxX - minX + 170),
      height: Math.max(turns.length * ROW_H + 14, 60),
    };
  }, [turns]);

  const pos = useMemo(() => {
    const m = new Map<string, GNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  return (
    <div className="w-full overflow-x-auto overflow-y-auto nav-scroll px-2 py-2">
      <svg width={width} height={height} className="block mx-auto" role="img" aria-label="轮次导航图">
        <defs>
          <marker
            id="turn-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L7,3 L0,6 z" fill="#13e425" opacity="0.75" />
          </marker>
        </defs>

        {/* 有向边 */}
        {edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const d = `M ${a.x + 11} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 11} ${b.y}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#13e425"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              markerEnd="url(#turn-arrow)"
            />
          );
        })}

        {nodes.map((n) => {
          const isTurn = n.kind === "turn";
          const r = isTurn ? 10 : 7;
          return (
            <g
              key={n.id}
              data-turn-node={isTurn ? n.turnId : undefined}
              data-card-node={isTurn ? undefined : n.term}
              transform={`translate(${n.x}, ${n.y})`}
              className="cursor-pointer transition-opacity hover:opacity-70"
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
              <rect
                x={-16}
                y={-ROW_H / 2 + 6}
                width={width - n.x + 16}
                height={ROW_H - 12}
                fill="transparent"
              />
              <circle
                r={r}
                fill={isTurn ? "rgba(19,228,37,0.14)" : "rgba(19,228,37,0.08)"}
                stroke="#13e425"
                strokeOpacity={isTurn ? 1 : 0.7}
                strokeWidth="1.5"
              />
              {n.unread && <circle r="3.5" fill="#13e425" aria-label="未读" />}
              {n.cardKind && (
                <text x={-4.5} y={3.5} fontSize="8" style={{ userSelect: "none" }}>
                  {KIND_EMOJI[n.cardKind]}
                </text>
              )}
              <text
                x={isTurn ? 16 : 12}
                y={isTurn ? 4 : 3.5}
                fontSize={isTurn ? 12 : 10}
                fill={isTurn ? "rgba(226,232,240,0.9)" : "rgba(19,228,37,0.85)"}
                style={{ userSelect: "none" }}
              >
                {n.label}
              </text>
              {n.favorite && (
                <text x={16 + n.label.length * 12 + 6} y={5} fontSize="11" style={{ userSelect: "none" }}>
                  ⭐
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 右侧常驻面板                                                          */
/* ------------------------------------------------------------------ */

export function TurnGraphPanel() {
  const { projects, activeProjectId, activeDocId, focusTurn, setTurnUnread, requestCardOpen } =
    useApp();
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const turns = activeProject?.turns ?? [];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-4 py-3 border-b border-divider shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-text-tertiary">轮次导航图</span>
        </div>
        <span className="mt-1 block text-[10px] leading-4 text-text-quaternary">
          有向图 · 点击跳转 · 右键切换未读
          <br />
          ↗️ 子卡片 · ➡️ 关联卡片 · ⬇️ 分支
        </span>
      </div>
      {activeDocId != null ? (
        <p className="flex-1 flex items-center justify-center px-4 text-center text-[11px] leading-5 text-text-quaternary">
          文档阅读模式
          <br />
          回到对话查看轮次导航图
        </p>
      ) : turns.length === 0 ? (
        <p className="flex-1 flex items-center justify-center px-4 text-center text-[11px] leading-5 text-text-quaternary">
          发起对话后，这里会展示轮次与术语卡片的有向图。
        </p>
      ) : (
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
      )}
    </div>
  );
}
