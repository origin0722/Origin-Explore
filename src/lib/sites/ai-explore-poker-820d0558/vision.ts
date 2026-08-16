/**
 * Explore — 视觉模式核心模块（Vision Mode）
 * 借鉴 dsh-vision-router「主模型当大脑、独立视觉模型当眼睛」：
 * - 原生：主模型多模态 → OpenAI image_url parts 直传
 * - 路由：主模型纯文本 + 视觉模型 → 先识图转结构化描述再注入提示词
 * 核心机制：画布双档降采样（thumb 持久化 / full 仅内存）、SHA-256 内容哈希缓存（同图不重复识别）、
 * 历史旧图降级为文字描述（控制请求体量）。
 */
import type { AttachedImage, ByokModel } from "@/types/sites/ai-explore-poker-820d0558";

/** 缩略图最大边长（持久化，控制 localStorage 配额） */
const THUMB_MAX = 512;
const THUMB_QUALITY = 0.75;
/** 发送用降采样最大边长（仅内存，落盘前剥离） */
const FULL_MAX = 1280;
const FULL_QUALITY = 0.8;
/** 单张源文件上限 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** 单条消息图片上限 */
export const MAX_IMAGES_PER_MESSAGE = 4;
/** 视觉缓存 localStorage key */
const CACHE_KEY = "explore-vision-cache-v1";
/** 缓存 LRU 上限 */
const CACHE_MAX = 50;

interface VisionCacheEntry {
  desc: string;
  model: string;
  at: number;
}

/* ------------------------------------------------------------------ */
/* SHA-256 哈希（crypto.subtle；localhost/127.0.0.1 属安全上下文可用） */
/* ------------------------------------------------------------------ */
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* 画布降采样                                                          */
/* ------------------------------------------------------------------ */
function downscale(dataUrl: string, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 不可用"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = dataUrl;
  });
}

/* ------------------------------------------------------------------ */
/* 文件 → AttachedImage                                                */
/* ------------------------------------------------------------------ */
export async function fileToAttachedImage(file: File): Promise<AttachedImage> {
  const raw = await file.arrayBuffer();
  const hash = await sha256Hex(raw);
  const mime = file.type || "image/jpeg";
  // Blob → data URL（原图用于降采样）
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
  // 先取原图尺寸
  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = originalDataUrl;
  });
  const [fullDataUrl, thumbDataUrl] = await Promise.all([
    downscale(originalDataUrl, FULL_MAX, FULL_QUALITY),
    downscale(originalDataUrl, THUMB_MAX, THUMB_QUALITY),
  ]);
  return {
    id: "img-" + Math.random().toString(36).slice(2, 10),
    name: file.name || "image",
    mime,
    thumbDataUrl,
    fullDataUrl,
    width: dims.width,
    height: dims.height,
    hash,
  };
}

/* ------------------------------------------------------------------ */
/* 视觉缓存（hash → 描述，LRU 50）                                     */
/* ------------------------------------------------------------------ */
function readCache(): Map<string, VisionCacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, VisionCacheEntry>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function writeCache(map: Map<string, VisionCacheEntry>) {
  try {
    const obj = Object.fromEntries(map.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* 配额满静默（缓存可重建） */
  }
}

export function getVisionCache(hash: string): VisionCacheEntry | null {
  const map = readCache();
  const entry = map.get(hash);
  if (!entry) return null;
  // LRU：命中即移到末尾
  map.delete(hash);
  map.set(hash, entry);
  return entry;
}

export function setVisionCache(hash: string, desc: string, model: string) {
  const map = readCache();
  map.delete(hash);
  map.set(hash, { desc, model, at: Date.now() });
  // LRU 淘汰最旧
  while (map.size > CACHE_MAX) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  writeCache(map);
}

/* ------------------------------------------------------------------ */
/* 视觉模型识图：结构化中文描述（主体/场景/文字转录/布局/颜色）          */
/* ------------------------------------------------------------------ */
const DESCRIBE_PROMPT =
  "请仔细观察这张图片，输出一段结构化中文描述，包含：1) 主体内容；2) 场景/背景；" +
  "3) 图中可见的文字（如有，逐字转录）；4) 布局与主要元素位置；5) 颜色风格。" +
  "直接输出描述，不要开场白。";

export async function describeImage(
  byok: ByokModel,
  image: AttachedImage,
  signal?: AbortSignal
): Promise<string> {
  const cached = getVisionCache(image.hash);
  if (cached) return cached.desc;

  const url = byok.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const body = {
    model: byok.modelId,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: DESCRIBE_PROMPT },
          { type: "image_url", image_url: { url: image.fullDataUrl || image.thumbDataUrl } },
        ],
      },
    ],
    stream: false,
  };

  const attempt = async (): Promise<string> => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${byok.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("空响应");
    return text.trim();
  };

  let desc: string;
  try {
    desc = await attempt();
  } catch (e) {
    // 失败重试 1 次
    if (signal?.aborted) throw e;
    desc = await attempt();
  }
  setVisionCache(image.hash, desc, byok.modelId);
  return desc;
}

/* ------------------------------------------------------------------ */
/* 组装 wire parts / 描述文本                                          */
/* ------------------------------------------------------------------ */
export type WireContent = string | { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** 原生模式：图片 → OpenAI 多模态 content parts（无图时原样返回文本） */
export function toNativeParts(
  text: string,
  images: AttachedImage[]
): string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: img.fullDataUrl || img.thumbDataUrl },
    })),
  ];
}

/** 路由模式：图片 → 描述文本块（附在用户文本前） */
export function toRouterText(text: string, descriptions: string[]): string {
  if (descriptions.length === 0) return text;
  const blocks = descriptions.map((d, i) => `[图片 ${i + 1} 描述]\n${d}`);
  return `${blocks.join("\n\n")}\n\n${text}`;
}

/* ------------------------------------------------------------------ */
/* 视觉决策：按主模型能力 / visionMode / 视觉模型配置判定               */
/* ------------------------------------------------------------------ */
export type VisionDecision = "native" | "router" | "blocked";

export function decideVision(
  opts: {
    mainVision: boolean;
    visionMode: ChatSettingsLike["visionMode"];
    hasVisionModel: boolean;
  }
): VisionDecision {
  const { mainVision, visionMode, hasVisionModel } = opts;
  if (visionMode === "off") return "blocked";
  if (visionMode === "native") return mainVision ? "native" : "blocked";
  if (visionMode === "router") return hasVisionModel ? "router" : "blocked";
  // auto：主模型多模态 → 原生；否则有视觉模型 → 路由；都没有 → 拦截
  if (mainVision) return "native";
  return hasVisionModel ? "router" : "blocked";
}

/** ChatSettings 子集（避免循环依赖：只取判定所需字段） */
interface ChatSettingsLike {
  visionMode: "auto" | "native" | "router" | "off";
}
