const puppeteer = require("puppeteer-core");
const fs = require("fs");
const EDGE = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
  const b = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--edge-skip-compat-layer-relaunch", "--no-first-run", "--no-sandbox", "--window-size=1440,900"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  try {
    await p.goto("https://ai.explore.poker/chat", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));
    await p.screenshot({ path: "qa-out/live-original.png" });
    const info = await p.evaluate(() => ({
      title: document.title,
      hasSidebar: !!document.querySelector("aside"),
      bodyText: document.body.innerText.slice(0, 120).replace(/\n/g, " | "),
      buttons: [...document.querySelectorAll("button")].slice(0, 8).map((b) => b.innerText.slice(0, 18)),
    }));
    console.log(JSON.stringify(info, null, 1));
  } catch (e) {
    console.error("NAV ERR:", e.message.slice(0, 200));
  }
  await b.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
