/**
 * Verify R9 backup/restore feature (完整备份/恢复):
 * E1. 导出完整备份 → 单个 JSON 包（app=explore-backup），含项目/思维节点/文档/文件夹/档案/设置；
 * E2. 导入备份 → 按 id 合并还原（备份项目+本地新项目共存，思维节点/文档/文件夹/术语状态/档案都恢复）；
 * E3. 旧版项目文件（{ title, turns }）导入 → 仍可建项目（兼容）。
 * Usage: node scripts/verify-backup.mjs  (requires dev server on :3000)
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(...m);
const ok = (name, cond, extra = "") =>
  log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " " + JSON.stringify(extra) : ""}`);

const uid = () => "id-" + Math.random().toString(36).slice(2, 10);
const NOW = Date.now();
const richState = {
  settings: { theme: "Warm (温暖)", language: "zh", activeModelId: "offline" },
  projects: [
    {
      id: "bp-1",
      title: "备份项目",
      folder: "研究",
      cloud: false,
      createdAt: NOW - 60000,
      updatedAt: NOW - 10000,
      turns: [
        {
          id: "bt-1",
          title: "什么是量子纠缠？",
          createdAt: NOW - 50000,
          messages: [
            { id: uid(), role: "user", content: "什么是量子纠缠？", createdAt: NOW - 50000 },
            { id: uid(), role: "assistant", content: "**量子纠缠** 是粒子间的非局域关联。", createdAt: NOW - 40000 },
          ],
          explored: [{ term: "量子纠缠", kind: "child", at: NOW - 39000, parentTerm: null }],
        },
        {
          id: "bt-2",
          title: "玻姆诠释",
          kind: "branch",
          parentTurnId: "bt-1",
          branchPointIndex: 1,
          createdAt: NOW - 30000,
          messages: [
            { id: uid(), role: "user", content: "继续深挖：玻姆诠释", createdAt: NOW - 30000 },
            { id: uid(), role: "assistant", content: "**玻姆诠释** 是隐变量理论。", createdAt: NOW - 28000 },
          ],
          explored: [{ term: "玻姆诠释", kind: "branch", at: NOW - 29000, parentTerm: null }],
        },
        {
          id: "bt-3",
          title: "机器学习",
          kind: "diverge",
          divergeSourceId: "bt-1",
          createdAt: NOW - 20000,
          messages: [
            { id: uid(), role: "user", content: "发散话题：机器学习（平行会话）", createdAt: NOW - 20000 },
            { id: uid(), role: "assistant", content: "**机器学习** 让程序从数据中学习规律。", createdAt: NOW - 18000 },
          ],
        },
      ],
    },
  ],
  activeProjectId: "bp-1",
  thoughtNodes: [{ id: "tn-1", subject: "量子纠缠", content: "粒子间不可分割的关联", createdAt: NOW - 10000, category: "概念", status: "validated" }],
  termStates: { "量子纠缠": "mastered", "玻姆诠释": "asked" },
  documents: [{ id: "doc-1", name: "论文.md", kind: "md", content: "量子纠缠综述", addedAt: NOW - 5000 }],
  folders: ["研究"],
  profile: { name: "测试用户", email: "test@example.com", avatarColor: "#13e425" },
  smartMode: false,
};

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: "new",
  args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--disable-gpu", "--no-sandbox", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const seed = (s) =>
  page.evaluateOnNewDocument((seedStr) => {
    try {
      localStorage.clear();
      localStorage.setItem("explore-onboarded", "1");
      localStorage.setItem("explore-state-v1", seedStr);
    } catch {}
  }, JSON.stringify(s));

/* ================= E1. 导出完整备份 ================= */
log("--- E1. 导出完整备份 ---");
await seed(richState);
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(900);

const backup = await page.evaluate(async () => {
  return await new Promise((resolve) => {
    const origCreate = URL.createObjectURL.bind(URL);
    const origClick = HTMLAnchorElement.prototype.click;
    window.__blob = null;
    URL.createObjectURL = (b) => {
      window.__blob = b;
      return "blob:stub";
    };
    HTMLAnchorElement.prototype.click = function () {};
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("导出完整备份"));
    btn?.click();
    setTimeout(async () => {
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
      resolve(window.__blob ? JSON.parse(await window.__blob.text()) : null);
    }, 400);
  });
});
ok("E1a. 导出按钮产出备份包（app=explore-backup v1）",
  !!backup && backup.app === "explore-backup" && backup.version === 1, { app: backup?.app });
ok("E1b. 备份包含项目（含分支/发散轮次）",
  (() => {
    const bp = backup?.data?.projects?.find((p) => p.id === "bp-1");
    return (
      !!bp &&
      bp.turns.some((t) => t.kind === "branch") &&
      bp.turns.some((t) => t.kind === "diverge")
    );
  })());
ok("E1c. 备份含思维节点/文档/文件夹/档案/设置",
  backup?.data?.thoughtNodes?.length === 1 &&
    backup?.data?.documents?.length === 1 &&
    backup?.data?.folders?.includes("研究") &&
    backup?.data?.profile?.name === "测试用户" &&
    backup?.data?.termStates?.["量子纠缠"] === "mastered" &&
    backup?.data?.settings?.theme === "Warm (温暖)");

/* ================= E2. 导入备份 → 合并还原 ================= */
log("--- E2. 导入备份合并还原 ---");
const localState = {
  settings: {},
  projects: [{ id: "local-1", title: "本地新项目", folder: "本地", cloud: false, createdAt: NOW, updatedAt: NOW, turns: [] }],
  activeProjectId: "local-1",
  folders: ["本地"],
};
await seed(localState);
await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(900);

const tmpDir = mkdtempSync(path.join(tmpdir(), "explore-backup-"));
const backupPath = path.join(tmpDir, "backup.json");
writeFileSync(backupPath, JSON.stringify(backup));
const input = await page.$('input[type="file"][accept*="json"]');
await input.uploadFile(backupPath);
await sleep(1200);

const merged = await page.evaluate(() => JSON.parse(localStorage.getItem("explore-state-v1") || "{}"));
const projTitles = (merged.projects ?? []).map((p) => p.title);
ok("E2a. 项目按 id 合并：备份项目 + 本地新项目共存",
  projTitles.includes("备份项目") && projTitles.includes("本地新项目"), projTitles);
ok("E2b. 思维节点/文档/术语状态恢复",
  (merged.thoughtNodes ?? []).some((n) => n.id === "tn-1") &&
    (merged.documents ?? []).some((d) => d.id === "doc-1") &&
    merged.termStates?.["量子纠缠"] === "mastered");
ok("E2c. 文件夹并集（研究 + 本地）+ 档案恢复",
  (merged.folders ?? []).includes("研究") && (merged.folders ?? []).includes("本地") &&
    merged.profile?.name === "测试用户");
const toastShown = await page.evaluate(() => document.body.textContent?.includes("已恢复备份") ?? false);
ok("E2d. 导入后 toast 提示恢复结果", toastShown);

/* ================= E3. 旧版项目文件兼容 ================= */
log("--- E3. 旧版项目文件导入 ---");
const legacyPath = path.join(tmpDir, "legacy.json");
writeFileSync(legacyPath, JSON.stringify({
  title: "旧版项目",
  turns: [
    { id: uid(), title: "旧轮次", createdAt: NOW, messages: [
      { id: uid(), role: "user", content: "你好", createdAt: NOW },
      { id: uid(), role: "assistant", content: "你好！", createdAt: NOW },
    ] },
  ],
}));
const input2 = await page.$('input[type="file"][accept*="json"]');
await input2.uploadFile(legacyPath);
await sleep(1200);
const afterLegacy = await page.evaluate(() => JSON.parse(localStorage.getItem("explore-state-v1") || "{}"));
ok("E3. 旧版 { title, turns } 文件仍可导入建项目",
  (afterLegacy.projects ?? []).some((p) => p.title === "旧版项目" && p.turns?.length === 1),
  (afterLegacy.projects ?? []).map((p) => p.title));

// 坏文件：导入无效 JSON 应提示失败且不崩
const badPath = path.join(tmpDir, "bad.json");
writeFileSync(badPath, "{not json");
const input3 = await page.$('input[type="file"][accept*="json"]');
await input3.uploadFile(badPath);
await sleep(800);
const badToast = await page.evaluate(() => document.body.textContent?.includes("导入失败") ?? false);
ok("E4. 无效 JSON 提示导入失败", badToast);

await browser.close();
console.log("DONE");
