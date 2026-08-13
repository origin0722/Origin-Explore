/**
 * Live original-site DOM probe v2 — force device metrics via CDP (setViewport
 * was ignored by Edge headless: page rendered at 1600x1000) and measure the
 * settings modal panel rect + overlay + all visible text nodes' bounding boxes.
 * Usage: node scripts/live-dom-probe.cjs
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
  const cdp = await p.createCDPSession();
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await p.goto("https://ai.explore.poker/chat", { waitUntil: "domcontentloaded", timeout: 30000 });
  for (let i = 0; i < 12; i++) {
    await sleep(1500);
    const t = await p.evaluate(() => document.body.innerText.slice(0, 40));
    if (!t.includes("Initializing")) break;
  }
  await sleep(800);
  const out = await p.evaluate(() => {
    const vp = { innerW: window.innerWidth, innerH: window.innerHeight };
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    // Overlays first (z-50 settings overlay is the top one among settings).
    const overlays = [...document.querySelectorAll("*")]
      .filter((el) => getComputedStyle(el).position === "fixed" && el.innerText.includes("Settings"))
      .map((el) => ({ cls: (el.className || "").toString().slice(0, 60), ...rect(el) }));
    // The settings modal panel: direct child of the topmost settings overlay.
    // Find the settings overlay element, then its panel descendant (all
    // elements 600-1400 wide × 400-900 tall inside it).
    const overlayEl = [...document.querySelectorAll("*")].find(
      (el) => getComputedStyle(el).position === "fixed" && el.innerText.startsWith("Settings")
    );
    let panel = null;
    if (overlayEl) {
      panel = [...overlayEl.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 600 && r.width < 1400 && r.height > 400 && r.height < 900;
        })
        .map((el) => ({
          cls: (el.className || "").toString().slice(0, 70),
          ...rect(el),
          bg: getComputedStyle(el).backgroundColor,
          radius: getComputedStyle(el).borderRadius,
        }));
    }
    return JSON.stringify({ vp, overlayCount: overlays.length, overlays, panel }, null, 1);
  });
  console.log(out);
  await b.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
