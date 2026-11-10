const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const os = require("os");

const PORT = 3000;
let mainWindow = null;
let serverProcess = null;
let isQuitting = false;

// Check if a port is already in use (e.g. Next.js already running)
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/attendance/offline/network`, (res) => {
      resolve(true);
    });
    req.on("error", () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Poll until local server is responsive
async function waitForServer(port, timeoutMs = 45000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isUp = await checkPort(port);
    if (isUp) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

// Start the local Next.js background server
async function startServer() {
  const isAlreadyRunning = await checkPort(PORT);
  if (isAlreadyRunning) {
    console.log(`[Sciora Desktop] Next.js server already running on port ${PORT}.`);
    return;
  }

  const isDev = !app.isPackaged;
  console.log(`[Sciora Desktop] Starting local Next.js server (isDev=${isDev})...`);

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  if (isDev) {
    serverProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: app.getAppPath(),
      shell: true,
      stdio: "inherit",
      env: { ...process.env, PORT: String(PORT), HOST: "0.0.0.0" },
    });
  } else {
    // In production package, run "npm run start"
    serverProcess = spawn(npmCmd, ["run", "start"], {
      cwd: app.getAppPath(),
      shell: true,
      stdio: "inherit",
      env: { ...process.env, PORT: String(PORT), HOST: "0.0.0.0" },
    });
  }

  serverProcess.on("error", (err) => {
    console.error("[Sciora Desktop] Failed to start local server:", err);
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
    show: false, // Show once ready-to-show to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  // Open external links in user's default browser
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
    console.log(`[Sciora Desktop] Lecturer Console loaded on ${targetUrl}`);
    console.log(`[Sciora Desktop] Offline Classroom Hotspot URL: http://${getLocalNetworkIp()}:${PORT}`);
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
      "Server Timeout",
      "Sciora local background engine could not start in time. Please verify that port 3000 is not blocked."
    );
  }
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"]);
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch (e) {
      console.error("[Sciora Desktop] Error stopping server process:", e);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
