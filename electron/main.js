const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { fork, spawn } = require("child_process");
const os = require("os");
const fs = require("fs");

const PORT = 3000;
let mainWindow = null;
let serverProcess = null;

// Probe local server
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/attendance/offline/network`, (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Poll until local server responds
async function waitForServer(port, timeoutMs = 45000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isUp = await checkPort(port);
    if (isUp) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

// Start the local Next.js standalone background server
async function startServer() {
  const isAlreadyRunning = await checkPort(PORT);
  if (isAlreadyRunning) {
    console.log(`[Sciora Desktop] Engine already listening on port ${PORT}.`);
    return;
  }

  const isPackaged = app.isPackaged;
  console.log(`[Sciora Desktop] Starting background server (isPackaged=${isPackaged})...`);

  // Path to standalone server.js
  let serverScript = null;
  if (isPackaged) {
    serverScript = path.join(process.resourcesPath, "standalone", "server.js");
  } else {
    const localStandalone = path.join(__dirname, "..", ".next", "standalone", "server.js");
    if (fs.existsSync(localStandalone)) {
      serverScript = localStandalone;
    }
  }

  if (serverScript && fs.existsSync(serverScript)) {
    console.log(`[Sciora Desktop] Forking standalone Next.js engine: ${serverScript}`);
    serverProcess = fork(serverScript, [], {
      cwd: path.dirname(serverScript),
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production",
      },
      stdio: "pipe",
    });

    serverProcess.stdout?.on("data", (data) => {
      console.log(`[Engine] ${data.toString().trim()}`);
    });
    serverProcess.stderr?.on("data", (data) => {
      console.error(`[Engine Error] ${data.toString().trim()}`);
    });
  } else {
    // Fallback: spawn dev server if not in standalone
    console.log("[Sciora Desktop] Standalone not found, launching via npm run dev...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    serverProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: app.getAppPath(),
      shell: true,
      stdio: "inherit",
      env: { ...process.env, PORT: String(PORT), HOSTNAME: "0.0.0.0" },
    });
  }

  serverProcess.on("error", (err) => {
    console.error("[Sciora Desktop] Server process error:", err);
  });
}

function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const [name, ifaceList] of Object.entries(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254.")) {
        list.push({
          name,
          address: iface.address,
          isHotspot: iface.address === "192.168.137.1" || name.toLowerCase().includes("hotspot"),
        });
      }
    }
  }

  list.sort((a, b) => {
    if (a.isHotspot && !b.isHotspot) return -1;
    if (!a.isHotspot && b.isHotspot) return 1;
    if (a.address.startsWith("192.168.") && !b.address.startsWith("192.168.")) return -1;
    return 0;
  });

  return list[0]?.address || "127.0.0.1";
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: "Sciora — Lecturer Console",
    icon: path.join(__dirname, "../public/sciora.ico"),
    backgroundColor: "#141519",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  const targetUrl = `http://localhost:${PORT}/admin`;
  mainWindow.loadURL(targetUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    console.log(`[Sciora Desktop] Window ready at ${targetUrl}`);
    console.log(`[Sciora Desktop] Classroom Hotspot listening at http://${getLocalNetworkIp()}:${PORT}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("get-hotspot-info", () => {
  const ip = getLocalNetworkIp();
  return {
    ip,
    port: PORT,
    studentAttendanceUrl: `http://${ip}:${PORT}/attendance`,
    studentNotesUrl: `http://${ip}:${PORT}/notes`,
    isWindowsHotspot: ip === "192.168.137.1",
  };
});

// App Lifecycle
app.whenReady().then(async () => {
  await startServer();
  const ready = await waitForServer(PORT);
  if (!ready) {
    dialog.showErrorBox(
      "Engine Startup Warning",
      "Sciora local engine is taking longer than expected to bind port 3000. Launching dashboard..."
    );
  }
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

function stopServer() {
  if (serverProcess) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"]);
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch (e) {
      /* ignore */
    }
    serverProcess = null;
  }
}

app.on("before-quit", stopServer);
app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
