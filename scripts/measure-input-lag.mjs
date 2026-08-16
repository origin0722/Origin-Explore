// 测量桌面渲染卡顿（根因验证脚本）：
// 1) 6s 内 Long Task（>50ms 主线程阻塞）的次数/总时长 —— 长任务越多，点击响应越延迟；
// 2) 连点「如何使用」按钮 5 次，测 点击 → 两帧后绘制 的延迟；
// 3) 输出 GPU 状态（确认硬件加速是否启用）。
// 用法：先以 --remote-debugging-port=9222 启动 Electron，再 node scripts/measure-input-lag.mjs
import puppeteer from "puppeteer-core";

const CDP_PORT = 9222;

async function waitForEndpoint(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error("CDP endpoint 未就绪");
    await new Promise((r) => setTimeout(r, 500));
  }
}

const version = await waitForEndpoint();
const browser = await puppeteer.connect({
  browserWSEndpoint: version.webSocketDebuggerUrl,
  defaultViewport: null,
});

const pages = await browser.pages();
const page = pages.find((p) => p.url().startsWith("http://127.0.0.1")) ?? pages[0];
if (!page) throw new Error("找不到应用页面");

// 强制欢迎页（清空演示数据 + 跳过新手引导），确保流体光斑/霓虹动画在跑
await page.evaluate(() => {
  try {
    localStorage.setItem("explore-state-v1", "{}");
    localStorage.setItem("explore-onboarded", "1");
  } catch {}
});
await page.reload({ waitUntil: "domcontentloaded" });
try {
  await page.waitForSelector("h1", { timeout: 15000 });
} catch {
  /* 页面结构变化时继续 */
}
await new Promise((r) => setTimeout(r, 2500)); // 等字体/动画稳定

// 1) Long Task 采样 6 秒
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

// 2) 点击延迟：连点「如何使用」5 次，取 点击 → 第二帧 的耗时
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

// 3) GPU 状态
let gpuInfo = null;
try {
  const session = await page.createCDPSession();
  const sys = await session.send("SystemInfo.getInfo");
  gpuInfo = {
    devices: (sys.gpu?.devices ?? []).map((d) => d.name),
    featureStatus: sys.gpu?.featureStatus ?? null,
  };
} catch {
  gpuInfo = { error: "SystemInfo 不可用" };
}

console.log(
  JSON.stringify(
    {
      longTasks: {
        count: longTasks.length,
        totalMs: longTasks.reduce((a, b) => a + b, 0),
        maxMs: longTasks.length ? Math.max(...longTasks) : 0,
        list: longTasks,
      },
      clicks,
      gpu: gpuInfo,
    },
    null,
    2
  )
);

await browser.disconnect();
process.exit(0);
