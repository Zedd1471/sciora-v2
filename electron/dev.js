const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = 3000;

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}`, (res) => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function run() {
  const isUp = await checkServer();
  let nextProcess = null;

  if (!isUp) {
    console.log("[Electron Dev] Starting Next.js dev server on 0.0.0.0:3000...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    nextProcess = spawn(npmCmd, ["run", "dev"], {
      shell: true,
      stdio: "inherit",
    });

    console.log("[Electron Dev] Waiting for Next.js dev server to respond...");
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ready = await checkServer();
      if (ready) break;
    }

    if (!ready) {
      console.error("[Electron Dev] Timeout waiting for Next.js to start.");
      process.exit(1);
    }
  }

  console.log("[Electron Dev] Next.js ready! Launching Electron...");
  const electronPath = require("electron");
  const electronProcess = spawn(electronPath, [path.join(__dirname, "main.js")], {
    stdio: "inherit",
  });

  electronProcess.on("close", () => {
    if (nextProcess) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(nextProcess.pid), "/f", "/t"]);
      } else {
        nextProcess.kill();
      }
    }
    process.exit(0);
  });
}

run();

