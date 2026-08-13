/** Dump clone DOM text elements at a viewport — mobile welcome state. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const EDGE = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844 });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      localStorage.setItem("explore-onboarded", "1");
    } catch {}
  });
  await p.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  const els = await p.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((e) => e.children.length === 0 && e.textContent.trim())
      .slice(0, 40)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return `${e.textContent.trim().slice(0, 30)} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      })
  );
  console.log(els.join("\n"));
  await b.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
