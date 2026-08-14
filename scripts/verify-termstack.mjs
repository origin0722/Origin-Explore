/**
 * Verify the term-card stack fix: each layer must have an opaque background so
 * child cards cover parent cards (no text overlap). Also measures that the
 * card's content area is uniform (parent text no longer shows through).
 * Usage: node scripts/verify-termstack.mjs
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(...m);

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--disable-gpu", "--no-sandbox", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  try { localStorage.clear(); localStorage.setItem("explore-onboarded", "1"); } catch {}
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(700);

await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是叠加态？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);

// Open the first term card (layer 0) — 叠加态 has children in TERM_TREE
await page.evaluate(() => document.querySelector("button.term-chip")?.click());
await sleep(600);

// Click a child term inside the card (layer 1)
const childClicked = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  const chip = [...(card?.querySelectorAll("button.term-chip") ?? [])][0];
  chip?.click();
  return chip?.textContent?.trim() ?? null;
});
log("child term clicked:", childClicked);

// R8 续之后卡片是页面居中级联：平铺的 .card-container 兄弟节点（--cx/--cy 逐层偏移）。
const layers = await page.evaluate(() => {
  return [...document.querySelectorAll(".card-container")].map((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      cx: el.style.getPropertyValue("--cx"),
      cy: el.style.getPropertyValue("--cy"),
    };
  });
});
log("layers:", JSON.stringify(layers, null, 2));
const topOpaque = layers.length >= 2 && layers.at(-1).bg === "rgb(60, 60, 60)";
const cascadeOffset =
  layers.length >= 2 && layers.at(-1).cx === "8px" && layers.at(-1).cy === "16px";
log("top layer opaque (covers parent):", topOpaque);
log("top layer cascades +8/+16px:", cascadeOffset);

// Screenshot & measure: the card's content area should be uniform in its
// lower half (parent text hidden behind the child's opaque background).
await page.screenshot({ path: "qa-out/termstack-check.png" });
const png = PNG.sync.read(readFileSync("qa-out/termstack-check.png"));
// Card spans x=514..1207, y=52..830 (from earlier measurement)
let textPx = 0;
for (let y = 400; y < 800; y++) {
  for (let x = 520; x < 1200; x++) {
    const i = (y * png.width + x) * 4;
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    // non-background (bg-card-floating #3c3c3c) pixels = content/text
    if (Math.abs(r - 60) + Math.abs(g - 60) + Math.abs(b - 60) > 60) textPx++;
  }
}
log("text pixels in card lower region (y400-800):", textPx, "(informational)");

await browser.close();
console.log("DONE");
