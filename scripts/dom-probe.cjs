const puppeteer = require("puppeteer-core");
const fs = require("fs");
const EDGE = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      localStorage.setItem("explore-onboarded", "1");
    } catch {}
  });
  await p.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await sleep(800);
  const out = await p.evaluate(() => {
    const cssVars = getComputedStyle(document.documentElement);
    const sel = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return `${s}: bg=${cs.backgroundColor} color=${cs.color} ${el.getAttribute("data-theme") ? "theme=" + el.getAttribute("data-theme") : ""}`;
    };
    return [
      "root: bg=" + cssVars.getPropertyValue("--bg").trim() + " body-bg=" + cssVars.getPropertyValue("--background").trim(),
      "theme-attr=" + document.documentElement.getAttribute("data-theme"),
      sel("body"),
      sel("div.fixed.inset-0"),
      sel("aside"),
      sel("main"),
    ].join("\n");
  });
  console.log(out);
  await b.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
