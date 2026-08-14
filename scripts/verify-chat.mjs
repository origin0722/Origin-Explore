/**
 * Verify: clean model list (no dupes, realistic names) + conversation context
 * memory (a follow-up question without a term picks up the previous topic).
 * Usage: node scripts/verify-chat.mjs
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

// 1. Model list: clean names, no duplicates
await page.evaluate(() => {
  const pill = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "listbox");
  pill?.click();
});
await sleep(400);
const modelNames = await page.evaluate(() => {
  const box = document.querySelector("[role='listbox']");
  return [...(box?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim() || "");
});
const dupes = modelNames.filter((n, i) => modelNames.indexOf(n) !== i);
log("1. model list:", JSON.stringify(modelNames));
log("   has 离线知识库:", modelNames.some((n) => n.includes("离线知识库")), "| duplicates:", JSON.stringify(dupes));
await page.keyboard.press("Escape");
await sleep(300);

// 2. Context memory: ask a term, then a bare follow-up
await page.type("textarea", "什么是机器学习？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
await page.type("textarea", "继续解释一下");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
const followUp = await page.evaluate(() => [...document.querySelectorAll(".markdown-content")].at(-1)?.textContent || "");
log("2. follow-up reply:", JSON.stringify(followUp.slice(0, 120)));
log("   picks up previous topic:", followUp.includes("机器学习") && followUp.includes("接着刚才"));

await browser.close();
console.log("DONE");
