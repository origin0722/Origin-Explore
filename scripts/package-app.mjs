// 打包桌面应用：next build（standalone）→ 组装运行目录（含 node_modules）→ electron-builder 安装版（NSIS setup.exe）。
// 产物：release/OriginExplore-<version>-setup.exe。
// 注：portable 已废弃（不再产出）。
import { execSync } from "node:child_process";
import fs from "node:fs";

const step = (msg) => console.log(`\n=== ${msg} ===`);
const STAGING = ".packaging/next";

step("1/4 图标");
if (!fs.existsSync("build/icon.png")) {
  // 无自定义图标时生成默认品牌图标；用户放入 build/icon.png 后不再覆盖。
  execSync("node scripts/gen-icon.mjs", { stdio: "inherit" });
} else {
  console.log("使用现有 build/icon.png（跳过默认图标生成）");
}

if (!process.env.SKIP_BUILD) {
  step("2/4 next build（standalone）");
  execSync("npm run build", { stdio: "inherit" });
}

// electron-builder 拷贝 extraResources 时会剥掉 node_modules；
// 先组装完整运行目录（standalone + node_modules + static + public），再整体拷贝。
step("3/4 组装运行目录");
fs.rmSync(STAGING, { recursive: true, force: true });
fs.mkdirSync(STAGING, { recursive: true });
fs.cpSync(".next/standalone", STAGING, { recursive: true });
fs.cpSync(".next/static", `${STAGING}/.next/static`, { recursive: true });
if (fs.existsSync("public")) {
  fs.cpSync("public", `${STAGING}/public`, { recursive: true });
}
console.log(`staged: ${STAGING} (server.js=${fs.existsSync(`${STAGING}/server.js`)}, node_modules=${fs.existsSync(`${STAGING}/node_modules`)})`);

// 运行时瘦身：删除 staging 中用不到的 sharp/@img（图标脚本才用，服务器不加载）
for (const p of ["node_modules/sharp", "node_modules/@img"]) {
  const target = `${STAGING}/${p}`;
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`staging: removed ${p}`);
  }
}

step("4/4 electron-builder nsis");
execSync("npx electron-builder --win nsis", { stdio: "inherit" });

console.log("\n完成：release/ 目录下即为可分发安装包（setup.exe）");
