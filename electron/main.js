/**
 * OriginExplore 桌面应用（Electron 入口）
 * 启动流程：utilityProcess 运行 Next.js standalone 服务器（Electron 自带 Node 运行时，
 * 朋友机器无需安装 Node）→ 等待端口就绪 → 窗口加载本地页面。
 * standalone 产物位于 resources/next（打包后由 afterPack 拷贝，asar 外）。
 *
 * 稳健性：
 * - 默认启用 GPU 硬件加速（保证界面流畅）；GPU 进程崩溃自动带 --disable-gpu 重启一次，
 *   二次崩溃弹窗告知用户而非静默。
 * - 单实例锁：重复启动时聚焦已有窗口。
 * - utilityProcess（本地服务器）崩溃后自动重启（指数退避，最多 3 次）。
 * - 渲染进程崩溃自动重载（指数退避，避免 reload 风暴）。
 * - 全链路日志写入 userData/explore.log。
 */
const { app, BrowserWindow, utilityProcess, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");

// ---------------- 单实例锁 ----------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// GPU 策略：默认启用硬件加速（Electron 默认），保证 CSS 动画/模糊/合成走 GPU——
// 关闭后全部走 CPU 软件渲染，是界面卡顿、点击延迟的主要根源。
// 若 GPU 进程崩溃（老驱动/安全软件拦截），自动带 --disable-gpu 重启一次兜底；
// 已禁用仍崩溃则弹窗提示（不再无限重启）。
const GPU_FLAG = "--disable-gpu";
const hasGpuFlag = () => process.argv.includes(GPU_FLAG);
let gpuCrashCount = 0;

app.on("child-process-gone", (_ev, details) => {
  log(`child-process-gone: type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`);
  if (details.type === "GPU" && details.reason === "crashed") {
    gpuCrashCount++;
    if (!hasGpuFlag() && gpuCrashCount <= 1) {
      log("GPU process crashed — relaunching with hardware acceleration disabled");
      try {
        app.relaunch({ args: process.argv.slice(1).concat([GPU_FLAG]) });
      } catch (e) {
        log(`relaunch failed: ${e}`);
      }
      app.exit(0);
    } else if (gpuCrashCount > 1) {
      log(`GPU process crashed again (count=${gpuCrashCount}) — showing dialog`);
      dialog.showErrorBox(
        "OriginExplore 图形异常",
        "图形加速进程反复崩溃。若界面异常，可尝试更新显卡驱动；问题持续时请查看日志：" +
          logFile()
      );
    }
  }
});

const PORT_RANGE_START = 3210;
const PORT_RANGE_END = 3225;
const HOST = "127.0.0.1";

/** 定位 Next standalone 目录：打包后 = resources/next；开发 = 项目 .next/standalone */
function serverRoot() {
  const bundled = path.join(process.resourcesPath || "", "next");
  if (fs.existsSync(path.join(bundled, "server.js"))) return bundled;
  return path.join(__dirname, "..", ".next", "standalone");
}

/** 崩溃/运行日志（userData 目录，打包后随用户数据持久，便于排查） */
function logFile() {
  try {
    return path.join(app.getPath("userData"), "explore.log");
  } catch {
    return path.join(process.env.TEMP || ".", "explore.log");
  }
}
function log(msg) {
  try {
    fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* 日志不可写时静默 */
  }
}

process.on("uncaughtException", (e) => log(`uncaughtException: ${(e && e.stack) || e}`));
process.on("unhandledRejection", (e) => log(`unhandledRejection: ${(e && e.stack) || e}`));

/**
 * 动态选择空闲端口（避免与用户机器上的其他程序冲突导致"服务器启动超时"）。
 * 全部占用时返回 null（由调用方给出明确错误，而不是静默回退到被占端口）。
 */
async function pickFreePort() {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    const free = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.unref();
      srv.once("error", () => resolve(false));
      srv.listen(port, HOST, () => {
        srv.close(() => resolve(true));
      });
    });
    if (free) return port;
  }
  return null;
}

/** 等待本地服务器就绪（最多 timeoutMs） */
function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get({ host: HOST, port, path: "/", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error(`服务器启动超时（${timeoutMs / 1000}s），端口 ${port}`));
        else setTimeout(probe, 500);
      });
      req.on("timeout", () => {
        req.destroy();
        setTimeout(probe, 500);
      });
    };
    probe();
  });
}

let serverProc = null;
let serverExitCount = 0;
let quitting = false;

/** 启动本地服务器（utilityProcess），返回是否成功 fork */
function startServer(root, serverEntry, port) {
  serverProc = utilityProcess.fork(serverEntry, [], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: HOST,
      NODE_ENV: "production",
    },
    stdio: "pipe",
  });
  const sip = (stream, tag) => {
    try {
      stream.on("data", (chunk) => log(`${tag}: ${chunk.toString().slice(0, 2000)}`));
    } catch {
      /* ignore */
    }
  };
  sip(serverProc.stdout, "server-out");
  sip(serverProc.stderr, "server-err");
  serverProc.on("exit", (code) => {
    log(`server process exited: ${code}`);
    if (quitting) return; // 正常退出流程，不重启
    serverExitCount++;
    if (serverExitCount > 3) {
      log("server crashed repeatedly — giving up");
      dialogError(`本地服务反复崩溃（已尝试 ${serverExitCount} 次）。请查看日志：${logFile()}`);
      return;
    }
    // 指数退避重启：1s / 2s / 4s
    const delay = Math.min(1000 * 2 ** (serverExitCount - 1), 4000);
    log(`restarting server in ${delay}ms (attempt ${serverExitCount})`);
    setTimeout(() => {
      restartServerFlow().catch((e) => log(`server restart failed: ${e.message}`));
    }, delay);
  });
  return serverProc;
}

let win = null;
let restarting = false;

/** 完整重启流程：重新选端口 → fork → 等待就绪 → 重新加载窗口 */
async function restartServerFlow() {
  if (restarting) return;
  restarting = true;
  try {
    const PORT = await pickFreePort();
    if (PORT == null) throw new Error("端口 3210-3225 全部被占用");
    log(`restart using port ${PORT}`);
    startServer(serverRoot(), path.join(serverRoot(), "server.js"), PORT);
    await waitForServer(PORT);
    log("server restarted");
    if (win && !win.isDestroyed()) {
      win.loadURL(`http://${HOST}:${PORT}`);
    }
  } finally {
    restarting = false;
  }
}

app.whenReady().then(async () => {
  const root = serverRoot();
  log(`app ready, server root: ${root}`);

  const serverEntry = path.join(root, "server.js");
  if (!fs.existsSync(serverEntry)) {
    log(`server entry missing: ${serverEntry}`);
    dialogError(`找不到 ${serverEntry}，请重新打包或安装。`);
    return;
  }

  // 窗口尽早创建：服务器就绪前先显示深色背景窗口，避免"双击后长时间无反应"。
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "OriginExplore",
    autoHideMenuBar: true,
    backgroundColor: "#0a0e1a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 导航/弹窗边界：只允许本地页面，禁止 window.open 与外部跳转。
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    try {
      const u = new URL(url);
      if (u.hostname !== HOST) e.preventDefault();
    } catch {
      e.preventDefault();
    }
  });

  // 渲染进程崩溃：指数退避重载（1s / 2s / 4s），避免 reload 风暴。
  let renderCrashCount = 0;
  win.webContents.on("render-process-gone", (_e, details) => {
    log(`render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
    renderCrashCount++;
    const delay = Math.min(1000 * 2 ** (renderCrashCount - 1), 4000);
    setTimeout(() => {
      if (win && !win.isDestroyed()) {
        try {
          win.reload();
        } catch {
          /* ignore */
        }
      }
    }, delay);
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => log(`did-fail-load: ${code} ${desc}`));
  win.on("closed", () => app.quit());

  // 动态选端口：避免与用户机器上其他程序冲突导致"服务器启动超时"
  const PORT = await pickFreePort();
  if (PORT == null) {
    log("all ports busy");
    dialogError(`本地端口 ${PORT_RANGE_START}-${PORT_RANGE_END} 全部被占用。\n请关闭占用这些端口的程序后重试。`);
    return;
  }
  log(`using port ${PORT}`);

  startServer(root, serverEntry, PORT);

  try {
    await waitForServer(PORT);
    log("server ready");
  } catch (e) {
    log(`waitForServer failed: ${e.message}`);
    dialogError(
      `本地服务启动失败：${e.message}\n\n请检查：\n1) 若本机有安全软件，允许其放行本地进程；\n` +
        `2) 若反复失败，查看日志：${logFile()}\n\n（点击确定退出）`
    );
    return;
  }

  win.loadURL(`http://${HOST}:${PORT}`);
});

function dialogError(msg) {
  log(`dialogError: ${msg}`);
  dialog.showErrorBox("OriginExplore 启动失败", msg);
  app.quit();
}

function cleanupServer() {
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* already exited */
    }
    serverProc = null;
  }
}

app.on("window-all-closed", () => {
  quitting = true;
  cleanupServer();
  app.quit();
});

app.on("quit", () => {
  log("app quit");
  quitting = true;
  cleanupServer();
});
