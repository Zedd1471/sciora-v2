const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  const skipNext = process.argv.includes("--skip-next");
  if (!skipNext) {
    console.log("=== [1/4] Building Next.js Standalone Engine ===");
    process.env.BUILD_STANDALONE = "true";
    execSync("npx next build --webpack", {
      stdio: "inherit",
      env: { ...process.env, BUILD_STANDALONE: "true" },
    });
  } else {
    console.log("=== [1/4] Skipping Next.js build (using existing standalone) ===");
  }

  console.log("=== [2/4] Copying Static Assets into Standalone ===");
  const root = path.resolve(__dirname, "..");
  const standaloneDir = path.join(root, ".next", "standalone");
  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standaloneDir, "public");
  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");

  copyDir(publicSrc, publicDest);
  copyDir(staticSrc, staticDest);

  console.log("=== [3/4] Packaging Instant-Launch Sciora Desktop Application ===");
  const builderCli = path.join(root, "node_modules", "electron-builder", "cli.js");
  execSync(`node "${builderCli}" --config electron-builder.yml`, {
    stdio: "inherit",
  });

  console.log("=== [4/4] Desktop Build Complete! ===");
  console.log("1. Installer: dist-desktop/Sciora-Lecturer-Setup.exe");
  console.log("2. Direct App: dist-desktop/win-unpacked/Sciora Lecturer Console.exe");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
