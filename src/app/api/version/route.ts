/**
 * GET /api/version — 版本更新检查（服务端代理 GitHub Releases，避免客户端 CORS/限流）。
 * 返回 { current, latest, hasUpdate, releaseUrl, publishedAt }。
 * latest 为空（仓库尚无 Release）时 hasUpdate=false。
 */
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic"; // 每次请求实时查（服务端短缓存兜底）

const GITHUB_API = "https://api.github.com/repos/origin0722/Origin-Explore/releases/latest";
const RELEASES_URL = "https://github.com/origin0722/Origin-Explore/releases";

/** 简易 semver 比较（去 v 前缀；仅比较数字段）。a > b → 1，a < b → -1，相等 → 0 */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export async function GET() {
  const current = pkg.version;
  let latest: string | null = null;
  let releaseUrl: string | null = null;
  let publishedAt: string | null = null;

  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        "User-Agent": "origin-explore-version-check",
        Accept: "application/vnd.github+json",
      },
      // 短缓存：5 分钟内不重复打 GitHub（服务端共享缓存）
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        tag_name?: string;
        html_url?: string;
        published_at?: string;
      };
      if (data.tag_name) {
        latest = data.tag_name;
        releaseUrl = data.html_url ?? RELEASES_URL;
        publishedAt = data.published_at ?? null;
      }
    } else if (res.status === 404) {
      // 尚无 Release
      latest = null;
    }
  } catch {
    // GitHub 不可达：latest 保持 null（视为无更新，不阻塞）
  }

  const hasUpdate = latest != null && compareVersions(latest, current) > 0;

  return Response.json({
    current,
    latest,
    hasUpdate,
    releaseUrl: releaseUrl ?? (latest ? RELEASES_URL : null),
    publishedAt,
  });
}
