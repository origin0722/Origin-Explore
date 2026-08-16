// 生成 Electron 打包图标（品牌青→紫渐变圆角方块 + 放大镜探索符号，512×512 与 use-icon 一致）
import sharp from "sharp";
import fs from "node:fs";

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="116" fill="#0a0e1a"/>
  <rect x="40" y="40" width="432" height="432" rx="100" fill="url(#g)"/>
  <circle cx="216" cy="216" r="92" fill="none" stroke="#0a0e1a" stroke-width="40"/>
  <line x1="292" y1="292" x2="364" y2="364" stroke="#0a0e1a" stroke-width="40" stroke-linecap="round"/>
  <circle cx="216" cy="216" r="92" fill="none" stroke="#ffffff" stroke-width="16"/>
  <line x1="292" y1="292" x2="352" y2="352" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
</svg>`;

fs.mkdirSync("build", { recursive: true });
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile("build/icon.png");
console.log("build/icon.png generated (512x512)");
