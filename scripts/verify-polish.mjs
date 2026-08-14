/**
 * Verify: streaming reply, term-card close animation, card-header rename,
 * settings sections trimmed, welcome "?" loads sample.
 * Usage: node scripts/verify-polish.mjs
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

// 1. Welcome: "?" button loads a sample project (title changes to 示例：量子纠缠).
await page.evaluate(() => {
  document.querySelector("button[aria-label='加载示例项目']")?.click();
});
await sleep(600);
const welcomeSample = await page.evaluate(() => document.body.textContent?.includes("示例：量子纠缠"));
log("1. welcome ? loads sample:", welcomeSample);

// 2. Streaming: send a new question and watch the reply grow.
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是梯度下降？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(1400); // after the 1.2s delay, streaming just started
const early = await page.evaluate(() => document.querySelector(".markdown-content")?.textContent?.length ?? 0);
await sleep(1200);
const later = await page.evaluate(() => document.querySelector(".markdown-content")?.textContent?.length ?? 0);
log("2. streaming (early<later):", early < later, `(${early} -> ${later} chars)`);

// 3. Term card close animation still works.
await page.evaluate(() => document.querySelector("button.term-chip")?.click());
await sleep(600);
await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  const closeBtn = [...(card?.querySelectorAll("button") ?? [])].find(
    (b) => (b.title || b.getAttribute("aria-label") || "").includes("关闭")
  );
  closeBtn?.click();
});
await sleep(600);
const cardGone = await page.evaluate(() => !document.querySelector(".card-container"));
log("3. term card closed (with exit anim):", cardGone);

// 4. Card header: menu → rename (real keyboard input).
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.title === "更多操作")?.click();
});
await sleep(200);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "重命名")?.click();
});
await sleep(200);
await page.evaluate(() => {
  const input = [...document.querySelectorAll("input")].find((i) => i.className.includes("ring-brand"));
  input?.focus();
  input?.select();
});
await page.keyboard.type("改名后的项目");
await sleep(200);
await page.keyboard.press("Enter");
await sleep(400);
const renamed = await page.evaluate(() => document.body.textContent?.includes("改名后的项目"));
log("4. card header rename:", renamed);

// 5. Settings: no 编辑权限 / API 密钥 sections.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.title === "设置" || b.textContent?.trim() === "设置");
  btn?.click();
});
await sleep(500);
const settingsText = await page.evaluate(() => document.body.textContent || "");
log("5. no 编辑权限:", !settingsText.includes("编辑权限"));
log("   no API 密钥:", !settingsText.includes("API 密钥"));

await browser.close();
console.log("DONE");
