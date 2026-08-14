/**
 * Verify borrowings from the original site's app introduction:
 * A) welcome tagline + global 使用指南 modal (guide copy);
 * B) 智能标注: clickable terms are underlined;
 * C) 引用回答: select text in an AI reply → quote button → quote chip in the
 *    input area → sent message carries the `> ` quote (multiple supported);
 * D) 分支卡片: new turn inherits the upstream card's conversation history
 *    (asserted via the intercepted BYOK request body) and replies through the
 *    dual-channel pipeline.
 * Usage: node scripts/verify-borrow.mjs
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(...m);

const QUOTED = "是分支卡片术语，点击试试。";

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--disable-gpu", "--no-sandbox", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// --- BYOK interception (SSE replies per call; call 4 = branch turn) ---
await page.setRequestInterception(true);
let apiCalls = 0;
let branchBody = null;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const sse = (chunks) =>
  chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}`).join("\n\n") +
  "\n\ndata: [DONE]\n\n";
page.on("request", (req) => {
  if (!req.url().includes("chat/completions")) return req.continue();
  if (req.method() === "OPTIONS") {
    req.respond({ status: 204, headers: corsHeaders });
    return;
  }
  apiCalls++;
  if (apiCalls === 1) {
    req.respond({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: sse(["好的，**玻姆诠释**", QUOTED]) });
  } else if (apiCalls === 2) {
    req.respond({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: sse(["好的，**引导方程** 在这里。"]) });
  } else if (apiCalls === 3) {
    req.respond({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: sse(["引导方程是玻姆诠释的运动方程。"]) });
  } else {
    try {
      branchBody = JSON.parse(req.postData());
    } catch {}
    req.respond({ status: 200, contentType: "text/event-stream", headers: corsHeaders, body: sse(["分支对话已建立，继承上游历史继续。"]) });
  }
});

// --- seed: BYOK model active from the start ---
const seed = {
  settings: { activeModelId: "byok-test" },
  byokModels: [
    { id: "byok-test", name: "测试模型", provider: "BYOK", baseUrl: "https://fake.example.com/v1", modelId: "fake-model", apiKey: "sk-test" },
  ],
};
await page.evaluateOnNewDocument((seedStr) => {
  try {
    localStorage.clear();
    localStorage.setItem("explore-onboarded", "1");
    localStorage.setItem("explore-state-v1", seedStr);
  } catch {}
}, JSON.stringify(seed));
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(800);

// A1. welcome tagline (borrowed opener)
const welcomeText = await page.evaluate(() => document.body.textContent || "");
log("A1. welcome tagline shows borrowed opener:", welcomeText.includes("摆脱线性聊天框的限制"));

// A2. guide modal from the chat empty state
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(500);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "使用指南")?.click();
});
await sleep(600);
const guideText = await page.evaluate(() => document.body.textContent || "");
log("A2. guide modal shows borrowed content:",
  ["智能标注", "子卡片", "关联卡片", "分支卡片", "文档阅读", "思维宇宙", "引用回答", "探索路径", "个性化", "开始探索"]
    .every((s) => guideText.includes(s)));
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("开始探索"))?.click();
});
await sleep(400);

// B/C. first message + underline + quote flow
await page.type("textarea.bg-transparent", "什么是 EPR 悖论？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(1500);

const underline = await page.evaluate(() => {
  const chip = document.querySelector("button.term-chip");
  return chip ? getComputedStyle(chip).textDecorationLine : "none";
});
log("B. term chip is underlined:", underline === "underline", `(${underline})`);

// select text in the AI reply → mouseup → floating 引用 button
const quoteButton = await page.evaluate((quoted) => {
  const container = document.querySelector(".ai-message-content");
  if (!container) return false;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = null;
  let idx = -1;
  while (walker.nextNode()) {
    idx = walker.currentNode.textContent?.indexOf(quoted) ?? -1;
    if (idx >= 0) { node = walker.currentNode; break; }
  }
  if (!node) return false;
  const range = document.createRange();
  range.setStart(node, idx);
  range.setEnd(node, idx + quoted.length);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  container.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  return true;
}, QUOTED);
await sleep(300);
const quoteBtnVisible = await page.evaluate(() => !!document.querySelector("[data-quote-btn]"));
log("C1. floating 引用 button appears over selection:", quoteBtnVisible);
await page.evaluate(() => document.querySelector("[data-quote-btn]")?.click());
await sleep(400);
const chipText = await page.evaluate(() => document.querySelector(".quote-chip")?.textContent ?? "");
log("C2. quote chip lands in the input area:", chipText.includes(QUOTED));

await page.type("textarea.bg-transparent", "继续深挖");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(1500);
const sentBubble = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".bg-usermsg")];
  return bubbles.at(-1)?.textContent ?? "";
});
log("C3. sent message carries the quote:", sentBubble.startsWith(`> ${QUOTED}`) && sentBubble.includes("继续深挖"));
const titleOk = await page.evaluate(() => {
  const spans = [...document.querySelectorAll("span")];
  return !spans.some((s) => s.textContent?.startsWith("> ") && s.className.includes("font-bold"));
});
log("C4. project title isn't a quote fragment:", titleOk);

// D. branch card inherits upstream card history (BYOK request body check)
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("玻姆诠释"));
  chip?.click();
});
await sleep(700);
const branchBtn = await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  return [...(card?.querySelectorAll("button") ?? [])].some((b) => b.textContent?.includes("另起炉灶"));
});
log("D1. branch card opened:", branchBtn);
const cardTa = await page.$(".card-container textarea");
await cardTa.type("引导方程是什么？");
await page.keyboard.press("Enter");
await sleep(1500);
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("另起炉灶"))?.click();
});
await sleep(1800);

const msgs = branchBody?.messages ?? [];
const branchReport = {
  apiCalls,
  hasInstruction: msgs.some((m) => m.content?.includes("分支卡片")),
  hasUpstreamCardQ: msgs.some((m) => m.content?.includes("引导方程是什么？")),
  hasPathNode: msgs.some((m) => m.content?.includes("深挖路径节点")),
  lastIsQuestion: msgs.at(-1)?.content?.includes("继续深挖：玻姆诠释") ?? false,
};
log("D2. branch BYOK request inherits upstream history:", JSON.stringify(branchReport));
log("   PASS request body complete:", Object.values(branchReport).slice(1).every(Boolean));

const branchTurn = await page.evaluate(() => {
  const turns = [...document.querySelectorAll(".bg-usermsg")];
  const trails = [...document.querySelectorAll(".explore-trail")];
  const lastTrailChips = [...(trails.at(-1)?.querySelectorAll(".explore-chip") ?? [])].map((c) => c.textContent?.trim());
  return {
    userMsg: turns.at(-1)?.textContent ?? "",
    hasReply: document.body.textContent?.includes("分支对话已建立") ?? false,
    trail: lastTrailChips,
  };
});
log("D3. branch turn rendered:", JSON.stringify(branchTurn));
log("   PASS turn + reply + trail:", branchTurn.userMsg.includes("继续深挖：玻姆诠释") && branchTurn.hasReply && branchTurn.trail.includes("玻姆诠释"));

// D4. turn graph (always-visible panel): parentTurnId persisted + card nodes in the graph
await sleep(300);
const graphState = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("explore-state-v1") || "{}");
  const proj = st.projects?.find((p) => p.turns?.some((t) => t.title === "玻姆诠释"));
  const turns = proj?.turns ?? [];
  const branch = turns.find((t) => t.title === "玻姆诠释");
  const source = turns.find((t) => t.title === "什么是 EPR 悖论？");
  return { branchParent: branch?.parentTurnId, sourceId: source?.id };
});
log("D4. branch turn parentTurnId links to source turn:", graphState.branchParent === graphState.sourceId && !!graphState.sourceId);
const graphUi = await page.evaluate(() => ({
  turnNodes: document.querySelectorAll("[data-turn-node]").length,
  cardTerms: [...document.querySelectorAll("[data-card-node]")].map((n) => n.getAttribute("data-card-node")),
  branchRows: document.querySelectorAll("[aria-label='分支轮次']").length,
}));
log("   tree rendered:", JSON.stringify(graphUi));
log("   PASS tree: 3 turn rows + branch turn nested (⬇️) + card row:",
  graphUi.turnNodes === 3 && graphUi.branchRows >= 1 && graphUi.cardTerms.includes("玻姆诠释"));

await browser.close();
console.log("DONE");
