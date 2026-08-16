/**
 * Explore 桌面应用（Electron 入口）
 * 启动流程：utilityProcess 运行 Next.js standalone 服务器（Electron 自带 Node 运行时，
 * 朋友机器无需安装 Node）→ 等待端口就绪 → 打开窗口加载本地页面。
 * standalone 产物位于 resources/next（extraResources，asar 外，避免 asar 内路径问题）。
 *
 * 稳健性：关闭 GPU 硬件加速（规避 Windows 上常见的 Chromium 原生崩溃）；
 * 全链路崩溃日志写入 userData/explore.log；渲染进程崩溃自动重载。
 */
const { app, BrowserWindow, utilityProcess, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");

// 本地工具应用图形负载低；硬件加速是 Windows 上原生崩溃（access violation）最常见来源。
app.disableHardwareAcceleration();

const PORT_RANGE_START = 3210;
const PORT_RANGE_END = 3225;
const HOST = "127.0.0.1";

/** 定位 Next standalone 目录：开发时 = 项目 .next/standalone；打包后 = resources/next */
function serverRoot() {
  const bundled = path.join(process.resourcesPath || "", "next");
  if (fs.existsSync(path.join(bundled, "server.js"))) return bundled;
  return path.join(__dirname, "..", ".next", "standalone");
}

/** 崩环/运行日志（userData 目录，打包后随用户数据持久，便于排查） */
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

/** 动态选择空闲端口（避免与用户机器上的其他程序冲突导致"服务器启动超时"） */
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
  return PORT_RANGE_START;
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

app.whenReady().then(async () => {
  const root = serverRoot();
  log(`app ready, server root: ${root}`);

  const serverEntry = path.join(root, "server.js");
  if (!fs.existsSync(serverEntry)) {
    log(`server entry missing: ${serverEntry}`);
    dialogError(`找不到 ${serverEntry}，请重新打包或安装。`);
    return;
  }
  // 动态选端口：避免与用户机器上其他程序冲突导致"服务器启动超时"
  const PORT = await pickFreePort();
  log(`using port ${PORT}`);

  serverProc = utilityProcess.fork(serverEntry, [], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(PORT),
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
  serverProc.on("exit", (code) => log(`server process exited: ${code}`));
  app.on("child-process-gone", (_ev, details) => {
    log(`child-process-gone: type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`);
  });

  // server 启动日志也喂回主进程日志（utilityProcess 可能捕获不到时兜底）
  let serverOut = "";
  try {
    serverProc.stderr?.on("data", (c) => {
      serverOut = (serverOut + c.toString()).slice(-3000);
    });
  } catch {}

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

  const win = new BrowserWindow({
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
  win.webContents.on("render-process-gone", (_e, details) => {
    log(`render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
    try {
      win.reload();
    } catch {
      /* ignore */
    }
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => log(`did-fail-load: ${code} ${desc}`));
  win.loadURL(`http://${HOST}:${PORT}`);
  win.on("closed", () => app.quit());
});

function dialogError(msg) {
  log(`dialogError: ${msg}`);
  dialog.showErrorBox("OriginExplore 启动失败", msg);
  app.quit();
}

app.on("window-all-closed", () => {
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* already exited */
    }
  }
  app.quit();
});

app.on("quit", () => {
  log("app quit");
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* already exited */
    }
  }
});
