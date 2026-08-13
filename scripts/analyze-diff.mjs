/**
 * Analyze a pixelmatch diff image: grid heat-map + color-class counts.
 * Hot pink (255,0,96) = pixels present in the ORIGINAL but not the clone;
 * cyan (0,255,255) = pixels present in the CLONE but not the original.
 * Prints a 48x30 ASCII map per file: '.' none, 'x' <1%, 'X' >=1%, '+' >=3%.
 * Usage: node scripts/analyze-diff.mjs [scene...] (default: all in qa-out)
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const OUT = "qa-out";
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((n) => `${n}.diff.png`)
  : readdirSync(OUT).filter((f) => f.endsWith(".diff.png"));

const W = 48; // grid columns
const H = 30; // grid rows

for (const file of files) {
  const png = PNG.sync.read(readFileSync(path.join(OUT, file)));
  const { width: w, height: h } = png;
  const cellW = w / W;
  const cellH = h / H;
  const grid = Array.from({ length: H }, () => new Array(W).fill(0));
  let pink = 0;
  let cyan = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      let kind = 0;
      if (r > 200 && g < 80 && b > 60) kind = 1; // pink — original only
      else if (r < 80 && g > 200 && b > 200) kind = 2; // cyan — clone only
      if (!kind) continue;
      kind === 1 ? pink++ : cyan++;
      const gx = Math.min(W - 1, Math.floor(x / cellW));
      const gy = Math.min(H - 1, Math.floor(y / cellH));
      grid[gy][gx]++;
    }
  }

  const total = w * h;
  console.log(`\n=== ${file}  (pink=原站独有 ${((pink / total) * 100).toFixed(2)}% / cyan=克隆独有 ${((cyan / total) * 100).toFixed(2)}%) ===`);
  const cellArea = cellW * cellH;
  for (let gy = 0; gy < H; gy += 2) {
    let row = "";
    for (let gx = 0; gx < W; gx++) {
      let c = ".";
      for (let dy = 0; dy < 2; dy++) {
        const n = grid[Math.min(H - 1, gy + dy)]?.[gx] ?? 0;
        const p = n / cellArea;
        const ch = p >= 0.03 ? "+" : p >= 0.01 ? "X" : p > 0 ? "x" : ".";
        if (ch !== ".") c = c === "." ? ch : c === "+" ? "+" : Math.max(c, ch) === "+" ? "+" : "X";
      }
      row += c;
    }
    console.log(row);
  }
  // legend rows with x coordinates
  console.log("    0".padEnd(0) + "─".repeat(0));
  for (let i = 0; i < W; i += 6) process.stdout.write(String(Math.round((i + 3) / W * w)).padStart(6));
  console.log();
}
