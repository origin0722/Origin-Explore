/**
 * Local QA probe for the Explore clone (localhost:3000).
 * Structural + interaction checks, desktop 1440 & mobile 390, screenshots.
 * Usage: node scripts/qa-local.mjs
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT_EDGE = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT_EDGE;

const results = [];
const ok = (name, pass, detail = "") =>
  results.push({ name, pass: !!pass, detail });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: "new",
    args: [
      "--edge-skip-compat-layer-relaunch",
      "--no-first-run",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1440,900",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem("explore-onboarded", "1");
    } catch {}
  });

  await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });

  const shot = async (name) => {
    await page.screenshot({
      path: `docs/research/ai-explore-poker-820d0558/chat-6ea4b827/qa-${name}.png`,
    });
  };
  const has = async (sel) =>
    (await page.$(sel)) !== null;
  const text = async (sel) =>
    (await page.$eval(sel, (el) => el.textContent?.trim() || "").catch(() => ""));

  // ---------- 1. Welcome state (desktop) ----------
  const sidebarW = await page
    .$eval("aside", (el) => el.getBoundingClientRect().width)
    .catch(() => -1);
  ok("sidebar-width-225", sidebarW === 225, `width=${sidebarW}`);
  ok("welcome-logo", (await text("h1")) === "Explore", await text("h1"));
  ok("input-placeholder", (await text("textarea"))?.includes("问点什么"), await text("textarea"));

  // ---------- 2. Create project → chat card ----------
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
  });
  await sleep(400);
  ok("chatcard-after-new", await has("[class*='bg-card-std']"), "chat card container");

  // ---------- 3. Send message → mock AI reply + term chips ----------
  await page.type("textarea", "什么是量子纠缠？");
  await page.keyboard.down("Control");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Control");
  await sleep(2000); // mock reply delay 1.2s + render
  const termChips = await page.$$eval("button.term-chip", (els) => els.length);
  ok("ai-reply-markdown", (await text("[class*='markdown-content']")).length > 50, "markdown rendered");
  ok("term-chips", termChips >= 5, `term chips=${termChips}`);
  await shot("qa-desktop-chat");

  // ---------- 4. Term click → sub-card ----------
  await page.evaluate(() => {
    document.querySelector("button.term-chip")?.click();
  });
  await sleep(500);
  ok("subcard-opens", (await text("[class*='bg-card-floating']")).includes("叠加态") || (await text("body")).includes("叠加态"), "term sub-card");
  await shot("qa-desktop-subcard");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.getBoundingClientRect().left > 800 && (b.textContent?.includes("返回") || b.title?.includes("返回")))?.click();
  });

  // ---------- 5. Sidebar: settings modal + locked model → subscribe ----------
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("设置"))?.click();
  });
  await sleep(400);
  ok("settings-opens", await has("[class*='bg-modal-std']"), "settings modal");
  await shot("qa-desktop-settings");
  // locked model row → subscribe
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("grok-4.5"))?.click();
  });
  await sleep(400);
  ok("subscribe-from-locked", (await text("body")).includes("选择订阅方案"), "subscribe modal");
  await page.keyboard.press("Escape");
  await sleep(300);
  await page.keyboard.press("Escape");
  await sleep(300);

  // ---------- 6. Mindscape rail expand (desktop) ----------
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.title === "思维宇宙")?.click();
  });
  await sleep(500);
  const msHeader = await text("body");
  ok("mindscape-desktop", msHeader.includes("思维宇宙"), "panel header");
  await shot("qa-desktop-mindscape");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.title === "思维宇宙")?.click();
  });

  // ---------- 7. Onboarding wizard (first visit) ----------
  await page.evaluate(() => {
    localStorage.removeItem("explore-onboarded");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(600);
  ok("onboarding-auto", (await text("body")).includes("选择主题颜色"), "wizard step 1");
  await shot("qa-desktop-onboarding");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("跳过"))?.click();
  });
  await sleep(300);

  // ---------- 8. Mobile 390 ----------
  await page.setViewport({ width: 390, height: 844 });
  await sleep(500);
  ok("mob-hamburger", await has("button[aria-label='打开侧边栏']"), "hamburger");
  ok("mob-fab", await has("button[aria-label='打开思维宇宙']"), "FAB");
  await page.evaluate(() => {
    document.querySelector("button[aria-label='打开思维宇宙']")?.click();
  });
  await sleep(500);
  ok("mob-mindscape-drawer", (await text("body")).includes("思维宇宙"), "drawer opens");
  await shot("qa-mobile-mindscape");
  await page.keyboard.press("Escape");
  await sleep(300);
  await page.evaluate(() => {
    document.querySelector("button[aria-label='打开侧边栏']")?.click();
  });
  await sleep(400);
  ok("mob-sidebar-drawer", await has("aside"), "sidebar drawer");
  await shot("qa-mobile-sidebar");

  // ---------- Overflow check ----------
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.scrollWidth;
    return { w, vw: window.innerWidth, overflowX: w > window.innerWidth + 1 };
  });
  ok("no-horizontal-overflow", !overflow.overflowX, `scrollW=${overflow.w} vw=${overflow.vw}`);

  await browser.close();

  console.log(JSON.stringify({ results, overflow: null }, null, 2));
  const fails = results.filter((r) => !r.pass);
  console.log(`\n${results.length - fails.length}/${results.length} passed`);
  if (fails.length) {
    console.log("FAILED:");
    fails.forEach((f) => console.log(`  ✗ ${f.name} — ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(2);
});
