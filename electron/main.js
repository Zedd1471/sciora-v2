const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { fork, spawn } = require("child_process");
const os = require("os");
const fs = require("fs");

const PORT = 3000;
let mainWindow = null;
let serverProcess = null;

// Performance and responsiveness optimizations
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
app.commandLine.appendSwitch("enable-smooth-scrolling");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

// Persistent file logger
let logFilePath = null;
function initLogger() {
  try {
    const userData = app.getPath("userData");
    fs.mkdirSync(userData, { recursive: true });
    logFilePath = path.join(userData, "desktop.log");
    fs.appendFileSync(
      logFilePath,
      `\n\n--- [${new Date().toISOString()}] Sciora Lecturer Console Startup (version: ${app.getVersion()}) ---\n`
    );
  } catch (e) {
    // ignore
  }
}

function log(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");
  console.log(line);
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${line}\n`);
    } catch {}
  }
}

function logError(...args) {
  const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");
  console.error(line);
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, `[${new Date().toISOString()} ERROR] ${line}\n`);
    } catch {}
  }
}

// Probe local server
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/attendance/offline/network`, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Poll until local server responds
async function waitForServer(port, timeoutMs = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const isUp = await checkPort(port);
    if (isUp) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Start the local Next.js standalone background server
async function startServer() {
  const isAlreadyRunning = await checkPort(PORT);
  if (isAlreadyRunning) {
    log(`[Sciora Desktop] Engine already listening on port ${PORT}.`);
    return true;
  }

  const isPackaged = app.isPackaged;
  log(`[Sciora Desktop] Starting background server (isPackaged=${isPackaged})...`);
  log(`[Sciora Desktop] App Path: ${app.getAppPath()}`);
  log(`[Sciora Desktop] Resources Path: ${process.resourcesPath}`);

  // Candidate locations for standalone server.js
  const candidatePaths = [
    path.join(process.resourcesPath, "standalone", "server.js"),
    path.join(app.getAppPath(), "standalone", "server.js"),
    path.join(app.getAppPath(), "..", "standalone", "server.js"),
    path.join(__dirname, "..", ".next", "standalone", "server.js"),
  ];

  let serverScript = candidatePaths.find((p) => fs.existsSync(p));

  if (serverScript) {
    log(`[Sciora Desktop] Located standalone Next.js engine: ${serverScript}`);
    const serverDir = path.dirname(serverScript);

    // Verify node_modules exists
    const hasModules = fs.existsSync(path.join(serverDir, "node_modules"));
    log(`[Sciora Desktop] Standalone node_modules present: ${hasModules} in ${serverDir}`);

    serverProcess = fork(serverScript, [], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: "pipe",
    });

    serverProcess.stdout?.on("data", (data) => {
      log(`[Engine] ${data.toString().trim()}`);
    });
    serverProcess.stderr?.on("data", (data) => {
      logError(`[Engine Error] ${data.toString().trim()}`);
    });

    serverProcess.on("exit", (code, signal) => {
      log(`[Engine] Process exited with code=${code} signal=${signal}`);
    });
  } else {
    logError("[Sciora Desktop] Standalone server.js not found in candidate paths:", candidatePaths);
    // Fallback in dev: spawn npm run dev
    if (!isPackaged) {
      log("[Sciora Desktop] Launching development server via npm run dev...");
      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
      serverProcess = spawn(npmCmd, ["run", "dev"], {
        cwd: app.getAppPath(),
        shell: true,
        stdio: "inherit",
        env: { ...process.env, PORT: String(PORT), HOSTNAME: "0.0.0.0" },
      });
    }
  }

  serverProcess?.on("error", (err) => {
    logError("[Sciora Desktop] Server process error:", err);
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
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    show: true, // Show window immediately so user knows app has opened
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

  // Load splash screen immediately
  const splashPath = path.join(__dirname, "splash.html");
  if (fs.existsSync(splashPath)) {
    mainWindow.loadFile(splashPath);
  } else {
    mainWindow.loadURL(`data:text/html,<html><body style="background:#09090b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><h3>Initializing Sciora Lecturer Console...</h3></body></html>`);
  }

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

ipcMain.handle("open-log-file", () => {
  if (logFilePath && fs.existsSync(logFilePath)) {
    shell.openPath(logFilePath);
  }
});

// App Lifecycle
app.whenReady().then(async () => {
  initLogger();
  log("[Sciora Desktop] App whenReady fired.");

  // 1. Create window and show splash screen immediately
  createMainWindow();

  // 2. Start server in background
  try {
    await startServer();
  } catch (err) {
    logError("[Sciora Desktop] startServer threw:", err);
  }

  // 3. Wait for port 3000 to accept requests
  log("[Sciora Desktop] Waiting for local engine on port " + PORT + "...");
  const isUp = await waitForServer(PORT, 35000);

  if (isUp) {
    log("[Sciora Desktop] Local engine is ready! Loading dashboard...");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`http://localhost:${PORT}/admin`);
    }
  } else {
    logError("[Sciora Desktop] Server timed out on port " + PORT);
    if (mainWindow && !mainWindow.isDestroyed()) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { background: #09090b; color: #fff; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            h2 { color: #f87171; margin-bottom: 8px; font-size: 20px; }
            p { color: #a1a1aa; font-size: 13px; max-width: 440px; line-height: 1.5; margin-bottom: 24px; }
            button { background: #6366f1; color: #fff; border: none; padding: 10px 22px; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 13px; }
            button:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <h2>Engine Startup Delayed</h2>
          <p>The local Sciora classroom engine took longer than expected to bind port 3000. Click below to retry connecting.</p>
          <button onclick="window.location.href='http://localhost:3000/admin'">Open Dashboard</button>
        </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

function stopServer() {
  if (serverProcess) {
    log("[Sciora Desktop] Stopping serverProcess pid=" + serverProcess.pid);
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
