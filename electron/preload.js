/**
 * OriginExplore 桌面端预加载脚本（sandbox 模式）。
 * 通过 contextBridge 暴露最小桥接面：
 * - getAppInfo()   → { version, userData }（关于页展示版本号与数据保存路径）
 * - openUserData() → 在系统文件管理器中打开用户数据目录
 * - readState()    → 同步读取持久化数据文件（userData/explore-state-v1.json），boot 时调用一次
 * - writeState()   → 异步写入持久化数据文件（500ms 防抖；主进程原子写，失败返回 false）
 * 页面与主进程之间不暴露任何其它能力（contextIsolation + sandbox 保持开启）。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("exploreDesktop", {
  getAppInfo: () => ipcRenderer.invoke("app-info"),
  openUserData: () => ipcRenderer.invoke("open-user-data"),
  readState: () => ipcRenderer.sendSync("storage:read"),
  writeState: (json) => ipcRenderer.invoke("storage:write", json),
});
