/**
 * Verify doc-question dual-channel: with a BYOK model active, clicking a term
 * in a document and asking AI calls the real API (intercepted); otherwise it
 * uses the offline knowledge base.
 * Usage: node scripts/verify-docbyok.mjs
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
    // stream 2 chunks then [DONE]
    const chunk = (c) => "data: " + JSON.stringify({ choices: [{ delta: { content: c } }] }) + "\n\n";
    req.respond({
      status: 200,
      contentType: "text/event-stream",
      headers: corsHeaders,
      body: chunk("这是**文档问答的真实回复**：") + chunk("来自你的 API。") + "data: [DONE]\n\n",
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

// Add a BYOK model + select it + save
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
const selected = await page.evaluate(() => document.querySelector("button[aria-haspopup='listbox']")?.textContent?.includes("my-test") ?? false);
log("0. BYOK model selected:", selected);

// Upload a doc (directly on the sidebar's upload input)
const input = await page.$('input[accept*=".md"]');
await input.uploadFile("scripts/fixtures/ml-notes.md");
await sleep(1500);
const docListed = await page.evaluate(() => document.body.textContent?.includes("ml-notes"));
log("0b. doc uploaded & listed:", docListed);

// Open the doc and click a highlighted term → ask AI
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("ml-notes"))?.click();
});
await sleep(600);
const termClicked = await page.evaluate(() => {
  const term = [...document.querySelectorAll("button")].find((b) => b.textContent === "反向传播");
  term?.click();
  return !!term;
});
log("0c. term 反向传播 clicked:", termClicked);
await sleep(500);
const askClicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("问 AI"));
  btn?.click();
  return !!btn;
});
log("0d. 问 AI clicked:", askClicked);
await sleep(3000);
const apiCalled = apiPosts > 0;
const replyText = await page.evaluate(() => [...document.querySelectorAll(".markdown-content")].at(-1)?.textContent || "");
log("1. doc question hit the BYOK API:", apiCalled, `(apiPosts=${apiPosts})`);
log("2. real reply rendered:", replyText.includes("文档问答的真实回复"));
log("   last markdown:", JSON.stringify(replyText.slice(0, 100)));
const turnText = await page.evaluate(() => {
  const turn = [...document.querySelectorAll("[id^='chat-turn-']")].at(-1);
  return turn?.textContent?.slice(0, 120) ?? "(no turn)";
});
log("   last turn text:", JSON.stringify(turnText));
const viewInfo = await page.evaluate(() => ({
  mainText: document.querySelector("main")?.textContent?.slice(0, 80) ?? "(no main)",
  turns: document.querySelectorAll("[id^='chat-turn-']").length,
  stored: (() => {
    try {
      const raw = localStorage.getItem("explore-state-v1");
      const s = raw ? JSON.parse(raw) : null;
      return {
        activeProjectId: s?.activeProjectId,
        projectIds: s?.projects?.map((p) => p.id + ":" + p.title + ":turns=" + (p.turns?.length ?? 0)),
      };
    } catch {
      return "parse-error";
    }
  })(),
}));
log("   view info:", JSON.stringify(viewInfo));

await browser.close();
console.log("DONE");
