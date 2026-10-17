const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("node:path");

app.setName("画画星球");

function createWindow() {
  // Remove the menu itself: autoHideMenuBar alone would let Alt bring it back.
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 840,
    minHeight: 640,
    backgroundColor: "#f8f9f3",
    title: "画画星球",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.removeMenu();
  window.setMenuBarVisibility(false);
  window.once("ready-to-show", () => window.show());
  window.on("enter-full-screen", () =>
    window.webContents.send("fullscreen:changed", true),
  );
  window.on("leave-full-screen", () =>
    window.webContents.send("fullscreen:changed", false),
  );
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.key === "Escape" && window.isFullScreen()) {
      event.preventDefault();
      window.setFullScreen(false);
    }
  });
  window.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: "question",
      title: "还有新创意没有保存",
      message: "这幅画有未保存的修改，要先留下来保存吗？",
      buttons: ["继续画画", "放弃修改并退出"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice === 1) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(path.join(__dirname, "../dist/index.html"));
  return window;
}

ipcMain.handle(
  "fullscreen:get",
  (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
);
ipcMain.handle("fullscreen:toggle", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.setFullScreen(!window.isFullScreen());
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
