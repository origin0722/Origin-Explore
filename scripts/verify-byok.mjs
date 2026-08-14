/**
 * Verify BYOK real-call flow with request interception:
 * 1) success path (intercept → 200 fake reply) renders the real reply;
 * 2) failure path (intercept → 500) falls back to offline with a note.
 * Usage: node scripts/verify-byok.mjs
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
let apiCalls = 0;
let sawStreamFlag = false;
page.on("request", (req) => {
  if (req.url().includes("chat/completions")) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (req.method() === "OPTIONS") {
      // CORS preflight
      req.respond({ status: 204, headers: corsHeaders });
      return;
    }
    apiCalls++;
    if (req.method() === "POST") {
      try {
        sawStreamFlag = sawStreamFlag || JSON.parse(req.postData()).stream === true;
      } catch {}
    }
    if (apiCalls === 1) {
      // success path: SSE stream (stream:true requested by the client)
      const sse = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: "这是 **BYOK 流式回复**：" } }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: "来自 SSE 拦截响应，逐块到达。" } }] })}`,
        `data: [DONE]`,
        "",
      ].join("\n\n");
      req.respond({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: sse,
      });
    } else {
      // failure path
      req.respond({
        status: 500,
        contentType: "application/json",
        headers: corsHeaders,
        body: "{\"error\":\"boom\"}",
      });
    }
  } else {
    req.continue();
  }
});
await page.evaluateOnNewDocument(() => {
  try { localStorage.clear(); localStorage.setItem("explore-onboarded", "1"); } catch {}
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(700);

// Add BYOK model via settings
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.title === "设置" || b.textContent?.trim() === "设置");
  btn?.click();
});
await sleep(600);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("添加 BYOK 模型"))?.click();
});
await sleep(300);
const fill = async (placeholder, value) => {
  await page.evaluate(([ph, v]) => {
    const input = [...document.querySelectorAll("input")].find((i) => i.placeholder?.includes(ph));
    if (!input) return;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [placeholder, value]);
};
await fill("模型名称", "my-test");
await fill("API 地址", "http://fake.local/v1");
await fill("模型 ID", "test-model");
await fill("API Key", "sk-test-123");
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "添加")?.click();
});
await sleep(500);
// select the BYOK row + save
await page.evaluate(() => {
  [...document.querySelectorAll("h4")].find((h) => h.textContent?.includes("my-test"))?.closest("div")?.click();
});
await sleep(200);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "保存")?.click();
});
await sleep(500);

// Send a message → success path
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "测试 BYOK 成功路径");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
const successReply = await page.evaluate(() => document.querySelector(".markdown-content")?.textContent || "");
log("1. success path (SSE): API calls =", apiCalls);
log("   request used stream:true:", sawStreamFlag);
log("   streamed reply rendered:", successReply.includes("BYOK 流式回复") && successReply.includes("逐块到达"));
log("   no fallback note:", !successReply.includes("BYOK 请求失败"));
log("   first 120 chars of reply:", JSON.stringify(successReply.slice(0, 120)));

// Send a second message → failure path (500)
await page.type("textarea", "测试 BYOK 失败回退");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
const failReply = await page.evaluate(() => document.querySelectorAll(".markdown-content").length ? [...document.querySelectorAll(".markdown-content")].at(-1)?.textContent || "" : "");
log("2. failure path: API calls =", apiCalls);
log("   fallback note shown:", failReply.includes("BYOK 请求失败"));
log("   offline reply included:", failReply.includes("离线知识库"));

await browser.close();
console.log("DONE");
