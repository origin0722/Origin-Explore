/**
 * GET /api/search?q=... — 联网搜索服务端代理（个人工具无后端；浏览器直连外部搜索
 * 源有 CORS 限制，统一走本路由）。主源 Bing 网页搜索 RSS（国内可访问、结构稳定），
 * 回退 DuckDuckGo HTML。失败返回空数组（前端静默降级，不阻塞主流程）。
 */
export const dynamic = "force-dynamic"; // 实时搜索：不做静态预渲染/缓存

const TIMEOUT_MS = 8000;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** XML/HTML 解码：CDATA 剥离 → 标签剥离 → 实体解码 → 空白归一 */
function decodeHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Bing 网页搜索 RSS（主源）：<item> 块内 title/link/description。 */
async function searchBing(q: string): Promise<SearchResult[]> {
  const xml = await fetchText(
    `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss&setlang=zh-hans`
  );
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const out: SearchResult[] = [];
  for (const it of items) {
    const title = decodeHtml(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = decodeHtml(it.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const snippet = decodeHtml(it.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
    if (title && url) {
      out.push({ title: title.slice(0, 120), url, snippet: snippet.slice(0, 300) });
    }
    if (out.length >= 6) break;
  }
  return out;
}

/** DuckDuckGo HTML（回退源）：.result 块内 result__a / result__snippet。 */
async function searchDuckDuckGo(q: string): Promise<SearchResult[]> {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
  const blocks = html.split(/<div[^>]*class="[^"]*result[^"]*"[^>]*>/g).slice(1);
  const out: SearchResult[] = [];
  for (const b of blocks) {
    const a = b.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let url = decodeHtml(a[1]);
    // DDG 重定向 URL（/l/?uddg=...）解出真实地址
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try {
        url = decodeURIComponent(uddg[1]);
      } catch {
        /* 保留原始重定向地址 */
      }
    }
    const title = decodeHtml(a[2]);
    const snip = decodeHtml(b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
    if (title && url) {
      out.push({ title: title.slice(0, 120), url, snippet: snip.slice(0, 300) });
    }
    if (out.length >= 6) break;
  }
  return out;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (!q) return Response.json({ results: [] });
  try {
    let results = await searchBing(q);
    if (results.length === 0) results = await searchDuckDuckGo(q);
    return Response.json({ results });
  } catch {
    try {
      return Response.json({ results: await searchDuckDuckGo(q) });
    } catch {
      return Response.json({ results: [] });
    }
  }
}
