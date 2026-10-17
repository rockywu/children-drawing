const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getFullscreen: () => ipcRenderer.invoke("fullscreen:get"),
  toggleFullscreen: () => ipcRenderer.invoke("fullscreen:toggle"),
  onFullscreenChange: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("fullscreen:changed", listener);
    return () => ipcRenderer.removeListener("fullscreen:changed", listener);
  },
});
