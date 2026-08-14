/**
 * Verify the turn-title dedup: single turn hides the per-turn big title
 * (card header + bubble are enough); multi-turn restores them for orientation.
 * Usage: node scripts/verify-turntitle.mjs
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

// 1. Single turn: send 你好
await page.type("textarea", "你好");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);

const single = await page.evaluate(() => {
  const turnBox = document.querySelector("[id^='chat-turn-']");
  const bigTitles = [...(turnBox?.querySelectorAll("div") ?? [])].filter(
    (d) => d.className.includes("h-14") && d.className.includes("text-lg")
  );
  const headerTitle = document.querySelector("header, .rounded-\\[24px\\] > div")?.textContent?.includes("你好");
  // card header title = the span in the top bar
  const headerHasHello = (document.querySelector(".rounded-\\[24px\\]")?.querySelector("span.font-bold")?.textContent ?? "").includes("你好");
  const bubbleHasHello = [...document.querySelectorAll("[id^='chat-turn-'] span")].some((s) => s.textContent === "你好");
  return {
    turnBigTitles: bigTitles.length,
    headerHasHello,
    bubbleHasHello,
    turnTitleOccurrences: (turnBox?.textContent ?? "").split("你好").length - 1,
  };
});
log("1. single turn — big turn title absent:", single.turnBigTitles === 0);
log("   card header has 你好:", single.headerHasHello, "| bubble has 你好:", single.bubbleHasHello);

// 2. Second message → multi-turn
await page.type("textarea", "什么是动态规划？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
const multi = await page.evaluate(() => {
  const turns = [...document.querySelectorAll("[id^='chat-turn-']")];
  const firstTurn = turns[0];
  const bigTitles = firstTurn ? [...firstTurn.querySelectorAll("div")].filter((d) => d.className.includes("h-14")).length : 0;
  return { turnCount: turns.length, firstTurnBigTitles: bigTitles };
});
log("2. multi-turn — turn titles restored:", multi.turnCount === 2 && multi.firstTurnBigTitles === 1);

await browser.close();
console.log("DONE");
