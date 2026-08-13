/**
 * Clone settings-modal DOM probe — measure modal panel geometry on localhost.
 * Expected (original 71.25% × 71.3% rule at 1440x900): x=207, y=129, 1026x642.
 * Usage: node scripts/clone-modal-probe.cjs
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
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox", "--window-size=1440,900"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      localStorage.setItem("explore-onboarded", "1");
    } catch {}
  });
  await p.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  await p.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("设置"))?.click();
  });
  await sleep(600);
  const out = await p.evaluate(() => {
    const vp = { innerW: window.innerWidth, innerH: window.innerHeight };
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        bg: cs.backgroundColor, radius: cs.borderRadius, border: cs.borderWidth + " " + cs.borderColor,
      };
    };
    const overlay = [...document.querySelectorAll("*")].find(
      (el) => getComputedStyle(el).position === "fixed" && el.innerText.startsWith("设置")
    );
    const panel = overlay
      ? [...overlay.querySelectorAll("*")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 600 && r.width < 1400 && r.height > 400 && r.height < 900;
          })
          .map((el) => ({ cls: (el.className || "").toString().slice(0, 70), ...rect(el) }))
      : null;
    const overlayBg = overlay ? getComputedStyle(overlay).backgroundColor : null;
    // Header height: panel top → first scrollable body area.
    const headerH = panel && panel[0] ? (() => {
      const panelEl = [...overlay.querySelectorAll("*")].find(
        (el) => { const r = el.getBoundingClientRect(); return r.width === panel[0].w && r.height === panel[0].h && el !== overlay; }
      );
      if (!panelEl) return null;
      const scroll = [...panelEl.querySelectorAll("*")].find(
        (el) => getComputedStyle(el).overflowY === "auto" || getComputedStyle(el).overflowY === "scroll"
      );
      const r = scroll ? scroll.getBoundingClientRect() : null;
      return r ? { top: Math.round(r.y), left: Math.round(r.x) } : null;
    })() : null;
    return JSON.stringify({ vp, overlayBg, panel, headerH }, null, 1);
  });
  console.log(out);
  await b.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
