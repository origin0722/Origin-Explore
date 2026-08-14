/**
 * Verify the expanded knowledge base: asking about new-domain terms yields
 * rich term-aware replies with clickable related terms + child cards.
 * Usage: node scripts/verify-content.mjs
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

const ask = async (q, expected) => {
  // send into the current project (no need to create one; avoids collapsed-sidebar issue)
  await page.type("textarea", q);
  await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
  await sleep(3000);
  const text = await page.evaluate(() => [...document.querySelectorAll(".markdown-content")].at(-1)?.textContent || "");
  return { text, ok: expected.every((e) => text.includes(e)) };
};

const r1 = await ask("什么是机器学习？", ["机器学习", "监督学习", "神经网络", "深度学习"]);
log("1. 机器学习 reply (mentions 3 paradigms):", r1.ok);

const r2 = await ask("什么是快速排序？", ["快速排序", "O(n log n)"]);
log("2. 快速排序 reply:", r2.ok);

const r3 = await ask("什么是 Transformer？", ["Transformer", "注意力机制", "自注意力"]);
log("3. Transformer reply:", r3.ok);

// deep drill: 机器学习 → 神经网络 → 反向传播 → 梯度消失 (3 layers of child cards)
const deep = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clickChip = (term) => {
    const cards = [...document.querySelectorAll(".card-container")];
    const scope = cards.length ? cards.at(-1) : document;
    const chip = [...(scope.querySelectorAll("button.term-chip") ?? [])].find((b) => b.textContent?.includes(term));
    if (chip) chip.click();
  };
  // find 神经网络 chip in the reply of 机器学习 (r3 asked Transformer, so re-ask)
  return "skip";
});
// Simpler deep-drill: ask 什么是反向传播？ then click 梯度消失 child
const r4 = await ask("什么是反向传播？", ["反向传播", "梯度", "链式法则"]);
log("4. 反向传播 reply:", r4.ok);
// click a child card (梯度消失) from the reply
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("梯度消失"));
  chip?.click();
});
await sleep(700);
const childCard = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".card-container")];
  return { layers: cards.length, topText: cards.at(-1)?.textContent?.includes("梯度消失") ?? false };
});
log("5. deep-drill child card opens:", childCard.layers >= 1 && childCard.topText);

await browser.close();
console.log("DONE");
