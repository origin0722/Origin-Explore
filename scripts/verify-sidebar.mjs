/**
 * Smoke-test the sidebar interactions: rename, new folder, smart mode.
 * Usage: node scripts/verify-sidebar.mjs
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

const log = (...m) => console.log(...m);

// 1. New folder
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建文件夹"))?.click();
});
await sleep(200);
await page.type("input[placeholder='文件夹名称，回车确认']", "学习");
await page.keyboard.press("Enter");
await sleep(400);
const folderCreated = await page.evaluate(() => document.body.textContent?.includes("学习"));
log("1. new folder created:", folderCreated);

// 2. Smart mode toggle
await page.evaluate(() => {
  document.querySelector("button[aria-label='智能模式']")?.click();
});
await sleep(200);
const smartOn = await page.evaluate(() => {
  const b = document.querySelector("button[aria-label='智能模式']");
  return b ? b.className.includes("text-brand") : false;
});
log("2. smart mode toggled (icon highlighted):", smartOn);

// 3. Rename project via context menu
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "项目菜单")?.click();
});
await sleep(200);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "重命名")?.click();
});
await sleep(200);
await page.evaluate(() => {
  const input = document.querySelector("input");
  // the rename input has ring-brand; just clear and type
  if (input) {
    input.value = "";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "我的第一个项目");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.keyboard.press("Enter");
await sleep(400);
const renamed = await page.evaluate(() => document.body.textContent?.includes("我的第一个项目"));
log("3. project renamed:", renamed);

await browser.close();
console.log("DONE");
