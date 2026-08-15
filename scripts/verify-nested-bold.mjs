/**
 * Reproduce/verify the nested-bold hydration error:
 * AI 回复含嵌套加粗（**外层 **内层** 收尾**）→ strong 渲染器产生 button-in-button。
 * 断言：页面加载后浏览器控制台没有 "cannot be a descendant of <button>"。
 * Usage: node scripts/verify-nested-bold.mjs  (requires dev server on :3000)
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(...m);

const uid = () => "id-" + Math.random().toString(36).slice(2, 10);
const NOW = Date.now();
const turn = {
  id: uid(),
  title: "嵌套加粗",
  createdAt: NOW - 10000,
  messages: [
    { id: uid(), role: "user", content: "什么是随机森林？", createdAt: NOW - 10000 },
    { id: uid(), role: "assistant", content: "**随机森林 **决策树** 的集成** 还有 **梯度下降** 可以深挖。", createdAt: NOW - 8000 },
  ],
};
const proj = { id: uid(), title: "嵌套加粗验证", folder: null, cloud: false, createdAt: NOW - 20000, updatedAt: NOW, turns: [turn] };
const seed = { settings: { activeModelId: "offline" }, projects: [proj], activeProjectId: proj.id };

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--disable-gpu", "--no-sandbox", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errors = [];
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("cannot be a descendant") || t.includes("hydration")) errors.push(t);
});
page.on("pageerror", (err) => errors.push(String(err)));

await page.evaluateOnNewDocument((seedStr) => {
  try {
    localStorage.clear();
    localStorage.setItem("explore-onboarded", "1");
    localStorage.setItem("explore-state-v1", seedStr);
  } catch {}
}, JSON.stringify(seed));
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(1500);

const chipCount = await page.evaluate(() => document.querySelectorAll("button.term-chip").length);
log("term-chip count:", chipCount);
if (errors.length) {
  log("FAIL 控制台出现嵌套错误:", errors.slice(0, 3));
} else {
  log("PASS 无 button-in-button / hydration 错误");
}
await browser.close();
console.log("DONE");
