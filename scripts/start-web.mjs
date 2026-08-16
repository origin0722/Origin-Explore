// 本地预览网站（生产构建）：next build 的 standalone 产物不含 .next/static，
// 直接跑 server.js 会 CSS/JS 全部 404（页面只剩深色背景=黑屏）。
// 本脚本先补拷 static，再启动服务器。
// 用法：npm run start:web   （端口可用环境变量 PORT 覆盖，默认 3210）
import { execSync } from "node:child_process";
import fs from "node:fs";

const STAGING = ".next/standalone";
const SRC = ".next/static";

if (!fs.existsSync(`${STAGING}/server.js`)) {
  console.error("找不到 .next/standalone/server.js，请先运行 npm run build");
  process.exit(1);
}
if (fs.existsSync(SRC) && !fs.existsSync(`${STAGING}/.next/static`)) {
  fs.cpSync(SRC, `${STAGING}/.next/static`, { recursive: true });
  console.log("static -> .next/standalone/.next/static");
}

const PORT = process.env.PORT || "3210";
console.log(`OriginExplore 网站: http://127.0.0.1:${PORT}`);
execSync(`node ${STAGING}/server.js`, {
  stdio: "inherit",
  env: { ...process.env, PORT, HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
});
