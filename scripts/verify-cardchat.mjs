/**
 * Verify the in-card conversation:
 * 1) model selector shows 离线知识库 (+ BYOK models);
 * 2) click a term → card opens with an input bar;
 * 3) ask inside the card → reply streams INTO the card;
 * 4) click a bold term in the card reply → child card opens (drill-down).
 * Usage: node scripts/verify-cardchat.mjs
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

// 1. Model selector shows 离线知识库
await page.evaluate(() => {
  const pill = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "listbox");
  pill?.click();
});
await sleep(300);
const selectorText = await page.evaluate(() => document.querySelector("[role='listbox']")?.textContent || "");
log("1. selector has 离线知识库:", selectorText.includes("离线知识库"));
await page.keyboard.press("Escape");
await sleep(200);

// 2. Ask a question → click a term → card opens with an input
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是机器学习？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("神经网络"));
  chip?.click();
});
await sleep(700);
const cardInfo = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  const hasInput = !!card?.querySelector("textarea");
  const header = card?.textContent?.slice(0, 30);
  return { hasInput, header };
});
log("2. term card opened with input:", cardInfo.hasInput, JSON.stringify(cardInfo.header));

// 3. Ask inside the card → reply appears in the card
const cardTa = await page.$(".card-container textarea");
await cardTa.type("感知机是什么？");
await page.keyboard.press("Enter");
await sleep(2500);
const cardReply = await page.evaluate(() => {
  const card = document.querySelector(".card-container");
  return card?.textContent || "";
});
log("3. card reply contains 感知机:", cardReply.includes("感知机"));
log("   card reply contains 继续深挖 related content:", cardReply.includes("深挖") || cardReply.includes("接着刚才"));

// 4. Click a bold term inside the card reply → child card opens
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  const chip = [...(card?.querySelectorAll("button.term-chip") ?? [])].find((b) => b.textContent?.includes("反向传播"));
  chip?.click();
});
await sleep(700);
const childCount = await page.evaluate(() => document.querySelectorAll(".card-container").length);
log("4. child card opened (2 layers):", childCount === 2);

await browser.close();
console.log("DONE");
