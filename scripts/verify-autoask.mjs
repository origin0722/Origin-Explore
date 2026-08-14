/**
 * Verify: with BYOK active, clicking an UNKNOWN bold term (not in the local
 * knowledge tree) auto-asks the AI — the card fills with the model's answer.
 * Usage: node scripts/verify-autoask.mjs
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
await page.setRequestInterception(true);
let apiPosts = 0;
page.on("request", (req) => {
  if (req.url().includes("chat/completions")) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (req.method() === "OPTIONS") {
      req.respond({ status: 204, headers: corsHeaders });
      return;
    }
    apiPosts++;
    const chunk = (c) => "data: " + JSON.stringify({ choices: [{ delta: { content: c } }] }) + "\n\n";
    const body =
      apiPosts === 1
        ? chunk("在讨论前端框架时，常提到 **模板继承** 与嵌套布局。")
        : chunk("**模板继承** 是模板引擎中的一种机制：子模板可以继承父模板的结构，并通过块（block）覆写指定区域，从而复用整体布局。");
    req.respond({
      status: 200,
      contentType: "text/event-stream",
      headers: corsHeaders,
      body: body + "data: [DONE]\n\n",
    });
  } else {
    req.continue();
  }
});
await page.evaluateOnNewDocument(() => {
  try { localStorage.clear(); localStorage.setItem("explore-onboarded", "1"); } catch {}
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(700);

// Add BYOK + select + save
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.title === "设置" || b.textContent?.trim() === "设置");
  btn?.click();
});
await sleep(600);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("添加 BYOK 模型"))?.click();
});
await sleep(300);
const fill = async (ph, v) => {
  await page.evaluate(([p, val]) => {
    const input = [...document.querySelectorAll("input")].find((i) => i.placeholder?.includes(p));
    if (!input) return;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, val);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [ph, v]);
};
await fill("模型名称", "my-test");
await fill("API 地址", "http://fake.local/v1");
await fill("模型 ID", "test-model");
await fill("API Key", "sk-test");
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "添加")?.click();
});
await sleep(500);
await page.evaluate(() => {
  [...document.querySelectorAll("h4")].find((h) => h.textContent?.includes("my-test"))?.closest("div")?.click();
});
await sleep(200);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "保存")?.click();
});
await sleep(500);

// Ask in the main chat (offline reply would NOT contain 模板继承; the API's will)
await page.type("textarea", "讲讲模板继承");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);

// Click the unknown bold term 模板继承 in the reply
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent === "模板继承");
  chip?.click();
});
await sleep(3000); // auto-ask fires + streams

const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".card-container")];
  const top = cards.at(-1);
  return {
    cards: cards.length,
    cardText: top?.textContent ?? "",
    hasPromptBubble: [...(top?.querySelectorAll("span") ?? [])].some((s) => s.textContent?.includes("请详细解释")),
    apiPosts: null,
  };
});
info.apiPosts = apiPosts;
log("1. card opened:", info.cards >= 1);
log("2. auto-ask fired (2 API posts):", apiPosts === 2, `(apiPosts=${apiPosts})`);
log("3. card shows the AI explanation:", info.cardText.includes("模板继承") && info.cardText.includes("模板引擎"));
log("4. auto prompt NOT exposed as a user bubble:", !info.hasPromptBubble);

await browser.close();
console.log("DONE");
