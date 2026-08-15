/**
 * Verify auto-ask token saving (R9 fix): 未知词条卡片只自动问 AI 一次。
 * - 首次打开未知词条卡片 → 恰好 1 次 chat/completions 请求；
 * - 关闭后从主对话 chip / 探索路径 chip 再次打开同一词条 → 0 次新请求（会话缓存复用）；
 * - 卡片内仍显示之前的回复内容。
 * Usage: node scripts/verify-autocache.mjs  (requires dev server on :3000)
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

const uid = () => "id-" + Math.random().toString(36).slice(2, 10);
const NOW = Date.now();
const TERM = "幻影术语"; // 不在 TERM_TREE / GLOSSARY 里 → resolveTerm 返回空摘要
const REPLY_MARK = "AUTOOK-缓存解释";

const turn = {
  id: uid(),
  title: "幻影术语是什么？",
  createdAt: NOW - 10000,
  messages: [
    { id: uid(), role: "user", content: "幻影术语是什么？", createdAt: NOW - 10000 },
    { id: uid(), role: "assistant", content: `**${TERM}** 是一个知识树外的概念，值得一问。`, createdAt: NOW - 8000 },
  ],
};
const proj = { id: uid(), title: "自动问缓存验证", folder: null, cloud: false, createdAt: NOW - 20000, updatedAt: NOW, turns: [turn] };
const seed = {
  settings: { activeModelId: "byok-test" },
  byokModels: [
    { id: "byok-test", name: "测试模型", provider: "BYOK", baseUrl: "https://fake.example.com/v1", modelId: "fake-model", apiKey: "sk-test" },
  ],
  projects: [proj],
  activeProjectId: proj.id,
};

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--disable-gpu", "--no-sandbox", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// --- BYOK interception: count chat/completions calls, reply with SSE ---
let apiCalls = 0;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const sse = (chunks) =>
  chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}`).join("\n\n") +
  "\n\ndata: [DONE]\n\n";
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (!req.url().includes("chat/completions")) return req.continue();
  if (req.method() === "OPTIONS") {
    req.respond({ status: 204, headers: corsHeaders });
    return;
  }
  apiCalls++;
  req.respond({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: sse([REPLY_MARK + "：这是关于「" + TERM + "」的解释。"]) });
});

await page.evaluateOnNewDocument((seedStr) => {
  try {
    localStorage.clear();
    localStorage.setItem("explore-onboarded", "1");
    localStorage.setItem("explore-state-v1", seedStr);
  } catch {}
}, JSON.stringify(seed));
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(800);

const clickChip = () =>
  page.evaluate((term) => {
    const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes(term));
    chip?.click();
    return !!chip;
  }, TERM);
const closeCard = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll(".card-container")].at(-1);
    [...(card?.querySelectorAll("button") ?? [])].find((b) => b.getAttribute("title") === "关闭")?.click();
  });
const cardText = () =>
  page.evaluate(() => [...document.querySelectorAll(".card-container")].at(-1)?.textContent ?? "");

// D1. 首次打开未知词条卡片 → 恰好 1 次请求 + 回复渲染
await clickChip();
await sleep(1600); // 150ms auto-ask delay + stream
{
  const txt = await cardText();
  ok("D1. 首次打开未知词条：恰好 1 次 API 请求，卡片显示回复",
    apiCalls === 1 && txt.includes(REPLY_MARK), { apiCalls });
}

// D2. 关闭后从主对话 chip 重开 → 0 次新请求，内容来自缓存
await closeCard();
await sleep(500);
await clickChip();
await sleep(900);
{
  const txt = await cardText();
  ok("D2. 主对话 chip 重开同一词条：无新请求（缓存复用）",
    apiCalls === 1 && txt.includes(REPLY_MARK), { apiCalls });
}

// D3. 关闭后从探索路径 chip 重开 → 0 次新请求，内容来自缓存
await closeCard();
await sleep(500);
const trailClicked = await page.evaluate((term) => {
  const chip = [...document.querySelectorAll(".explore-chip")].find((b) => b.textContent?.includes(term));
  chip?.click();
  return !!chip;
}, TERM);
await sleep(900);
{
  const txt = await cardText();
  ok("D3. 探索路径 chip 重开同一词条：无新请求（缓存复用）",
    trailClicked && apiCalls === 1 && txt.includes(REPLY_MARK), { apiCalls, trailClicked });
}

await browser.close();
console.log("DONE");
