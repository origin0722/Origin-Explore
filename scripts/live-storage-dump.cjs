/**
 * Live original-site state dump — read localStorage keys/values so we can
 * later inject a profile that skips all onboarding modals.
 * Usage: node scripts/live-storage-dump.cjs
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
  await sleep(1000);
  const out = await p.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      keys.push({ k, v: localStorage.getItem(k) || "" });
    }
    return keys;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
