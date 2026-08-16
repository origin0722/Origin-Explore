// 把用户提供的图标处理成打包图标 build/icon.png（正方形、透明背景适配、512×512）。
// 用法：node scripts/use-icon.mjs <图片路径>
// 之后运行 npm run package:app 即可产出带新图标的 exe（package-app.mjs 检测到
// build/icon.png 存在时不会用默认图标覆盖）。
import sharp from "sharp";
import fs from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("用法: node scripts/use-icon.mjs <图片路径>");
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`文件不存在: ${input}`);
  process.exit(1);
}

const SIZE = 512;
const out = "build/icon.png";
fs.mkdirSync("build", { recursive: true });

// 非正方形图片：等比缩放并居中放入透明画布（不拉伸变形），Windows 图标天然是正方形。
await sharp(input)
  .resize(SIZE, SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`${out} generated: ${meta.width}x${meta.height} (from ${input})`);
