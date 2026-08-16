// electron-builder afterPack 钩子：把组装好的 Next 运行目录（含 node_modules）
// 纯拷贝进 appOutDir/resources/next ——绕过 electron-builder 拷贝时剥离 node_modules 的行为。
// 同时删除运行时用不到的 WebGPU 着色器编译器 DLL（应用只用 WebGL，保留软件渲染 DLL）。
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

  // 删除 WebGPU 着色器编译器（~25MB）：应用只用 WebGL；保留 vk_swiftshader/libGLESv2
  // （--disable-gpu 软件渲染恢复路径依赖它们）。
  const del = ["dxcompiler.dll", "dxil.dll"];
  for (const name of del) {
    const p = path.join(appOutDir, name);
    if (fs.existsSync(p)) {
      const mb = (fs.statSync(p).size / 1e6).toFixed(1);
      fs.rmSync(p, { force: true });
      console.log(`afterPack: removed ${name} (${mb}MB)`);
    }
  }
}
