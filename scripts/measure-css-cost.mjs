// 渲染侧 A/B 测量：当前 CSS vs 去掉最贵连续动画（blob-morph 圆角形变）后的 CSS。
// 以 --disable-gpu 启动 Chrome（软件渲染 = 最坏情况，贴近 Electron 关闭硬件加速的表现）。
// 指标：6s 内 Long Task 数量/总时长/最大，以及「如何使用」按钮连点 5 次的点击→绘制延迟。
// 用法：先启动 standalone 服务器（PORT=3210），再 node scripts/measure-css-cost.mjs
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://127.0.0.1:3210";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--disable-gpu", "--no-first-run", "--disable-extensions"],
  defaultViewport: { width: 1360, height: 860 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });

// 强制欢迎页（清空数据 + 跳过新手引导），确保流体光斑/霓虹动画在跑
await page.evaluate(() => {
  try {
    localStorage.setItem("explore-state-v1", "{}");
    localStorage.setItem("explore-onboarded", "1");
  } catch {}
});
await page.reload({ waitUntil: "domcontentloaded" });
try {
  await page.waitForSelector("h1", { timeout: 15000 });
} catch {}
await new Promise((r) => setTimeout(r, 2500));

async function sample(label) {
  const longTasks = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const arr = [];
        try {
          const obs = new PerformanceObserver((l) => {
            for (const e of l.getEntries()) arr.push(Math.round(e.duration));
          });
          obs.observe({ entryTypes: ["longtask"] });
        } catch {}
        setTimeout(() => resolve(arr), 6000);
      })
  );
  const clicks = [];
  for (let i = 0; i < 5; i++) {
    const d = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const btns = [...document.querySelectorAll("button")].filter((b) =>
            (b.textContent || "").includes("如何使用")
          );
          const btn = btns[0];
          if (!btn) return resolve(-1);
          const t0 = performance.now();
          btn.click();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(Math.round(performance.now() - t0)))
          );
        })
    );
    clicks.push(d);
    await new Promise((r) => setTimeout(r, 350));
  }
  const out = {
    label,
    longTasks: {
      count: longTasks.length,
      totalMs: longTasks.reduce((a, b) => a + b, 0),
      maxMs: longTasks.length ? Math.max(...longTasks) : 0,
    },
    clicks,
    avgClickMs: Math.round(clicks.filter((c) => c > 0).reduce((a, b) => a + b, 0) / Math.max(1, clicks.filter((c) => c > 0).length)),
  };
  console.log(JSON.stringify(out));
}

// A：当前 CSS
await sample("baseline");

// B：注入"去掉 blob-morph（圆角形变）"的等效 CSS
await page.evaluate(() => {
  const style = document.createElement("style");
  style.id = "perf-ab";
  style.textContent = `
    .blob-a { animation: blob-drift 14s ease-in-out infinite; }
    .blob-b { animation: blob-drift 17s ease-in-out -4s infinite reverse; }
    .blob-c { animation: blob-drift 12s ease-in-out -8s infinite; }
  `;
  document.head.appendChild(style);
});
await sample("no-blob-morph");

await browser.close();
process.exit(0);
