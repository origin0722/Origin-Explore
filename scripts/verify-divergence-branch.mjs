/**
 * Verify R9 features: 发散卡片 (divergence card) + 分支卡片 (branch card) upgrades.
 * A) 发散卡片：术语卡片上"🪢 发散对话 · 平行会话" → kind="diverge" 轮次 + 卡片树同层右侧节点
 *    + 卡片栈保留（不打断当前对话）；
 * B) 分支卡片：⛓ 分支点调整（"✂️ 在此分支"→ 分割线移动）+ 📋 分支点前总结面板；
 * C) 验证话术：离线 "请问当前的相关主题是什么？" / "……分条陈述。" 得到应答。
 * Usage: node scripts/verify-divergence-branch.mjs  (requires dev server on :3000)
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
const t1 = { id: uid(), title: "什么是叠加态？", createdAt: NOW - 20000, messages: [
  { id: uid(), role: "user", content: "什么是叠加态？", createdAt: NOW - 20000 },
  { id: uid(), role: "assistant", content: "**叠加态** 是量子力学核心概念，粒子可同时处于多个状态的叠加，直到被测量。", createdAt: NOW - 18000 },
] };
const t2 = { id: uid(), title: "玻姆诠释是什么？", createdAt: NOW - 15000, messages: [
  { id: uid(), role: "user", content: "玻姆诠释是什么？", createdAt: NOW - 15000 },
  { id: uid(), role: "assistant", content: "**玻姆诠释** 是保留粒子确定轨迹的非局域隐变量理论，值得展开聊聊。", createdAt: NOW - 13000 },
] };
const proj = { id: uid(), title: "R9 验证", folder: null, cloud: false, createdAt: NOW - 30000, updatedAt: NOW, turns: [t1, t2] };
const seed = { settings: { activeModelId: "offline" }, projects: [proj], activeProjectId: proj.id };

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--disable-gpu", "--no-sandbox", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument((seedStr) => {
  try {
    localStorage.clear();
    localStorage.setItem("explore-onboarded", "1");
    localStorage.setItem("explore-state-v1", seedStr);
  } catch {}
}, JSON.stringify(seed));
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(800);

const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("explore-state-v1") || "{}"));
const clickByText = async (sel, text) =>
  page.evaluate(({ sel, text }) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els.find((e) => e.textContent?.includes(text));
    el?.click();
    return !!el;
  }, { sel, text });
const clickByAria = async (label) =>
  page.evaluate((label) => {
    const el = document.querySelector(`[aria-label="${label}"]`);
    el?.click();
    return !!el;
  }, label);

/* ================= A. 发散卡片 ================= */
log("--- A. 发散卡片 ---");
const divergeBtnSeen = await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("叠加态"));
  chip?.click();
  return !!chip;
});
await sleep(700);
const divergeBtn = await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  return [...(card?.querySelectorAll("button") ?? [])].some((b) => b.textContent?.includes("发散对话"));
});
ok("A1. 术语卡片上有「🪢 发散对话」按钮", divergeBtnSeen && divergeBtn);

await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("发散对话"))?.click();
});
await sleep(2400); // offline: 500ms delay + typewriter reply

const divergeState = await state();
const st = divergeState.projects?.find((p) => p.id === proj.id);
const divergeTurn = st?.turns?.find((t) => t.kind === "diverge");
ok("A2. 生成 kind=diverge 轮次（divergeSourceId=来源轮次）",
  !!divergeTurn && divergeTurn.divergeSourceId === t1.id && divergeTurn.title === "叠加态",
  { title: divergeTurn?.title, source: divergeTurn?.divergeSourceId });
ok("A3. 发散轮次有自己的对话（种子问题 + 回复）",
  (divergeTurn?.messages?.length ?? 0) >= 2 && divergeTurn.messages.some((m) => m.content.includes("发散话题")));

const stackKept = await page.evaluate(() => document.querySelectorAll(".card-container").length);
ok("A4. 卡片栈保留（不打断当前对话）", stackKept >= 1, { stackKept });

const divergeNode = await page.evaluate(() => {
  const row = document.querySelector("[data-diverge='true']");
  if (!row) return null;
  const src = row.previousElementSibling;
  return {
    text: row.textContent?.trim(),
    padLeft: row.style.paddingLeft,
    marginLeft: row.style.marginLeft,
    srcPadLeft: src?.style.paddingLeft,
  };
});
ok("A5. 卡片树：发散节点紧跟来源节点之后、同层且右移一档",
  !!divergeNode && divergeNode.text?.includes("叠加态") &&
    parseFloat(divergeNode.padLeft) > parseFloat(divergeNode.srcPadLeft),
  divergeNode);

// A6. 同一张卡上再次点"发散对话" → 去重：不新建，复用并跳转
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("发散对话"))?.click();
});
await sleep(800);
const dedupeState = await state();
const divergeCount = dedupeState.projects
  ?.find((p) => p.id === proj.id)
  ?.turns?.filter((t) => t.kind === "diverge" && t.divergeSourceId === t1.id && t.title === "叠加态").length;
const divergeNodeCount = await page.evaluate(
  () => document.querySelectorAll("[data-diverge='true']").length
);
const reuseToast = await page.evaluate(
  () => document.body.textContent?.includes("已有同主题发散卡片") ?? false
);
ok("A6. 重复点击去重：不新建重复发散卡片，复用并跳转",
  divergeCount === 1 && divergeNodeCount === 1 && reuseToast,
  { divergeCount, divergeNodeCount, reuseToast });

/* ================= B. 分支卡片：分支点 + 总结 ================= */
log("--- B. 分支卡片 ---");
// 关闭发散卡片打开时的术语卡，再开玻姆诠释（branch kind）卡片
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.getAttribute("title") === "关闭")?.click();
});
await sleep(500);
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("玻姆诠释"));
  chip?.click();
});
await sleep(700);
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("另起炉灶"))?.click();
});
await sleep(2400); // branch turn + offline reply

let st2 = await state();
let branchTurn = st2.projects?.find((p) => p.id === proj.id)?.turns?.find((t) => t.kind === "branch");
ok("B1. 分支轮次 kind=branch + parentTurnId + 默认分支点（上游最后一条）",
  !!branchTurn && branchTurn.parentTurnId === t2.id && branchTurn.branchPointIndex === 1,
  { parent: branchTurn?.parentTurnId, point: branchTurn?.branchPointIndex });

const branchHeaderBtns = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  return {
    fork: !!btns.find((b) => b.getAttribute("aria-label") === "查看/调整分支点"),
    summary: !!btns.find((b) => b.getAttribute("aria-label") === "总结分支点前的上游对话"),
  };
});
ok("B2. 分支轮次头部有 ⛓ 分支点 / 📋 总结 按钮", branchHeaderBtns.fork && branchHeaderBtns.summary);

// 进入分支点调整模式
await clickByAria("查看/调整分支点");
await sleep(400);
const editMode = await page.evaluate(() => ({
  banner: document.body.textContent?.includes("正在调整") ?? false,
  cutBtns: [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("在此分支")).length,
}));
ok("B3. 调整模式：上游提示条 + 每条消息旁的「✂️ 在此分支」", editMode.banner && editMode.cutBtns >= 2, editMode);

// 点击第一条消息旁的"在此分支" → 分支点移到 0
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("在此分支"));
  btn?.click();
});
await sleep(500);
st2 = await state();
branchTurn = st2.projects?.find((p) => p.id === proj.id)?.turns?.find((t) => t.kind === "branch");
ok("B4. 分支点调整生效（branchPointIndex=0）", branchTurn?.branchPointIndex === 0, { point: branchTurn?.branchPointIndex });
const divider = await page.evaluate(() => document.body.textContent?.includes("分支点：从这里分出「玻姆诠释」分支") ?? false);
ok("B5. 上游轮次出现分支点分割线", divider);

// 生成总结
await clickByAria("总结分支点前的上游对话");
await sleep(500);
const summary = await page.evaluate(() => {
  const panel = [...document.querySelectorAll("div")].find((d) => d.textContent?.includes("分支点前对话总结"));
  return panel?.textContent ?? "";
});
ok("B6. 分支卡片显示「分支点前对话总结」面板",
  summary.includes("分支点前对话总结") && summary.includes("上游主题") && summary.includes("1. **我**"),
  summary.slice(0, 60));

// B7. 再次开卡片点"另起炉灶" → 去重：不新建重复分支卡片，复用并跳转
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("玻姆诠释"));
  chip?.click();
});
await sleep(700);
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("另起炉灶"))?.click();
});
await sleep(800);
st2 = await state();
const branchCount = st2.projects
  ?.find((p) => p.id === proj.id)
  ?.turns?.filter((t) => t.kind === "branch" && t.parentTurnId === t2.id && t.title === "玻姆诠释").length;
const branchReuseToast = await page.evaluate(
  () => document.body.textContent?.includes("已有同主题分支卡片") ?? false
);
ok("B7. 分支卡片重复创建去重（同一来源+同标题只保留一个）",
  branchCount === 1 && branchReuseToast, { branchCount, branchReuseToast });

/* ================= C. 验证话术（离线知识库） ================= */
log("--- C. 验证话术 ---");
const ask = async (q) => {
  await page.type("textarea.bg-transparent", q);
  await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
  await sleep(2200);
  return page.evaluate(() => {
    const bubbles = [...document.querySelectorAll(".ai-message-content")];
    return bubbles.at(-1)?.textContent ?? "";
  });
};

const topicReply = await ask("请问当前的相关主题是什么？");
ok("C1. 「请问当前的相关主题是什么？」→ 回答当前主题", topicReply.includes("当前对话的主题"), topicReply.slice(0, 40));

const listReply = await ask("请问我们目前为止进行了哪些对话内容？请分条陈述。");
ok("C2. 「……分条陈述。」→ 分条列出对话内容",
  listReply.includes("条对话") && listReply.includes("我：") && listReply.includes("AI："),
  listReply.slice(0, 60));

await browser.close();
console.log("DONE");
