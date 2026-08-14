/**
 * Verify document delete buttons:
 * 1) library cards show a visible delete button (no hover-only opacity);
 * 2) the reader toolbar has a delete button;
 * 3) deleting from the reader returns to the library with the doc gone.
 * Usage: node scripts/verify-docdelete.mjs
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

// Open the doc library
await page.evaluate(() => {
  const btn = document.querySelector("button[aria-label='打开文档库']")
    ?? [...document.querySelectorAll("div,button")].find((b) => b.textContent?.includes("本地文档"));
  btn?.click();
});
await sleep(600);

// Upload a fixture file (the doc-library upload input accepts .md files)
const input = await page.$('input[accept*=".md"]');
await input.uploadFile("scripts/fixtures/ml-notes.md");
await sleep(1500);

// 1. Library card delete button visible (opacity not 0 without hover)
const libBtn = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "删除文档");
  if (!btn) return null;
  const cs = getComputedStyle(btn);
  return { opacity: cs.opacity, visible: cs.opacity !== "0" };
});
log("1. library delete button visible:", libBtn?.visible, JSON.stringify(libBtn));

// 2. Open the doc → reader toolbar delete button
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("ml-notes"))?.click();
});
await sleep(600);
const readerBtn = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "删除文档");
  return !!btn;
});
log("2. reader toolbar delete button present:", readerBtn);

// 3. Delete from the reader → back to library, doc gone
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "删除文档")?.click();
});
await sleep(600);
const afterDelete = await page.evaluate(() => {
  const libraryView = document.body.textContent?.includes("本地文档") && document.body.textContent?.includes("还没有文档");
  const docGone = !document.body.textContent?.includes("ml-notes");
  return { libraryView, docGone };
});
log("3. after delete → back to library:", afterDelete.libraryView, "| doc gone:", afterDelete.docGone);

await browser.close();
console.log("DONE");
