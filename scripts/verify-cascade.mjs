/**
 * Verify the centered cascade term-card layout:
 * - card is centered on the canvas;
 * - each child layer is offset down-right (cascade) with the parent's top
 *   edge still peeking out;
 * - close still works; layers are opaque (no text overlap).
 * Usage: node scripts/verify-cascade.mjs
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

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

// Open layer 0
await page.evaluate(() => document.querySelector("button.term-chip")?.click());
await sleep(700);
const l0 = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  const r = card.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), center: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] };
});
log("layer0 rect:", JSON.stringify(l0), "| centered at x=720:", Math.abs(l0.center[0] - 720) <= 3);

// Click a child term → layer 1 (cascade offset)
await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  [...(card?.querySelectorAll("button.term-chip") ?? [])][0]?.click();
});
await sleep(700);
const stack = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".card-container")];
  return cards.map((c) => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      bg: cs.backgroundColor,
      z: cs.zIndex,
      transform: cs.transform.slice(0, 60),
    };
  });
});
log("stack layers:", JSON.stringify(stack, null, 2));
const n = stack.length;
const cascadeOk =
  n === 2 &&
  stack[1].y > stack[0].y && // child pushed down
  stack[1].x >= stack[0].x && // and right
  stack[1].bg === "rgb(60, 60, 60)";
log("cascade down-right + opaque:", cascadeOk);

// Close pops one layer at a time: top card first (1 remains), then the rest.
await page.evaluate(() => {
  const top = [...document.querySelectorAll(".card-container")].at(-1);
  [...(top?.querySelectorAll("button") ?? [])].find((b) => (b.title || b.getAttribute("aria-label") || "").includes("关闭"))?.click();
});
await sleep(500);
const afterOne = await page.evaluate(() => document.querySelectorAll(".card-container").length);
await page.evaluate(() => {
  const top = [...document.querySelectorAll(".card-container")].at(-1);
  [...(top?.querySelectorAll("button") ?? [])].find((b) => (b.title || b.getAttribute("aria-label") || "").includes("关闭"))?.click();
});
await sleep(500);
const afterTwo = await page.evaluate(() => document.querySelectorAll(".card-container").length);
log("close pops one layer (1 left, then 0):", afterOne === 1 && afterTwo === 0);

await browser.close();
console.log("DONE");
