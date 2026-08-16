// 生成 Electron 打包图标（品牌青→紫渐变圆角方块 + 放大镜探索符号）
import sharp from "sharp";
import fs from "node:fs";

const svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect x="12" y="12" width="232" height="232" rx="58" fill="#0a0e1a"/>
  <rect x="20" y="20" width="216" height="216" rx="50" fill="url(#g)"/>
  <circle cx="108" cy="108" r="46" fill="none" stroke="#0a0e1a" stroke-width="20"/>
  <line x1="146" y1="146" x2="182" y2="182" stroke="#0a0e1a" stroke-width="20" stroke-linecap="round"/>
  <circle cx="108" cy="108" r="46" fill="none" stroke="#ffffff" stroke-width="8"/>
  <line x1="146" y1="146" x2="176" y2="176" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
</svg>`;

fs.mkdirSync("build", { recursive: true });
await sharp(Buffer.from(svg)).png().toFile("build/icon.png");
console.log("build/icon.png generated");
