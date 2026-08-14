/**
 * Verify the pop-one close behavior: with a 2-layer cascade,
 * closing the top card leaves the parent card; closing again clears all.
 * Also confirms the back arrow is gone from the card header.
 * Usage: node scripts/verify-popclose.mjs
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

// open layer 0
await page.evaluate(() => document.querySelector("button.term-chip")?.click());
await sleep(700);
// open layer 1 (child)
await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  [...(card?.querySelectorAll("button.term-chip") ?? [])][0]?.click();
});
await sleep(700);

// no back arrow anywhere
const hasBack = await page.evaluate(() => {
  return [...document.querySelectorAll("button")].some((b) => (b.title || "").includes("返回上一层"));
});
log("1. back arrow removed:", !hasBack);

// close the TOP card (layer 1) → only layer 0 remains
await page.evaluate(() => {
  const top = [...document.querySelectorAll(".card-container")].at(-1);
  [...(top?.querySelectorAll("button") ?? [])].find((b) => b.title === "关闭")?.click();
});
await sleep(500);
const afterFirst = await page.evaluate(() => document.querySelectorAll(".card-container").length);
log("2. after closing top card, layers remain:", afterFirst, "(expected 1)");

// close the remaining card → 0 layers
await page.evaluate(() => {
  const top = [...document.querySelectorAll(".card-container")].at(-1);
  [...(top?.querySelectorAll("button") ?? [])].find((b) => b.title === "关闭")?.click();
});
await sleep(500);
const afterSecond = await page.evaluate(() => document.querySelectorAll(".card-container").length);
log("3. after closing parent card, layers remain:", afterSecond, "(expected 0)");

await browser.close();
console.log("DONE");
