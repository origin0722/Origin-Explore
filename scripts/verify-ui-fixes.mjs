/**
 * Verify: nav-rail toggle closes, Mindscape FAB toggles, subscription UI removed.
 * Usage: node scripts/verify-ui-fixes.mjs
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

// 0. Subscription UI removed
const bodyText = await page.evaluate(() => document.body.textContent || "");
log("0. no 云端项目:", !bodyText.includes("云端项目"));
log("   no 仅会员:", !bodyText.includes("仅会员"));

// 1. Create project + send message, then nav rail toggle open/close.
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是量子纠缠？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(2500);

// open nav
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "轮次导航")?.click();
});
await sleep(300);
const navOpened = await page.evaluate(() => document.body.textContent?.includes("轮次导航"));
log("1a. nav opened:", navOpened);
// close nav (click the same toggle again — it must still be clickable)
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "收起轮次导航")?.click();
});
await sleep(300);
const navClosed = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "轮次导航");
  return !!btn; // toggle back to "轮次导航" label means it closed
});
log("1b. nav closed (toggle label restored):", navClosed);

// 2. Mindscape FAB toggles.
const fabLabel = await page.evaluate(() => document.querySelector("button[aria-label='打开思维宇宙']")?.getAttribute("aria-label"));
log("2a. FAB initial label:", fabLabel);
await page.evaluate(() => document.querySelector("button[aria-label='打开思维宇宙']")?.click());
await sleep(400);
const opened = await page.evaluate(() => !!document.querySelector("button[aria-label='关闭思维宇宙']"));
log("2b. Mindscape opened (FAB label now 关闭):", opened);
await page.evaluate(() => document.querySelector("button[aria-label='关闭思维宇宙']")?.click());
await sleep(400);
const closed = await page.evaluate(() => !!document.querySelector("button[aria-label='打开思维宇宙']"));
log("2c. Mindscape closed (FAB label back to 打开):", closed);

// 3. Model dropdown has no tier badges.
await page.evaluate(() => {
  const m = document.querySelector("textarea");
  m?.focus();
});
await sleep(200);
// open model selector: click the model pill (first button in the input row)
await page.evaluate(() => {
  const pill = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "listbox");
  pill?.click();
});
await sleep(300);
const dropdownText = await page.evaluate(() => document.querySelector("[role='listbox']")?.textContent || "");
log("3. no tier badges in dropdown (免费/Pro/Max):", !/(免费|Pro|Max)/.test(dropdownText));

await browser.close();
console.log("DONE");
