/**
 * Verify favorites + smart summary + unread indicators + path breadcrumb:
 * 1) star a turn → sidebar 收藏 section lists it;
 * 2) 智能摘要 (offline heuristic) renders the summary card;
 * 3) turn-nav node: right-click toggles the unread dot; focusTurn (favorite
 *    row click) clears it;
 * 4) auto-unread: while a long reply streams below, stay scrolled up → the
 *    new turn gets an unread dot;
 * 5) term-card header shows the deep-dive path breadcrumb.
 * Usage: node scripts/verify-fav-unread.mjs
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

const sendMain = async (q) => {
  await page.type("textarea.bg-transparent", q);
  await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
};
const expandSidebar = async () => {
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("button")].find((b) => (b.title ?? "") === "收起侧边栏");
    t?.click();
  });
  await sleep(400);
};

// setup: project + two long turns (sending auto-collapses the sidebar each time)
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await sendMain("什么是机器学习？");
await sleep(4500);
const panelVisible = await page.evaluate(() => ({
  hasPanel: document.body.textContent?.includes("轮次导航图") ?? false,
  hasNode: !!document.querySelector("[data-turn-node]"),
}));
log("0. turn-graph panel always visible on the right:", panelVisible.hasPanel && panelVisible.hasNode);
await sendMain("什么是监督学习？");
await sleep(4500);
await expandSidebar();

// 1. favorite the first turn (first star button in the turn list)
await page.evaluate(() => {
  const star = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "收藏");
  star?.click();
});
await sleep(500);
const favRow = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("[role='button']")];
  return rows.some((r) => (r.title ?? "").includes("（点击跳转）") && (r.textContent ?? "").includes("什么是机器学习？"));
});
log("1. turn starred → sidebar 收藏 row:", favRow);

// 2. smart summary (offline heuristic)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "智能摘要");
  btn?.click();
});
await sleep(600);
const summary = await page.evaluate(() => document.body.textContent || "");
log("2. smart summary renders heuristic content:",
  summary.includes("📌 主题") && summary.includes("涉及术语") && summary.includes("机器学习"));

// 3. turn-graph node (always-visible right panel): right-click toggles unread;
//    favorite-row click (focusTurn) clears
await sleep(400);
const railItemRect = await page.evaluate(() => {
  const node = document.querySelector("[data-turn-node]");
  const r = node?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
});
const dotCount = () => page.evaluate(() => document.querySelectorAll("[aria-label='未读']").length);
await page.mouse.click(railItemRect.x, railItemRect.y, { button: "right" });
await sleep(300);
const afterOn = await dotCount();
await page.mouse.click(railItemRect.x, railItemRect.y, { button: "right" });
await sleep(300);
const afterOff = await dotCount();
log("3. right-click toggles unread dot:", afterOn === 1 && afterOff === 0, `(${afterOn} → ${afterOff})`);

await page.mouse.click(railItemRect.x, railItemRect.y, { button: "right" });
await sleep(300);
await page.evaluate(() => {
  const row = [...document.querySelectorAll("[role='button']")].find((r) => (r.title ?? "").includes("（点击跳转）"));
  row?.click();
});
await sleep(500);
const afterFocus = await dotCount();
log("   favorite-row click (focusTurn) clears unread:", afterFocus === 0);

// 4. auto-unread: long reply streams below while we stay scrolled up
await sendMain("什么是叠加态？");
await sleep(1300); // content is long by now; the near-bottom guard won't yank us back
await page.evaluate(() => {
  const turnEl = document.querySelector("[id^='chat-turn-']");
  const el = turnEl?.parentElement ?? null; // the chat scroll container
  if (el) el.scrollTop = 0;
});
await sleep(4000);
const lastRailUnread = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("[data-turn-node]")];
  return !!nodes.at(-1)?.querySelector("[aria-label='未读']");
});
log("4. auto-unread dot on the new turn (scrolled away during reply):", lastRailUnread);

// 5. term-card path breadcrumb (deterministic: 监督学习 → 量子比特)
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => (b.textContent ?? "").trim() === "监督学习");
  chip?.click();
});
await sleep(700);
const cardTa = await page.$(".card-container textarea");
await cardTa.type("什么是量子比特？");
await page.keyboard.press("Enter");
await sleep(3000);
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  const chip = [...(card?.querySelectorAll("button.term-chip") ?? [])].find(
    (b) => (b.textContent ?? "").trim() === "量子比特"
  );
  chip?.click();
});
await sleep(700);
const breadcrumb = await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  return card?.textContent ?? "";
});
log("5. card header shows deep-dive path breadcrumb:", breadcrumb.includes("🧭 监督学习 → 量子比特"));

await browser.close();
console.log("DONE");
