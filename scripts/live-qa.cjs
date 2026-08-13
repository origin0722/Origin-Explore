/**
 * Live pixel QA — original site vs clone, same viewport, same state.
 * Scene: settings modal (the original opens it by default after init).
 * Usage: node scripts/live-qa.cjs
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch").default;
const EDGE = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shotOriginal(page) {
  await page.goto("https://ai.explore.poker/chat", { waitUntil: "domcontentloaded", timeout: 30000 });
  for (let i = 0; i < 12; i++) {
    await sleep(1500);
    const t = await page.evaluate(() => document.body.innerText.slice(0, 40));
    if (!t.includes("Initializing")) break;
  }
  await sleep(500);
  return "qa-out/live-orig.png";
}

async function shotClone(page) {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("设置"))?.click();
  });
  await sleep(500);
  return "qa-out/live-clone.png";
}

async function diff(aPath, bPath, outPath) {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height} — cropping to ${w}x${h}`);
  }
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, b.data, diff.data, w, h, {
    threshold: 0.12,
    diffColor: [255, 0, 96],
    diffColorAlt: [0, 255, 255],
  });
  fs.writeFileSync(outPath, PNG.sync.write(diff));
  console.log(`diff ${outPath}: ${n}px (${((n / (w * h)) * 100).toFixed(2)}%)`);
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox", "--window-size=1440,900"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await shotOriginal(p);
  await p.screenshot({ path: "qa-out/live-orig.png" });
  await b.close();

  const b2 = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox", "--window-size=1440,900"],
  });
  const p2 = await b2.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await p2.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      localStorage.setItem("explore-onboarded", "1");
    } catch {}
  });
  await shotClone(p2);
  await p2.screenshot({ path: "qa-out/live-clone.png" });
  await b2.close();

  await diff("qa-out/live-orig.png", "qa-out/live-clone.png", "qa-out/live-settings.diff.png");
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
