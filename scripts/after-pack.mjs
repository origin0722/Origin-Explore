// electron-builder afterPack 钩子：把组装好的 Next 运行目录（含 node_modules）
// 纯拷贝进 appOutDir/resources/next --绕过 electron-builder 拷贝时剥离 node_modules 的行为。
// 同时删除运行时用不到的 WebGPU 着色器编译器 DLL（应用只用 WebGL，保留软件渲染 DLL）。
//
// 实现说明：用逐文件 fs.copyFileSync 而非 fs.cpSync(recursive)。后者在装有 dev server /
// 文件监听进程的 Windows 环境会阻塞挂起且无任何输出；逐文件拷贝更快、每 1000 个文件打印进度
// 可定位卡点，且对瞬时文件锁（EBUSY/EPERM）重试 3 次而非整个挂起。
import fs from "node:fs";
import path from "node:path";

const sleepSync = (ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* 同步等待瞬时锁释放 */ }
};

function copyTree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  let retried = 0;
  const walk = (cur, target) => {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const s = path.join(cur, entry.name);
      const d = path.join(target, entry.name);
      if (entry.isDirectory()) {
        walk(s, d);
      } else {
        let err = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            fs.copyFileSync(s, d);
            err = null;
            break;
          } catch (e) {
            err = e;
            const code = e.code || "";
            if (attempt < 3 && (code === "EBUSY" || code === "EPERM" || code === "ENOTREADY" || code === "EACCES")) {
              retried++;
              sleepSync(400 * attempt);
              continue;
            }
            break; // 非瞬时锁类错误，不重试
          }
        }
        if (err) {
          throw new Error(`afterPack: 拷贝失败（重试后仍失败）: ${path.relative(srcDir, s)} [${err.code || err.message}]`);
        }
        count++;
        if (count % 1000 === 0) console.log(`afterPack: 已拷贝 ${count} 个文件（重试 ${retried}）...`);
      }
    }
  };
  walk(srcDir, destDir);
  return { count, retried };
}

export default async function afterPack(context) {
  const { appOutDir } = context;
  const src = path.resolve(".packaging/next");
  const dest = path.join(appOutDir, "resources", "next");
  if (!fs.existsSync(path.join(src, "server.js"))) {
    throw new Error(`afterPack: staging 缺失 ${src}，请先运行 scripts/package-app.mjs 的组装步骤`);
  }
  console.log(`afterPack: 拷贝 ${src} -> ${dest} ...`);
  const { count, retried } = copyTree(src, dest);
  console.log(
    `afterPack: next runtime -> ${dest} (${count} 文件, 重试 ${retried}, node_modules=${fs.existsSync(path.join(dest, "node_modules"))})`
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
