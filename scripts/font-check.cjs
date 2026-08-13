/**
 * Chat empty-state big-title probe — verify Bruno Ace is actually loaded on
 * the clone and measure the rendered glyph bbox (green-channel pixels).
 * Usage: node scripts/font-check.cjs
 */
const puppeteer = require("puppeteer-core");
const { PNG } = require("pngjs");
const fs = require("fs");
const EDGE = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      localStorage.setItem("explore-onboarded", "1");
    } catch {}
  });
  await p.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  await p.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  const info = await p.evaluate(() => {
    const h1 = document.querySelector("h1");
    const cs = h1 ? getComputedStyle(h1) : null;
    const r = h1 ? h1.getBoundingClientRect() : null;
    return {
      h1Font: cs ? cs.fontFamily : null,
      h1Size: cs ? cs.fontSize : null,
      h1Weight: cs ? cs.fontWeight : null,
      h1Text: h1 ? h1.textContent : null,
      rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
      hasBruno: [...document.fonts].some((f) => /Bruno/i.test(f.family) && f.status === "loaded"),
      fonts: [...document.fonts].map((f) => f.family + " " + f.status).slice(0, 20),
    };
  });
  const buf = await p.screenshot({ fullPage: false, encoding: "binary" });
  await b.close();
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data: d } = png;
  const rx = info.rect ? Math.max(0, Math.floor(info.rect.x) - 40) : 0;
  const ry = info.rect ? Math.max(0, Math.floor(info.rect.y) - 40) : 0;
  const rxe = info.rect ? Math.min(w, Math.ceil(info.rect.x + info.rect.w) + 40) : w;
  const rye = info.rect ? Math.min(h, Math.ceil(info.rect.y + info.rect.h) + 40) : h;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0;
  // pure-green strokes only (excludes glow gradient) — matches the original
  // measurement: strokes rgb(19,228,37) with green glow around them
  for (let y = ry; y < rye; y++) {
    for (let x = rx; x < rxe; x++) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], bl = d[i + 2];
      if (g > 190 && r < 50 && bl < 90) {
        n++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(JSON.stringify({ ...info, glyphBBox: n ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, px: n } : null }, null, 1));
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
