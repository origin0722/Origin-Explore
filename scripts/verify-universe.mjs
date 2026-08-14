/**
 * Verify Mind Universe 3D real-relation edges + chain display:
 * 1) seed 3 validated thought nodes (A root green, B child-of-A blue,
 *    C unrelated orange root);
 * 2) open the universe → canvas renders with the right node count;
 * 3) read the WebGL framebuffer in-page: locate the three node blobs
 *    (A top, B middle, C bottom on the Fibonacci sphere), then sample
 *    line-colored pixels along node-pair paths — only A–B may connect;
 * 4) click node B at its real screen position → detail overlay shows the
 *    connection chain A → B (and NOT the unrelated node C).
 * Usage: node scripts/verify-universe.mjs
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(...m);

const now = Date.now();
const seed = {
  thoughtNodes: [
    { id: "n-a", subject: "叠加态", content: "量子系统可以同时处于多个经典状态的叠加，直到被测量才坍缩。", createdAt: now - 3000, category: "主题", status: "validated" },
    { id: "n-b", subject: "量子比特", content: "量子计算的基本单位，对应经典比特，可处于叠加态。", createdAt: now - 2000, category: "概念", status: "validated", parentSubject: "叠加态" },
    { id: "n-c", subject: "梯度下降", content: "机器学习中沿负梯度方向迭代优化的核心算法。", createdAt: now - 1000, category: "疑问", status: "validated" },
  ],
};

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--window-size=1440,900"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument((seedStr) => {
  try {
    localStorage.clear();
    localStorage.setItem("explore-onboarded", "1");
    localStorage.setItem("explore-state-v1", seedStr);
  } catch {}
}, JSON.stringify(seed));
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(700);

// open mindscape panel → enter the 3D universe
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === "打开思维宇宙" && !b.closest("aside, [class*='panel']")
  );
  btn?.click();
});
await sleep(400);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("进入 3D 宇宙"))?.click();
});
await sleep(2500); // let entrance animations finish

// 1. canvas + node count
const scene = await page.evaluate(() => ({
  hasCanvas: !!document.querySelector("canvas"),
  countText: document.body.textContent?.includes("3 个节点") ?? false,
}));
log("1. canvas rendered:", scene.hasCanvas, "| node count text:", scene.countText);

// 2. framebuffer analysis: blobs, ring hues, relation-line sampling
const analyze = () =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const gw = canvas.width, gh = canvas.height;
    const buf = new Uint8Array(gw * gh * 4);
    gl.readPixels(0, 0, gw, gh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const r = canvas.getBoundingClientRect();
    const px = (x, y) => {
      if (x < 0 || y < 0 || x >= gw || y >= gh) return [0, 0, 0];
      const i = (y * gw + x) * 4;
      return [buf[i], buf[i + 1], buf[i + 2]];
    };
    const toCss = (x, y) => ({ x: Math.round(r.left + (x * r.width) / gw), y: Math.round(r.top + ((gh - 1 - y) * r.height) / gh) });

    // bright cores (emissive + point light blow the sphere center out to white)
    const cores = [];
    for (let y = 0; y < gh; y += 2) {
      for (let x = 0; x < gw; x += 2) {
        const [pr, pg, pb] = px(x, y);
        if (pr + pg + pb >= 350) cores.push([x, y]);
      }
    }
    const clusters = [];
    for (const [x, y] of cores) {
      let c = clusters.find((c) => Math.hypot(c.sx / c.n - x, c.sy / c.n - y) < 45);
      if (!c) { c = { sx: 0, sy: 0, n: 0 }; clusters.push(c); }
      c.sx += x; c.sy += y; c.n++;
    }
    const blobs = clusters
      .map((c) => ({ gx: Math.round(c.sx / c.n), gy: Math.round(c.sy / c.n), n: c.n }))
      .filter((b) => b.n >= 2)
      .sort((a, b) => b.gy - a.gy); // top of screen first (gl y grows upward)

    const hue = (x, y) => {
      const [pr, pg, pb] = px(x, y);
      if (pg > 90 && pg > pr * 1.5 && pg > pb * 1.5) return "G";
      if (pb > 90 && pb > pr * 1.3 && pb > pg * 1.05) return "B";
      if (pr > 150 && pg > 90 && pb < 110) return "O";
      return null;
    };
    // ring classification for sanity (top blob should be green-ringed, middle blue)
    for (const b of blobs) {
      const counts = { G: 0, B: 0, O: 0 };
      for (let a = 0; a < 360; a += 8) {
        const rad = (a * Math.PI) / 180;
        for (const R of [28, 36, 44]) {
          const h = hue(Math.round(b.gx + R * Math.cos(rad)), Math.round(b.gy + R * Math.sin(rad)));
          if (h) counts[h]++;
        }
      }
      b.ring = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "?";
    }

    // Fibonacci sphere layout: A top, B middle (equator), C bottom
    const byPos = (k) => blobs[k];
    const A = byPos(0), B = byPos(1), C = byPos(2);

    // dim green relation-line pixels (#13e425 at 0.3 opacity over dark bg)
    const isLine = (x, y) => {
      const [pr, pg, pb] = px(x, y);
      return pg > 40 && pg < 140 && pr < 70 && pb < 70 && pg > pr * 1.4 && pg > pb * 1.4;
    };
    const lineHits = (a, b) => {
      if (!a || !b) return -1;
      const steps = (Math.abs(b.gx - a.gx) + Math.abs(b.gy - a.gy)) * 2;
      let hits = 0;
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(a.gx + ((b.gx - a.gx) * s) / steps);
        const y = Math.round(a.gy + ((b.gy - a.gy) * s) / steps);
        // skip the glow zones near both endpoints
        if (Math.hypot(x - a.gx, y - a.gy) < 34 || Math.hypot(x - b.gx, y - b.gy) < 34) continue;
        if (isLine(x, y)) hits++;
      }
      return hits;
    };

    return {
      blobs: blobs.map((b) => ({ ...toCss(b.gx, b.gy), ring: b.ring, n: b.n })),
      ab: lineHits(A, B),
      ac: lineHits(A, C),
      bc: lineHits(B, C),
      click: B ? toCss(B.gx, B.gy) : null,
    };
  });

const res = await analyze();
log("2. node blobs (css px, ring hue):", JSON.stringify(res.blobs));
log("   line-pixel hits along A–B / A–C / B–C:", res.ab, "/", res.ac, "/", res.bc);
log("   PASS three nodes found:", res.blobs.length === 3);
log("   PASS only A–B has a relation line:", res.ab > 0 && res.ac === 0 && res.bc === 0);

// 3. click node B at its actual center → overlay chain A → B
let overlay = null;
for (let attempt = 0; attempt < 3 && !(overlay && overlay.includes("量子比特") && overlay.includes("叠加态")); attempt++) {
  if (attempt > 0) {
    await sleep(300);
    res.click = (await analyze()).click;
  }
  if (!res.click) break;
  await page.mouse.click(res.click.x, res.click.y);
  await sleep(900);
  overlay = await page.evaluate(() => {
    const els = [...document.querySelectorAll("div")].filter((d) => (d.textContent ?? "").includes("连接链"));
    if (!els.length) return null;
    els.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
    return els[0].textContent;
  });
  log(`   attempt ${attempt + 1} click at (${res.click.x},${res.click.y}) → overlay:`, JSON.stringify(overlay?.slice(0, 40) ?? null));
}
log("3. overlay chain:", JSON.stringify(overlay));
log("   PASS chain shows 叠加态 → 量子比特:", !!overlay && overlay.includes("叠加态") && overlay.includes("量子比特") && overlay.includes("连接链"));
log("   PASS unrelated node excluded:", !!overlay && !overlay.includes("梯度下降"));

// 4. console errors (should be none)
log("4. page errors:", errs.length === 0 ? "none" : JSON.stringify(errs));

await browser.close();
console.log("DONE");
