/**
 * Live original-site big-title DOM probe v2 — clear all modals with real
 * mouse clicks / Escape, create a NEW project, then dump the big title's
 * computed style + rect.
 * Usage: node scripts/live-title-probe.cjs
 */
const puppeteer = require("puppeteer-core");
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
  await sleep(1200);

  const btns = () =>
    p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((bt) => {
          const r = bt.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((bt) => {
          const r = bt.getBoundingClientRect();
          return {
            t: (bt.innerText || bt.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 30),
            x: Math.round(r.x + r.width / 2),
            y: Math.round(r.y + r.height / 2),
          };
        })
    );

  // Pass 1: Escape keys to dismiss whatever closes via Esc
  for (let k = 0; k < 6; k++) {
    await p.keyboard.press("Escape");
    await sleep(600);
  }
  console.log("P1 (after Esc):", JSON.stringify(await btns(), null, 1));

  // Pass 2: real-mouse-click dismiss candidates top-to-bottom, a few rounds
  for (let round = 0; round < 8; round++) {
    const list = await btns();
    // prefer: Cancel / Restore & Close / Save / close glyphs — pick the LAST
    // (lowest on screen) matching one first (deepest overlay is topmost? no —
    // topmost overlay is painted LAST; its buttons are usually at the bottom
    // of the viewport stack). Try bottom-most dismiss-ish button.
    const dismiss = [...list].reverse().find((bt) =>
      /cancel|close|✕|×|dismiss|restore & close|save|confirm/i.test(bt.t)
    );
    if (!dismiss) break;
    await p.mouse.click(dismiss.x, dismiss.y);
    await sleep(800);
  }
  console.log("P2 (after mouse closes):", JSON.stringify(await btns(), null, 1));

  // Pass 3: look for the new-project control in the sidebar (left 225px)
  const sidebar = await p.evaluate(() => {
    const cands = [...document.querySelectorAll("button")].filter((bt) => {
      const r = bt.getBoundingClientRect();
      return r.x < 240 && r.width > 0;
    });
    return cands.map((bt) => ({
      t: (bt.innerText || bt.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 30),
      x: Math.round(bt.getBoundingClientRect().x + bt.getBoundingClientRect().width / 2),
      y: Math.round(bt.getBoundingClientRect().y + bt.getBoundingClientRect().height / 2),
    }));
  });
  console.log("P3 (sidebar buttons):", JSON.stringify(sidebar, null, 1));
  const newBtn = [...sidebar].find((bt) => /new|新建|create/i.test(bt.t));
  if (newBtn) {
    await p.mouse.click(newBtn.x, newBtn.y);
    await sleep(1500);
    console.log("P3b (after new-project):", JSON.stringify(await btns(), null, 1));
  }

  // Final: dump big-font elements anywhere
  const big = await p.evaluate(() => {
    const out = [];
    const walk = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const fs = parseFloat(cs.fontSize);
      if (fs >= 40 && r.width > 0 && r.height > 0 && el.textContent.trim()) {
        out.push({
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 40),
          font: cs.fontFamily.split(",")[0].trim(),
          size: fs,
          weight: cs.fontWeight,
          ls: cs.letterSpacing,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          color: cs.color,
          bgImg: cs.backgroundImage !== "none",
        });
      }
      for (const c of el.children) walk(c);
    };
    walk(document.body);
    return out;
  });
  console.log("BIG TEXTS (" + big.length + "):");
  console.log(JSON.stringify(big, null, 1));
  await b.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
