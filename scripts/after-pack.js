const fs = require("fs");
const path = require("path");

/**
 * electron-builder afterPack hook
 * Ensures the Next.js standalone engine, its traced node_modules, and public assets
 * are fully and reliably present in the packaged resources directory.
 */
exports.default = async function (context) {
  const appOutDir = context.appOutDir;
  const projectDir = context.packager.projectDir;
  const resourcesDir = path.join(appOutDir, "resources");
  const targetStandalone = path.join(resourcesDir, "standalone");
  const sourceStandalone = path.join(projectDir, ".next", "standalone");

  console.log("\n[afterPack] === Verifying Standalone Next.js Bundle ===");
  console.log(`[afterPack] Source: ${sourceStandalone}`);
  console.log(`[afterPack] Target: ${targetStandalone}`);

  if (!fs.existsSync(sourceStandalone)) {
    console.warn("[afterPack] WARNING: .next/standalone does not exist yet!");
    return;
  }

  // 1. Ensure target standalone directory exists
  fs.mkdirSync(targetStandalone, { recursive: true });

  // 2. Copy node_modules if missing in target
  const srcNodeModules = path.join(sourceStandalone, "node_modules");
  const destNodeModules = path.join(targetStandalone, "node_modules");

  if (fs.existsSync(srcNodeModules)) {
    console.log(`[afterPack] Copying standalone node_modules into package...`);
    fs.cpSync(srcNodeModules, destNodeModules, { recursive: true });
    console.log(`[afterPack] Standalone node_modules successfully copied.`);
  } else {
    console.error(`[afterPack] ERROR: ${srcNodeModules} not found!`);
  }

  // 3. Ensure static assets and public assets are copied
  const srcStatic = path.join(projectDir, ".next", "static");
  const destStatic = path.join(targetStandalone, ".next", "static");
  if (fs.existsSync(srcStatic)) {
    fs.mkdirSync(path.dirname(destStatic), { recursive: true });
    fs.cpSync(srcStatic, destStatic, { recursive: true });
    console.log(`[afterPack] .next/static successfully synced.`);
  }

  const srcPublic = path.join(projectDir, "public");
  const destPublic = path.join(targetStandalone, "public");
  if (fs.existsSync(srcPublic)) {
    fs.cpSync(srcPublic, destPublic, { recursive: true });
    console.log(`[afterPack] public directory successfully synced.`);
  }

  // 4. Ensure .env.local exists in target
  const srcEnv = path.join(projectDir, ".env.local");
  const destEnv = path.join(targetStandalone, ".env.local");
  if (fs.existsSync(srcEnv)) {
    fs.copyFileSync(srcEnv, destEnv);
    console.log(`[afterPack] .env.local copied to standalone.`);
  }

  // 5. Verify server.js exists
  const destServer = path.join(targetStandalone, "server.js");
  if (!fs.existsSync(destServer)) {
    const srcServer = path.join(sourceStandalone, "server.js");
    if (fs.existsSync(srcServer)) {
      fs.copyFileSync(srcServer, destServer);
    }
  }

  console.log("[afterPack] Standalone Next.js Engine verification complete!\n");
};

