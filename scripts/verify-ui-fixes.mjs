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
const orderOk = bodyText.indexOf("常驻聊天") >= 0 && bodyText.indexOf("本地文档") > bodyText.indexOf("常驻聊天");
log("   sidebar order 常驻聊天 above 本地文档:", orderOk);

// 1. Create project + send message → the turn-graph panel is always visible on the right.
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是量子纠缠？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(2500);

const graph = await page.evaluate(() => ({
  nodes: document.querySelectorAll("[data-turn-node]").length,
}));
log("1a. turn-graph visible without any toggle:", graph.nodes === 1);
const legacyToggle = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((b) => (b.getAttribute("aria-label") ?? "").includes("收起轮次导航"))
);
log("1b. no legacy rail toggle button:", !legacyToggle);

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
