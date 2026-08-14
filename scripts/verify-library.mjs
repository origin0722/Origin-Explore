/**
 * Verify the doc-library fixes:
 * 1) library toolbar has a back button that exits to chat;
 * 2) sidebar "+" uploads a doc directly and lands in the library;
 * 3) sidebar section labels (本地文档/常驻聊天/本地项目) share one font size.
 * Usage: node scripts/verify-library.mjs
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

// 3. Font sizes of the three sidebar labels
const fonts = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  const find = (t) => {
    const el = [...(aside?.querySelectorAll("span") ?? [])].find((s) => s.textContent === t);
    return el ? getComputedStyle(el).fontSize : null;
  };
  return { doc: find("本地文档"), resident: find("常驻聊天"), local: find("本地项目") };
});
log("3. font sizes (本地文档/常驻聊天/本地项目):", JSON.stringify(fonts));
log("   unified:", fonts.doc === fonts.resident && fonts.resident === fonts.local);

// 1. Open the library via the 本地文档 row → back button exists → exits to chat
await page.evaluate(() => {
  const row = [...document.querySelectorAll("div,button")].find((b) => b.textContent?.includes("本地文档") && b.textContent.length < 30);
  row?.click();
});
await sleep(600);
const libOpen = await page.evaluate(() => document.body.textContent?.includes("还没有文档") || document.body.textContent?.includes("上传文档"));
const backBtn = await page.evaluate(() => !!document.querySelector("button[aria-label='返回聊天']"));
log("1a. library opened:", libOpen, "| back button present:", backBtn);
if (backBtn) {
  await page.evaluate(() => document.querySelector("button[aria-label='返回聊天']")?.click());
  await sleep(500);
}
const backToChat = await page.evaluate(() => {
  // back in the chat view: no library toolbar, but the chat textarea exists
  return !!document.querySelector("textarea") && !document.body.textContent?.includes("上传文档");
});
log("1b. back button exits to chat:", backToChat);

// 2. Sidebar "+" uploads a doc directly
const uploadInput = await page.$('input[accept*=".md"]'); // the sidebar upload input (first in DOM)
await uploadInput.uploadFile("scripts/fixtures/ml-notes.md");
await sleep(1500);
const uploaded = await page.evaluate(() => document.body.textContent?.includes("ml-notes"));
const inLibrary = await page.evaluate(() => document.body.textContent?.includes("上传文档"));
log("2. sidebar + uploads doc & lands in library:", uploaded && inLibrary, `(doc:${uploaded}, lib:${inLibrary})`);

await browser.close();
console.log("DONE");
