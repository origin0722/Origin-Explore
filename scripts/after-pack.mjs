// electron-builder afterPack 钩子：把组装好的 Next 运行目录（含 node_modules）
// 纯拷贝进 appOutDir/resources/next ——绕过 electron-builder 拷贝时剥离 node_modules 的行为。
import fs from "node:fs";
import path from "node:path";

export default async function afterPack(context) {
  const { appOutDir } = context;
  const src = path.resolve(".packaging/next");
  const dest = path.join(appOutDir, "resources", "next");
  if (!fs.existsSync(path.join(src, "server.js"))) {
    throw new Error(`afterPack: staging 缺失 ${src}，请先运行 scripts/package-app.mjs 的组装步骤`);
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log(
    `afterPack: next runtime -> ${dest} (node_modules=${fs.existsSync(path.join(dest, "node_modules"))})`
  );
}
