/**
 * Live original-site interaction probe — close the settings modal, create a
 * new project, then dump the main-area DOM to see what an empty chat shows.
 * Usage: node scripts/live-chat-probe.cjs
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
  await p.goto("https://ai.explore.poker/chat", { waitUntil: "domcontentloaded", timeout: 30000 });
  for (let i = 0; i < 12; i++) {
    await sleep(1500);
    const t = await p.evaluate(() => document.body.innerText.slice(0, 40));
    if (!t.includes("Initializing")) break;
  }
  await sleep(800);
  // Close any open modals: find visible close buttons / overlay clicks.
  const actions = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")]
      .filter((bt) => bt.getBoundingClientRect().width > 0 && bt.offsetParent !== null)
      .map((bt) => ({ text: (bt.innerText || bt.getAttribute("aria-label") || "").slice(0, 30), x: Math.round(bt.getBoundingClientRect().x + bt.getBoundingClientRect().width / 2), y: Math.round(bt.getBoundingClientRect().y + bt.getBoundingClientRect().height / 2) }));
    return btns.slice(0, 25);
  });
  console.log("VISIBLE BUTTONS:", JSON.stringify(actions, null, 1));
  await b.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
