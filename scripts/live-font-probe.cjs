/**
 * Live original-site big-title probe v2 — close modals layer by layer
 * (confirm → sync-conflict → login → settings), then measure the green
 * glyph bbox of the empty-chat big title.
 * Usage: node scripts/live-font-probe.cjs
 */
const puppeteer = require("puppeteer-core");
const { PNG } = require("pngjs");
const fs = require("fs");
const EDGE = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto("https://ai.explore.poker/chat", { waitUntil: "domcontentloaded", timeout: 45000 });
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const t = await p.evaluate(() => document.body.innerText.slice(0, 60));
    if (!/initializing/i.test(t)) break;
  }
  await sleep(1500);

  const dumpBtns = () =>
    p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((bt) => bt.getBoundingClientRect().width > 0 && bt.offsetParent !== null)
        .map((bt) => ({
          t: (bt.innerText || bt.getAttribute("aria-label") || "").replace(/\s+/g, " ").slice(0, 28),
          y: Math.round(bt.getBoundingClientRect().y),
        }))
        .sort((a, b) => a.y - b.y)
    );

  // click by exact text, lowest-y first (deepest layer), repeat up to N times
  const clickTexts = async (texts) => {
    for (const t of texts) {
      for (let k = 0; k < 5; k++) {
        const hit = await p.evaluate((label) => {
          const cands = [...document.querySelectorAll("button")].filter(
            (bt) => bt.getBoundingClientRect().width > 0 && bt.offsetParent !== null
          );
          const el = cands.find((bt) => (bt.innerText || "").trim() === label);
          if (!el) return false;
          el.click();
          return true;
        }, t);
        await sleep(700);
        if (!hit) break;
      }
    }
  };

  // pass 1: cancel the confirm + sync-conflict layers (cancel first, deepest)
  await clickTexts(["Cancel", "Cancel"]);
  console.log("AFTER CANCELS:", JSON.stringify(await dumpBtns(), null, 1));

  // pass 2: close login modal via its X, then settings via Save/X
  for (let k = 0; k < 6; k++) {
    const acted = await p.evaluate(() => {
      const cands = [...document.querySelectorAll("button")].filter(
        (bt) => bt.getBoundingClientRect().width > 0 && bt.offsetParent !== null
      );
      // preference order: close/X buttons on modals, then Save, then Restore & Close
      const closeBtn = cands.find((bt) =>
        /✕|×|close/i.test((bt.getAttribute("aria-label") || "") + " " + (bt.innerText || ""))
      );
      const saveBtn = cands.find((bt) => (bt.innerText || "").trim() === "Save");
      const restoreBtn = cands.find((bt) => (bt.innerText || "").trim() === "Restore & Close");
      const target = closeBtn || restoreBtn || saveBtn;
      if (!target) return "none";
      const label = (target.innerText || target.getAttribute("aria-label") || "").trim().slice(0, 20);
      target.click();
      return "clicked:" + label;
    });
    await sleep(800);
    if (acted === "none") break;
  }
  console.log("AFTER CLOSES:", JSON.stringify(await dumpBtns(), null, 1));

  const buf = await p.screenshot({ encoding: "binary" });
  await b.close();
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data: d } = png;
  console.log("SHOT:", w + "x" + h);
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0;
  const rows = [];
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], bl = d[i + 2];
      if (g > 60 && g - r > 25 && g - bl > 15) {
        n++;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (count > 2) rows.push({ y, count });
  }
  console.log(
    "GREEN-BBOX:",
    n ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, px: n, cx: Math.round((minX + maxX) / 2), cy: Math.round((minY + maxY) / 2) } : null
  );
  console.log("ROWS(y,count):", rows.map((r) => r.y + ":" + r.count).join(" "));
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
