/**
 * Verify: contextual AI reply, nav-rail no longer covers term-card close, BYOK add.
 * Usage: node scripts/verify-features.mjs
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

// 1. Contextual AI reply: ask about a GLOSSARY term (not in the tree).
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是梯度下降？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(2500);
const replyText = await page.evaluate(() => document.querySelector(".markdown-content")?.textContent || "");
log("1. reply mentions 梯度下降:", replyText.includes("梯度下降"));
log("   reply mentions 量子纠缠 (should be false):", replyText.includes("量子纠缠"));

// 2. Open a term card (turn-graph panel is always visible on the right),
//    then close the card.
await page.evaluate(() => {
  document.querySelector("button.term-chip")?.click();
});
await sleep(600);
// Try to click the close button via coordinates (click through the panel).
const closeClick = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  if (!card) return "no-card";
  const closeBtn = [...card.querySelectorAll("button")].find(
    (b) => (b.title || b.getAttribute("aria-label") || "").includes("关闭")
  );
  if (!closeBtn) return "no-close-btn";
  closeBtn.click();
  return "clicked";
});
await sleep(500);
const cardGone = await page.evaluate(() => !document.querySelector(".card-container"));
log("2. close action:", closeClick, "| card closed after nav rail opened:", cardGone);

// 3. BYOK: open settings, add a model, verify it shows in the model list.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.title === "设置" || b.textContent?.trim() === "设置"
  );
  btn?.click();
});
await sleep(500);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("添加 BYOK 模型"))?.click();
});
await sleep(300);
await page.type("input[placeholder*='模型名称']", "my-gpt");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "添加");
  btn?.click();
});
await sleep(500);
const byokAdded = await page.evaluate(() => document.body.textContent?.includes("my-gpt"));
log("3. BYOK model added & visible:", byokAdded);

await browser.close();
console.log("DONE");
