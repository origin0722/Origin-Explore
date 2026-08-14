/**
 * Verify the term card: send a message, click a term, check the card's
 * position (should be fully in-viewport with its header visible) and that the
 * close button actually dismisses it.
 * Usage: node scripts/verify-term-card.mjs
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
await page.type("textarea", "什么是量子纠缠？");
await page.keyboard.down("Control");
await page.keyboard.press("Enter");
await page.keyboard.up("Control");
await sleep(2500);

const termInfo = await page.evaluate(() => {
  const chip = document.querySelector("button.term-chip");
  if (!chip) return null;
  const r = chip.getBoundingClientRect();
  chip.click();
  return { text: chip.textContent?.trim(), x: r.x, y: r.y };
});
console.log("clicked term:", JSON.stringify(termInfo));
await sleep(600);

const cardInfo = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  if (!card) return null;
  const r = card.getBoundingClientRect();
  const closeBtn = [...card.querySelectorAll("button")].find(
    (b) => (b.title || b.getAttribute("aria-label") || "").includes("关闭")
  );
  const cr = closeBtn ? closeBtn.getBoundingClientRect() : null;
  return {
    card: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    closeBtn: cr ? { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) } : null,
    headerVisible: r.y >= 0 && r.y < 200,
  };
});
console.log("card info:", JSON.stringify(cardInfo, null, 2));

const closed = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  if (!card) return "no-card";
  const closeBtn = [...card.querySelectorAll("button")].find(
    (b) => (b.title || b.getAttribute("aria-label") || "").includes("关闭")
  );
  if (!closeBtn) return "no-close-btn";
  closeBtn.click();
  return "clicked";
});
console.log("close action:", closed);
await sleep(500);
const afterClose = await page.evaluate(() => !!document.querySelector(".card-container"));
console.log("card still present after close:", afterClose);

await browser.close();
console.log("DONE");
