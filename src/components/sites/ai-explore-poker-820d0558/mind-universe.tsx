"use client";

/**
 * Explore — MindUniverse 全屏 3D 思维宇宙 (site: ai.explore.poker/chat clone)
 * Fullscreen three.js scene: validated thought nodes on a Fibonacci sphere,
 * constellation links, particle background and an auto-rotating camera.
 * Click a node → detail overlay (bottom-right); click empty space → dismiss.
 * Rendered by shell: {universeOpen && <MindUniverse onClose={...} />}.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { X } from "lucide-react";
import type { ThoughtNode } from "@/types/sites/ai-explore-poker-820d0558";
import { useApp } from "./app-context";

const RADIUS = 2.6;

/** 从当前主题（<html data-theme>）解析品牌色；SSR 时回退黑绿。 */
function brandColor(): string {
  if (typeof document === "undefined") return "#13e425";
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() ||
    "#13e425"
  );
}

/** Brand colors per node category ("主题"/默认随主题品牌色). */
function categoryColor(category: string, brand: string): string {
  if (category === "主题") return brand;
  if (category === "概念") return "#4d9fff";
  if (category === "疑问") return "#ffb84d";
  return brand;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

/** Deterministic Fibonacci-sphere layout (no randomness). */
function fibPositions(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.39996; // golden angle
    pts.push(
      new THREE.Vector3(
        r * Math.cos(theta) * RADIUS,
        y * RADIUS,
        r * Math.sin(theta) * RADIUS
      )
    );
  }
  return pts;
}

/**
 * Real relation edges only: each node connects to the node whose subject
 * equals its parentSubject (深挖来源). Nearest-neighbor "constellation"
 * links are gone — a line now always means a genuine parent-child
 * relationship, so the graph never implies a link that isn't there.
 * If the parent isn't among the visible nodes, no edge is drawn.
 */
function buildRelationEdges(nodes: ThoughtNode[]): Array<[number, number]> {
  const index = new Map<string, number>();
  nodes.forEach((n, i) => {
    if (!index.has(n.subject)) index.set(n.subject, i); // first occurrence wins
  });
  const edges: Array<[number, number]> = [];
  nodes.forEach((n, i) => {
    if (!n.parentSubject) return;
    const p = index.get(n.parentSubject);
    if (p !== undefined && p !== i) edges.push([p, i]);
  });
  return edges;
}

/** Ancestor chain (root → … → node) resolved via parentSubject; cycle-safe. */
function ancestorChain(node: ThoughtNode, nodes: ThoughtNode[]): ThoughtNode[] {
  const bySubject = new Map(nodes.map((n) => [n.subject, n]));
  const chain: ThoughtNode[] = [];
  const seen = new Set<string>();
  let cur: ThoughtNode | undefined = node;
  while (cur && !seen.has(cur.subject)) {
    seen.add(cur.subject);
    chain.unshift(cur);
    cur = cur.parentSubject ? bySubject.get(cur.parentSubject) : undefined;
  }
  return chain;
}

/**
 * Constellation links between nodes (single LineBasicMaterial).
 * Built imperatively because the `<line>` JSX intrinsic collides with the
 * SVG line element type under fiber v9; `<primitive>` avoids the clash.
 */
function ConstellationLines({
  positions,
  edges,
  color,
}: {
  positions: THREE.Vector3[];
  edges: Array<[number, number]>;
  color: string;
}) {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (const [a, b] of edges) {
      pts.push(positions[a], positions[b]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
    });
    return new THREE.Line(geometry, material);
  }, [positions, edges, color]);

  // Created manually — dispose with the component.
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );

  return <primitive object={line} />;
}

/** Particle background: 800 random dots, slowly rotating. */
function PointStars() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 800;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return arr;
  }, []);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#ffffff" transparent opacity={0.35} />
    </points>
  );
}

let glowTexture: THREE.CanvasTexture | null = null;

/** Procedural radial-gradient glow sprite texture (created once, client-side). */
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.25, "rgba(255, 255, 255, 0.5)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

interface NodeSphereProps {
  node: ThoughtNode;
  position: THREE.Vector3;
  color: string;
  delay: number;
  onSelect: (node: ThoughtNode) => void;
}

/** One node: glowing sphere + halo sprite, staggered 0→1 entrance scale. */
function NodeSphere({ node, position, color, delay, onSelect }: NodeSphereProps) {
  const groupRef = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = (clock.elapsedTime - t0.current) * 1000 - delay;
    const k = Math.min(Math.max(t / 800, 0), 1);
    const s = 1 - Math.pow(1 - k, 3); // ease-out cubic
    g.scale.setScalar(s);
  });
  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
    >
      <mesh>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
      <sprite scale={[0.55, 0.55, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

function NodeGroup({
  nodes,
  onSelect,
  brand,
}: {
  nodes: ThoughtNode[];
  onSelect: (node: ThoughtNode) => void;
  brand: string;
}) {
  const positions = useMemo(() => fibPositions(nodes.length), [nodes]);
  const edges = useMemo(() => buildRelationEdges(nodes), [nodes]);
  return (
    <group>
      <ConstellationLines positions={positions} edges={edges} color={brand} />
      {nodes.map((n, i) => (
        <NodeSphere
          key={n.id}
          node={n}
          position={positions[i]}
          color={categoryColor(n.category, brand)}
          delay={i * 120}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

interface Gesture {
  downX: number;
  downY: number;
  moved: number;
}

/**
 * Invisible giant sphere catching "empty space" clicks (deselect).
 * Movement is tracked at the container div (capture phase), so camera drags
 * never deselect — only genuine clicks (moved < 8px) do.
 */
function BackdropDeselect({
  gestureRef,
  onDeselect,
}: {
  gestureRef: RefObject<Gesture>;
  onDeselect: () => void;
}) {
  return (
    <mesh
      position={[0, 0, 0]}
      onClick={() => {
        if (gestureRef.current && gestureRef.current.moved < 8) onDeselect();
      }}
    >
      <sphereGeometry args={[50, 16, 16]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function MindUniverse({ onClose }: { onClose: () => void }) {
  const { thoughtNodes, removeThoughtNode } = useApp();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<ThoughtNode | null>(null);
  const gestureRef = useRef<Gesture>({ downX: 0, downY: 0, moved: 0 });
  const brand = useMemo(() => brandColor(), []);

  // SSR safety: Canvas must not render during server render.
  useEffect(() => {
    setMounted(true);
  }, []);

  const validated = useMemo(
    () => thoughtNodes.filter((n) => n.status === "validated"),
    [thoughtNodes]
  );

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-[#05080a]"
      onPointerDownCapture={(e) => {
        gestureRef.current = { downX: e.clientX, downY: e.clientY, moved: 0 };
      }}
      onPointerMoveCapture={(e) => {
        const g = gestureRef.current;
        g.moved = Math.max(g.moved, Math.hypot(e.clientX - g.downX, e.clientY - g.downY));
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 2.2, 7], fov: 55 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#05080a"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[4, 6, 4]} intensity={30} color={brand} />
        <PointStars />
        {validated.length > 0 && <NodeGroup nodes={validated} onSelect={setSelected} brand={brand} />}
        <BackdropDeselect gestureRef={gestureRef} onDeselect={() => setSelected(null)} />
        <OrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.6}
          minDistance={3}
          maxDistance={16}
        />
      </Canvas>

      {/* Top-left: title + node count */}
      <div className="pointer-events-none fixed left-6 top-5 z-[90]">
        <h2 className="text-lg font-bold text-white">思维宇宙</h2>
        <p className="mt-0.5 text-xs text-white/50">{validated.length} 个节点</p>
      </div>

      {/* Top-right: close */}
      <button
        type="button"
        aria-label="关闭思维宇宙"
        onClick={onClose}
        className="fixed right-6 top-5 z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={18} />
      </button>

      {/* Empty scene */}
      {validated.length === 0 && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
          <p className="text-sm text-white/40">
            思维宇宙还是空的 —— 去对话里收录你的理解吧
          </p>
        </div>
      )}

      {/* Selected node detail (bottom-right) */}
      {selected && (() => {
        const chain = ancestorChain(selected, validated);
        return (
        <div className="fixed bottom-6 right-6 z-[90] w-[320px] max-w-[calc(100vw-3rem)] rounded-2xl border border-brand/30 bg-[#101614]/90 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-white break-words">
              {selected.subject}
            </h3>
            <button
              type="button"
              aria-label="关闭详情"
              onClick={() => setSelected(null)}
              className="shrink-0 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/70 line-clamp-6">
            {selected.content}
          </p>

          {/* 连接链：真实深挖关系（root → … → 本节点），可沿链跳转 */}
          {chain.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-white/10 pt-2">
              <span className="mr-1 shrink-0 text-[10px] text-white/35">连接链</span>
              {chain.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 && <span className="text-[11px] text-white/25">→</span>}
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className={`max-w-[120px] truncate rounded px-1 py-0.5 text-[11px] transition-colors ${
                      c.id === selected.id
                        ? "text-brand font-semibold"
                        : "text-brand/70 hover:text-brand hover:underline"
                    }`}
                  >
                    {c.subject}
                  </button>
                </Fragment>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <time className="text-xs text-white/40">{formatTime(selected.createdAt)}</time>
            <button
              type="button"
              onClick={() => {
                removeThoughtNode(selected.id);
                setSelected(null);
              }}
              className="text-xs text-red-400 transition-colors hover:text-red-300 hover:underline"
            >
              删除
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
