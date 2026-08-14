/**
 * Verify per-turn exploration trails + Mind Universe real relation edges:
 * 1) click a bold term in the main reply → trail chip appears for this turn;
 * 2) inside the card, ask + click another bold term → trail gains a chained
 *    chip (arrow + kind icon), persisted with parentTerm;
 * 3) collect cards → thought nodes get parentSubject (real relations);
 * 4) re-open from a trail chip → no duplicate recording;
 * 5) branch card → new turn's trail starts with the branch term.
 * Usage: node scripts/verify-exploration.mjs
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

const savedState = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("explore-state-v1") || "{}"));

// --- setup: new project, ask a question ---------------------------------
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
});
await sleep(400);
await page.type("textarea", "什么是量子纠缠？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);

// 1. click the first bold term that isn't the question's own term
const termA = await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find(
    (b) => (b.textContent?.trim() ?? "") !== "量子纠缠"
  );
  if (!chip) return null;
  const t = chip.textContent?.trim() ?? "";
  chip.click();
  return t;
});
log("1. clicked main term:", JSON.stringify(termA));
await sleep(700);
const trail1 = await page.evaluate(() => {
  const trail = document.querySelector(".explore-trail");
  const chips = [...(trail?.querySelectorAll(".explore-chip") ?? [])].map((c) => c.textContent?.trim());
  return chips;
});
log("   trail after first card:", JSON.stringify(trail1));
log("   PASS trail has exactly the clicked term:", Array.isArray(trail1) && trail1.length === 1 && trail1[0] === termA);

// 2. ask inside the card, then click another bold term → chained trail
const cardTa = await page.$(".card-container textarea");
await cardTa.type("什么是量子比特？");
await page.keyboard.press("Enter");
await sleep(3000);
const termB = await page.evaluate((termA) => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  const chip = [...(card?.querySelectorAll("button.term-chip") ?? [])].find(
    (b) => (b.textContent?.trim() ?? "") !== termA
  );
  if (!chip) return null;
  const t = chip.textContent?.trim() ?? "";
  chip.click();
  return t;
}, termA);
log("2. clicked card term:", JSON.stringify(termB));
await sleep(700);
const trail2 = await page.evaluate(() => {
  const trail = document.querySelector(".explore-trail");
  const chips = [...(trail?.querySelectorAll(".explore-chip") ?? [])].map((c) => c.textContent?.trim());
  const arrow = !!trail?.querySelector("span") && trail.textContent.includes("→");
  return { chips, arrow };
});
const icons = ["↗️", "➡️", "⬇️"];
log("   trail after child card:", JSON.stringify(trail2));
log("   PASS chain 2 chips with arrow:", trail2.chips.length === 2 && trail2.chips[0] === termA && (trail2.chips[1] ?? "").includes(termB) && trail2.arrow);
log("   PASS 2nd chip shows kind icon:", icons.some((ic) => (trail2.chips[1] ?? "").includes(ic)));

// persisted explored entries with parentTerm
await sleep(400);
const st2 = await savedState();
const turn1 = st2.projects?.find((p) => p.turns?.some((t) => (t.explored ?? []).length > 0))?.turns.find((t) => (t.explored ?? []).length > 0);
const explored = turn1?.explored ?? [];
log("   persisted explored:", JSON.stringify(explored.map((e) => ({ term: e.term, kind: e.kind, parentTerm: e.parentTerm }))));
log("   PASS second entry links to first term:", explored.length === 2 && explored[1].term === termB && explored[1].parentTerm === termA);

// 3. collect both cards → thought nodes carry parentSubject (real relation)
const collectTop = async () => {
  await page.evaluate(() => {
    const card = [...document.querySelectorAll(".card-container")].at(-1);
    [...(card?.querySelectorAll("button") ?? [])].find((b) => b.title?.includes("收录进思维宇宙"))?.click();
  });
  await sleep(400);
};
await collectTop(); // card B
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.title === "关闭")?.click();
});
await sleep(500); // closing animation
await collectTop(); // card A
const st3 = await savedState();
const nodes = st3.thoughtNodes ?? [];
const nodeB = nodes.find((n) => n.subject === termB);
const nodeA = nodes.find((n) => n.subject === termA);
log("3. collected nodes:", JSON.stringify(nodes.map((n) => ({ subject: n.subject, parentSubject: n.parentSubject ?? null }))));
log("   PASS termB links to termA:", !!nodeB && nodeB.parentSubject === termA);
log("   PASS termA is a root:", !!nodeA && !nodeA.parentSubject);

// 4. re-open from a trail chip → no duplicate recording
await page.evaluate((termB) => {
  const chip = [...document.querySelectorAll(".explore-chip")].find((c) => c.textContent?.includes(termB));
  chip?.click();
}, termB);
await sleep(700);
const reopen = await page.evaluate(() => ({
  cards: document.querySelectorAll(".card-container").length,
  chips: document.querySelectorAll(".explore-chip").length,
}));
const st4 = await savedState();
const exploredAfter = st4.projects?.find((p) => p.turns?.some((t) => (t.explored ?? []).length > 0))?.turns.find((t) => (t.explored ?? []).length > 0)?.explored ?? [];
log("4. reopened card layers:", reopen.cards, "| trail chips:", reopen.chips, "| persisted entries:", exploredAfter.length);
log("   PASS reopen keeps trail unchanged:", reopen.cards === 2 && reopen.chips === 2 && exploredAfter.length === 2);

// 5. branch card → new turn's trail starts with the branch term.
// The main reply is a glossary hit (no EPR chip), so ask a fresh question
// whose tree reply lists the branch term 玻姆诠释 as a clickable child.
await (await page.$("textarea.bg-transparent")).type("什么是 EPR 悖论？");
await page.keyboard.down("Control"); await page.keyboard.press("Enter"); await page.keyboard.up("Control");
await sleep(3000);
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("button.term-chip")].find((b) => b.textContent?.includes("玻姆诠释"));
  chip?.click();
});
await sleep(700);
const branchVisible = await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  return [...(card?.querySelectorAll("button") ?? [])].some((b) => b.textContent?.includes("另起炉灶"));
});
log("5. branch card opened:", branchVisible);
await page.evaluate(() => {
  const card = [...document.querySelectorAll(".card-container")].at(-1);
  [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("另起炉灶"))?.click();
});
await sleep(800);
const branchTurn = await page.evaluate(() => {
  const trails = [...document.querySelectorAll(".explore-trail")];
  const last = trails.at(-1);
  const chips = [...(last?.querySelectorAll(".explore-chip") ?? [])].map((c) => c.textContent?.trim());
  return { turnCount: trails.length, chips };
});
log("   new turn trail:", JSON.stringify(branchTurn));
const st5 = await savedState();
const branchTurnData = st5.projects
  ?.flatMap((p) => p.turns ?? [])
  .find((t) => t.title === "玻姆诠释");
log("   persisted branch turn explored:", JSON.stringify((branchTurnData?.explored ?? []).map((e) => ({ term: e.term, kind: e.kind }))));
log("   PASS branch turn trail starts with branch term:",
  branchTurn.turnCount === 3 &&
  branchTurn.chips.length === 1 &&
  branchTurn.chips[0] === "玻姆诠释" &&
  branchTurnData?.explored?.[0]?.kind === "branch");

// 6. mindscape panel shows the parent link
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "打开思维宇宙")?.click();
});
await sleep(500);
const panelText = await page.evaluate(() => document.body.textContent || "");
log("6. mindscape panel shows 深挖自 termA:", panelText.includes(`深挖自「${termA}」`));

await browser.close();
console.log("DONE");
