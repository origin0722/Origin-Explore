/**
 * Row-profile comparison — count non-background pixels per row for two PNGs
 * and overlay the profiles to locate content-layout differences.
 * Usage: node scripts/row-profile.mjs <a.png> <b.png>
 */
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const [aPath, bPath] = process.argv.slice(2);
const read = (f) => {
  const p = PNG.sync.read(readFileSync(f));
  const rows = [];
  const { width: w, height: h, data: d } = p;
  for (let y = 0; y < h; y++) {
    let bright = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 40) bright++;
    }
    rows.push(Math.round((bright / w) * 1000) / 10);
  }
  return { w, h, rows };
};

const a = read(aPath);
const b = read(bPath);
const h = Math.max(a.h, b.h);
console.log(
  "row | a%  | b%  | delta | a-bar | b-bar"
);
const bar = (v, scale) => "#".repeat(Math.round(v / scale));
for (let y = 0; y < h; y += 4) {
  const va = a.rows[y] ?? 0;
  const vb = b.rows[y] ?? 0;
  const d = va - vb;
  const marker = Math.abs(d) >= 15 ? (d > 0 ? "  <<<< a only" : "  >>>> b only") : "";
  console.log(
    String(y).padStart(4) +
      " | " +
      String(va).padStart(4) +
      " | " +
      String(vb).padStart(4) +
      " | " +
      String(Math.round(d * 10) / 10).padStart(5) +
      " | " +
      bar(va, 2).padEnd(50, " ") +
      "|" +
      bar(vb, 2) +
      marker
  );
}
