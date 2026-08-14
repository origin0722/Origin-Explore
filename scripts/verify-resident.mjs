/**
 * Verify the resident chat: clickable row → opens the pinned conversation,
 * messages persist across project switches, not listed as a normal project,
 * and the delete action is hidden/blocked.
 * Usage: node scripts/verify-resident.mjs
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

// 1. Resident row is clickable → opens resident chat
await page.evaluate(() => {
  [...document.querySelectorAll("[role='button']")].find((b) => b.textContent?.includes("常驻聊天"))?.click();
});
await sleep(500);
const headerTitle = await page.evaluate(() => document.querySelector(".rounded-\\[24px\\] span.font-bold")?.textContent);
log("1. resident chat opened (header = 常驻聊天):", headerTitle === "常驻聊天", `(${headerTitle})`);

// 2. Send a message in the resident chat
await page.type("textarea", "记一下：今天要读 Transformer 论文");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
const sent = await page.evaluate(() => document.body.textContent?.includes("记一下：今天要读 Transformer 论文"));
log("2. message sent in resident chat:", sent);

// 3. Switch to a normal project and back — resident message persists
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(500);
await page.evaluate(() => {
  [...document.querySelectorAll("[role='button']")].find((b) => b.textContent?.includes("常驻聊天"))?.click();
});
await sleep(500);
const persisted = await page.evaluate(() => document.body.textContent?.includes("记一下：今天要读 Transformer 论文"));
log("3. resident message persists after switching:", persisted);

// 4. Resident NOT listed as a normal project. The sidebar auto-collapses after
// sending, so expand it first, then count: "常驻聊天" should appear exactly
// once (the resident row itself — no duplicate project row).
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.title === "收起侧边栏")?.click();
});
await sleep(400);
const residentCount = await page.evaluate(() => {
  const text = document.querySelector("aside")?.textContent ?? "";
  return (text.match(/常驻聊天/g) || []).length;
});
log("4. resident occurrences =", residentCount, "(expected 1):", residentCount === 1);

// 5. Card menu hides 删除 for the resident chat
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.title === "更多操作")?.click();
});
await sleep(300);
const hasDelete = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "删除"));
log("5. 删除 hidden for resident chat:", !hasDelete);

await browser.close();
console.log("DONE");
