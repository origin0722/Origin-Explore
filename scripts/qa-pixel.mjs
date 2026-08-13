/**
 * Pixel-level QA — Explore clone vs original site screenshots.
 * Dual baseline: desktop 1440x900 + mobile 390x844.
 * For each scenario: screenshot the clone at the matching viewport, then
 * pixelmatch against the archived original (docs/design-references/...).
 * Outputs: qa-out/<scene>.png (clone), qa-out/<scene>.diff.png (red/green
 * diff overlay), qa-out/report.json (stats). Inspect the diff images to
 * locate and fix geometric/spacing/color/font deviations.
 * Usage: node scripts/qa-pixel.mjs [scene...]   (default: all)
 */
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ALT_EDGE = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPath = existsSync(EDGE) ? EDGE : ALT_EDGE;

const REF_DIR = "docs/design-references/ai-explore-poker-820d0558/chat-6ea4b827";
const OUT_DIR = "qa-out";
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Scenes: {name, ref, viewport, setup(page), seed(page)}
 * setup = navigate & reach the state; seed = optional interactions after load.
 */
const SCENES = [
  {
    name: "d-welcome",
    ref: "state-mainui-1440.png",
    viewport: { width: 1440, height: 900 },
    setup: async () => {},
  },
  {
    name: "d-settings",
    ref: "state-boot.png",
    viewport: { width: 1440, height: 900 },
    setup: async () => {},
    seed: async (page) => {
      await page.evaluate(() => {
        [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("设置"))?.click();
      });
      await sleep(500);
    },
  },
  {
    name: "d-welcome-main",
    ref: "state-main.png",
    viewport: { width: 1440, height: 900 },
    setup: async () => {},
  },
  {
    name: "d-newproj",
    ref: "state-newproj1.png",
    viewport: { width: 1440, height: 900 },
    setup: async () => {},
    seed: async (page) => {
      await page.evaluate(() => {
        [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
      });
      await sleep(500);
    },
  },
  {
    name: "d-chat",
    ref: "state-typed.png",
    viewport: { width: 1440, height: 900 },
    setup: async (page) => {
      await page.evaluate(() => {
        [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
      });
      await sleep(500);
    },
    seed: async (page) => {
      await page.type("textarea", "什么是量子纠缠？");
      await sleep(400); // state-typed shows typed-but-unsent input
    },
  },
  {
    name: "d-chat-reply",
    ref: "state-seeded-v3.png",
    viewport: { width: 1440, height: 900 },
    setup: async (page) => {
      await page.evaluate(() => {
        [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
      });
      await sleep(500);
    },
    seed: async (page) => {
      await page.type("textarea", "什么是量子纠缠？");
      await page.keyboard.down("Control");
      await page.keyboard.press("Enter");
      await page.keyboard.up("Control");
      await sleep(2500); // 1.2s mock reply + settle
      // The original auto-collapses the sidebar on send; re-expand it so the
      // screenshot matches the reference's expanded-sidebar state.
      await page.evaluate(() => {
        [...document.querySelectorAll("aside button")].find((b) => (b.title || "").includes("侧边栏"))?.click();
      });
      await sleep(500);
    },
  },
  {
    name: "m-main",
    ref: "state-mobile-main.png",
    viewport: { width: 390, height: 844 },
    setup: async () => {},
  },
  {
    name: "m-fab",
    ref: "state-mobfab.png",
    viewport: { width: 390, height: 844 },
    setup: async () => {},
    seed: async (page) => {
      await page.evaluate(() => {
        [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("新建项目"))?.click();
      });
      await sleep(500);
    },
  },
];

async function diffScene(scene) {
  const refPath = path.join(REF_DIR, scene.ref);
  const refPng = PNG.sync.read(readFileSync(refPath));
  const shotPath = path.join(OUT_DIR, `${scene.name}.png`);
  const shotPng = PNG.sync.read(readFileSync(shotPath));

  // Crop/pad the clone shot to the reference size.
  const w = refPng.width;
  const h = refPng.height;
  if (shotPng.width !== w || shotPng.height !== h) {
    const resized = new PNG({ width: w, height: h });
    resized.data.fill(0);
    for (let y = 0; y < Math.min(h, shotPng.height); y++) {
      for (let x = 0; x < Math.min(w, shotPng.width); x++) {
        const s = (y * shotPng.width + x) * 4;
        const d = (y * w + x) * 4;
        resized.data[d] = shotPng.data[s];
        resized.data[d + 1] = shotPng.data[s + 1];
        resized.data[d + 2] = shotPng.data[s + 2];
        resized.data[d + 3] = 255;
      }
    }
    writeFileSync(shotPath, PNG.sync.write(resized));
  }

  const diff = new PNG({ width: w, height: h });
  const mismatched = pixelmatch(refPng.data, shotPng.data, diff.data, w, h, {
    threshold: 0.12,
    diffColor: [255, 0, 96], // original-only pixels (hot pink)
    diffColorAlt: [0, 255, 255], // clone-only pixels (cyan)
  });
  const diffPath = path.join(OUT_DIR, `${scene.name}.diff.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));
  const pct = ((mismatched / (w * h)) * 100).toFixed(2);
  return {
    scene: scene.name,
    ref: scene.ref,
    size: `${w}x${h}`,
    mismatched,
    pct,
  };
}

async function main() {
  const wanted = process.argv.slice(2);
  const scenes = SCENES.filter((s) => wanted.length === 0 || wanted.includes(s.name));

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: "new",
    args: [
      "--edge-skip-compat-layer-relaunch",
      "--no-first-run",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1440,900",
    ],
  });

  const report = [];
  for (const scene of scenes) {
    const page = await browser.newPage();
    await page.setViewport(scene.viewport);
    await page.evaluateOnNewDocument(() => {
      try {
        // Deterministic first-run state: wipe persisted app state, skip onboarding.
        localStorage.clear();
        localStorage.setItem("explore-onboarded", "1");
      } catch {}
    });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
    await sleep(700);
    await scene.setup(page);
    await sleep(300);
    await scene.seed?.(page);
    await sleep(500);
    await page.screenshot({ path: path.join(OUT_DIR, `${scene.name}.png`) });
    report.push(await diffScene(scene));
    await page.close();
  }

  await browser.close();
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.table(report.map((r) => ({ scene: r.scene, ref: r.ref, mismatched: r.mismatched, diffPct: r.pct })));
  console.log(`Diff images → ${OUT_DIR}/<scene>.diff.png`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(2);
});
