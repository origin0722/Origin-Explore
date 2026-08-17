// 一键发布：预检 -> 打 tag + 建 GitHub Release（走 gh API，规避 git push tag 网络抖动）
// -> 打包安装包（ELECTRON_MIRROR 常驻）-> 上传 -> 清旧版安装包。
// 对外动作前停一下确认。版本号与 CHANGELOG 由人先行准备好（保留 semver 判断 + 变更措辞的人为环节）。
//
// 用法：
//   npm run release                    默认全流程，对外动作前确认
//   npm run release -- --skip-build    跳过打包（setup.exe 已备好）
//   npm run release -- --dry-run       只预检 + 打印计划，不执行对外动作
//   npm run release -- --no-cleanup    不清旧版安装包
//   npm run release -- --yes          跳过确认
//   npm run release -- --skip-check    跳过 typecheck 预检
//   npm run release -- --title "..."  release 标题（默认 v<version>，避免含双引号）
//   npm run release -- --notes-file p notes 用文件而非 CHANGELOG 抽取
import { execSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const REPO_SLUG = "origin0722/Origin-Explore";
const ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkg.version;
const tagName = `v${version}`;
const setupExe = `OriginExplore-${version}-setup.exe`;

const args = process.argv.slice(2);
const has = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const skipBuild = has("--skip-build");
const skipCheck = has("--skip-check");
const noCleanup = has("--no-cleanup");
const autoYes = has("--yes");
const dryRun = has("--dry-run");
const title = opt("--title") || tagName;
const notesFile = opt("--notes-file");

const step = (m) => console.log(`\n=== ${m} ===`);
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const runQuiet = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
function die(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// 从 CHANGELOG.md 抽取某版本段落作为 release notes：
// 匹配 `## [x.y.z] - <date>`，截到下一个 `## [` 版本头或首个 `[x.y.z]: ` 链接引用行。
function extractChangelog(ver) {
  const md = fs.readFileSync("CHANGELOG.md", "utf8").split(/\r?\n/);
  const headerRe = new RegExp(`^## \\[${ver.replace(/\./g, "\\.")}\\] - `);
  const start = md.findIndex((l) => headerRe.test(l));
  if (start < 0) return null;
  let end = md.length;
  for (let i = start + 1; i < md.length; i++) {
    if (/^## \[/.test(md[i]) || /^\[\d+\.\d+\.\d+\]: /.test(md[i])) {
      end = i;
      break;
    }
  }
  return md.slice(start + 1, end).join("\n").trimEnd();
}

function semverCmp(a, b) {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

async function confirm(msg) {
  if (autoYes) return;
  const rl = readline.createInterface({ input, output });
  const ans = await rl.question(`\n${msg}\n回车继续，Ctrl+C 取消: `);
  rl.close();
  if (ans !== "") die("已取消");
}

async function main() {
  console.log(`发布 ${tagName}（${REPO_SLUG}）`);

  // ===== A. 预检 =====
  step("预检");
  const status = runQuiet("git status --porcelain -uno");
  if (status) die(`工作区有未提交改动，请先提交：\n${status.slice(0, 400)}`);
  const branch = runQuiet("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") die(`当前分支 ${branch}，请在 main 上发布`);

  let notes;
  if (notesFile) {
    if (!fs.existsSync(notesFile)) die(`notes 文件不存在: ${notesFile}`);
    notes = fs.readFileSync(notesFile, "utf8").trim();
  } else {
    notes = extractChangelog(version);
    if (!notes) die(`CHANGELOG.md 未找到 [${version}] 段落，请先写好该版本变更`);
  }

  if (!skipCheck) {
    step("typecheck 预检");
    run("npm run typecheck");
  }

  try {
    runQuiet("gh auth status");
  } catch {
    die("gh 未认证，请先 gh auth login");
  }

  let releaseExists = false;
  try {
    runQuiet(`gh release view ${tagName}`);
    releaseExists = true;
  } catch {
    /* release 不存在，正常 */
  }
  if (releaseExists) {
    if (dryRun) console.log(`（注意：release ${tagName} 已存在，正式运行会中止）`);
    else die(`release ${tagName} 已存在，如需重发请先 gh release delete ${tagName}`);
  }

  // 找前一个版本（用于清旧版）
  let prevTag = null;
  if (!noCleanup) {
    try {
      const list = runQuiet('gh release list --limit 50 --json tagName --jq ".[].tagName"')
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean);
      prevTag = list.filter((t) => semverCmp(t, tagName) < 0).sort(semverCmp).pop() || null;
    } catch {
      console.log("（无法获取 release 列表，将跳过清旧版）");
    }
  }

  // ===== B. 计划 + 确认 =====
  const prevSetup = prevTag ? `OriginExplore-${prevTag.replace(/^v/, "")}-setup.exe` : null;
  const plan = [
    `版本: ${version}  (tag ${tagName})`,
    `标题: ${title}`,
    `notes: ${notesFile || "CHANGELOG.md 抽取"}`,
    `步骤:`,
    `  1. git push origin main`,
    `  2. gh release create ${tagName} --title "${title}" --notes-file <tmp>`,
    `  3. ${skipBuild ? "(跳过打包)" : "ELECTRON_MIRROR=... npm run package:app"}`,
    `  4. gh release upload ${tagName} release/${setupExe}`,
    `  5. ${prevTag ? `清旧版 ${prevTag} 安装包 (远端 ${prevSetup} + 本地)` : "(不清旧版)"}`,
  ].join("\n");
  console.log(`\n--- 发布计划 ---\n${plan}`);
  console.log(`\n--- release notes 预览 ---\n${notes.slice(0, 500)}${notes.length > 500 ? "\n..." : ""}`);

  if (dryRun) {
    console.log("\n（--dry-run：不执行对外动作）");
    return;
  }

  await confirm("确认发布？");

  // ===== C. 执行 =====
  step("push main");
  try {
    run("git push origin main");
  } catch {
    die("git push origin main 失败，请检查网络或是否有未推送提交");
  }

  fs.mkdirSync("release", { recursive: true });
  const tmpNotes = `release/.release-notes-${version}.md`;
  fs.writeFileSync(tmpNotes, notes, "utf8");

  step("建 release（gh API 创建 tag，规避 git push tag 网络抖动）");
  try {
    run(`gh release create ${tagName} --title "${title}" --notes-file "${tmpNotes}"`);
  } catch (e) {
    fs.rmSync(tmpNotes, { force: true });
    die(`gh release create 失败: ${(e.message || "").slice(0, 200)}`);
  }

  if (!skipBuild) {
    step("打包安装包（ELECTRON_MIRROR 常驻）");
    try {
      execSync("npm run package:app", { stdio: "inherit", env: { ...process.env, ELECTRON_MIRROR } });
    } catch {
      die(
        `打包失败，release ${tagName} 已建但无 asset。\n修复后用 --skip-build 重跑上传（保留刚建的 release）：\n  npm run release -- --skip-build --no-cleanup`
      );
    }
  }

  step("上传到 release");
  if (!fs.existsSync(`release/${setupExe}`)) {
    die(`release/${setupExe} 不存在，请先打包或检查 --skip-build`);
  }
  run(`gh release upload ${tagName} release/${setupExe}`);

  if (!noCleanup && prevTag && prevSetup) {
    step(`清旧版安装包 ${prevTag}`);
    try {
      run(`gh release delete-asset ${prevTag} ${prevSetup} --yes`);
      console.log(`已删远端 ${prevTag} / ${prevSetup}`);
    } catch {
      console.log(`远端 ${prevTag} 无 ${prevSetup}，跳过`);
    }
    for (const f of [prevSetup, `${prevSetup}.blockmap`]) {
      if (fs.existsSync(`release/${f}`)) {
        fs.rmSync(`release/${f}`);
        console.log(`已删本地 release/${f}`);
      }
    }
  }

  fs.rmSync(tmpNotes, { force: true });
  try {
    runQuiet("git fetch --tags origin");
  } catch {
    console.log("（git fetch --tags 失败，远端 tag 已建，本地可稍后 fetch）");
  }

  console.log(`\n完成：${tagName} 已发布 https://github.com/${REPO_SLUG}/releases/tag/${tagName}`);
}

main().catch((e) => die(`未预期错误: ${(e.message || e).toString().slice(0, 300)}`));
