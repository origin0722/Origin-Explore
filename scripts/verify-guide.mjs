/**
 * Verify guide UI (R10): 使用指南精简版 + 如何使用弹层放大。
 * G1. 空态点"如何使用"→ 弹层出现且为 max-w-2xl（放大后）；
 * G2. 弹层含 8 个能力且描述不再被截断（无 truncate）；
 * G3. "查看完整引导"→ 使用指南弹窗 = 两句话 + 保留句 + 开始探索，无功能卡片列表。
 * Usage: node scripts/verify-guide.mjs  (requires dev server on :3000)
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(...m);
const ok = (name, cond, extra = "") =>
  log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " " + JSON.stringify(extra) : ""}`);

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
await sleep(900);

// G1/G2: open 如何使用 popover
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("如何使用"))?.click();
});
await sleep(500);
const pop = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="如何使用"]');
  if (!dlg) return null;
  const cls = dlg.className;
  const items = [...dlg.querySelectorAll("li")].length;
  const truncated = [...dlg.querySelectorAll("li span, li div")].some((e) =>
    e.className.includes("truncate")
  );
  return { hasMaxW2xl: cls.includes("max-w-2xl"), items, truncated, w: dlg.getBoundingClientRect().width };
});
ok("G1. 如何使用弹层放大（max-w-2xl）且含 8 项能力",
  !!pop && pop.hasMaxW2xl && pop.items === 8 && pop.w > 600, pop);
ok("G2. 能力描述不再截断", !!pop && !pop.truncated);

// G3: 继续 → 使用指南弹窗
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "继续")?.click();
});
await sleep(500);
const guide = await page.evaluate(() => document.body.textContent ?? "");
const hasHero = guide.includes("AI 结构化思维与知识探索工具 —— 哪里不懂点哪里，一棵属于你的知识树");
const hasTag2 = guide.includes("摆脱线性聊天框的限制，实现多层级对话——复杂讨论在这里完全展开");
const hasKept = guide.includes("曾经在单线程对话中迷失的复杂讨论");
const noCards = !guide.includes("智能标注") && !guide.includes("子卡片") && !guide.includes("分支卡片");
ok("G3. 使用指南：两句话 + 保留句 + 无功能卡片",
  hasHero && hasTag2 && hasKept && noCards, { hasHero, hasTag2, hasKept, noCards });

// G4. 主页极简：标语删除、问号按钮删除、如何使用按钮相对内容区居中
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("开始探索"))?.click();
});
await sleep(400);
const home = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("如何使用"));
  const r = btn?.getBoundingClientRect();
  const dlg = document.querySelector("[data-dialog-root]")?.getBoundingClientRect();
  const dlgCx = dlg ? dlg.left + dlg.width / 2 : window.innerWidth / 2;
  return {
    taglineGone: !document.body.textContent?.includes("哪里不懂点哪里"),
    questionGone: !document.querySelector('[aria-label="加载示例项目"]'),
    centered: !!r && !!dlg && Math.abs(r.left + r.width / 2 - dlgCx) < 4,
  };
});
ok("G4. 主页极简 + 按钮居中（标语/问号已删）",
  home.taglineGone && home.questionGone && home.centered, home);

await browser.close();
console.log("DONE");
