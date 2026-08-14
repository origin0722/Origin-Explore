"use client";

/**
 * Explore — TurnGraph（轮次导航有向图）
 * 每个项目里的对话在右侧导航图中呈现为有向图：
 *  - 行 = 轮次时间序；列 = 分支深度（父链长度）；
 *  - 边 = parentTurnId（分支来源）?? 顺序上一轮 → 有向箭头；
 *  - 点击节点跳转到对应轮次；右键切换已读/未读；绿点 = 未读，⭐ = 已收藏。
 */
import { useMemo } from "react";
import type { Turn } from "@/types/sites/ai-explore-poker-820d0558";

interface TurnGraphProps {
  turns: Turn[];
  onJump(id: string): void;
  onToggleUnread(id: string): void;
}

const ROW_H = 58;
const X_BASE = 36;
const X_STEP = 56;

export function TurnGraph({ turns, onJump, onToggleUnread }: TurnGraphProps) {
  const { nodes, edges, height, width } = useMemo(() => {
    const byId = new Map(turns.map((t) => [t.id, t]));
    const depthCache = new Map<string, number>();
    const getDepth = (t: Turn): number => {
      const hit = depthCache.get(t.id);
      if (hit !== undefined) return hit;
      const parent = t.parentTurnId ? byId.get(t.parentTurnId) : undefined;
      const d = parent ? getDepth(parent) + 1 : 0;
      depthCache.set(t.id, d);
      return d;
    };
    turns.forEach(getDepth);

    const nodes = turns.map((t, i) => ({ turn: t, i, d: getDepth(t) }));
    const edges = turns
      .map((t, i) => {
        const parent = t.parentTurnId ? byId.get(t.parentTurnId) : undefined;
        const from = parent?.id ?? (i > 0 ? turns[i - 1].id : undefined);
        return from ? { from, to: t.id } : null;
      })
      .filter((e): e is { from: string; to: string } => e !== null);

    const maxDepth = nodes.reduce((m, n) => Math.max(m, n.d), 0);
    return {
      nodes,
      edges,
      height: Math.max(nodes.length * ROW_H + 16, 60),
      width: Math.max(230, X_BASE + maxDepth * X_STEP + 170),
    };
  }, [turns]);

  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      m.set(n.turn.id, { x: X_BASE + n.d * X_STEP, y: n.i * ROW_H + 28 });
    }
    return m;
  }, [nodes]);

  const shortTitle = (t: string) => (t.length > 10 ? t.slice(0, 10) + "…" : t);

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

        {/* 有向边：分支 → 曲线，顺序 → 近直线 */}
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
              strokeOpacity="0.55"
              strokeWidth="1.5"
              markerEnd="url(#turn-arrow)"
            />
          );
        })}

        {nodes.map((n) => {
          const p = pos.get(n.turn.id)!;
          const label = shortTitle(n.turn.title);
          return (
            <g
              key={n.turn.id}
              data-turn-node={n.turn.id}
              transform={`translate(${p.x}, ${p.y})`}
              className="cursor-pointer transition-opacity hover:opacity-75"
              onClick={() => onJump(n.turn.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onToggleUnread(n.turn.id);
              }}
            >
              {/* 透明点击热区 */}
              <rect x={-14} y={-ROW_H / 2 + 6} width={width - p.x + 14} height={ROW_H - 12} fill="transparent" />
              <circle r="9" fill="rgba(19,228,37,0.12)" stroke="#13e425" strokeWidth="1.5" />
              {n.turn.unread && <circle r="3.5" fill="#13e425" aria-label="未读" />}
              <text
                x={17}
                y={4}
                fontSize="12"
                fill="rgba(226,232,240,0.85)"
                style={{ userSelect: "none" }}
              >
                {label}
              </text>
              {n.turn.favorite && (
                <text x={17 + label.length * 12 + 6} y={5} fontSize="11" style={{ userSelect: "none" }}>
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
