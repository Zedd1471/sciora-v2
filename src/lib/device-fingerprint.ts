/**
 * Lightweight, zero-dependency browser device fingerprinting.
 * Combines hardware screen dimensions, canvas rendering signature, timezone,
 * and a persistent local device token.
 */

function getCanvasHash(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial', sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Sciora-Offline-Classroom, 101", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Sciora-Offline-Classroom, 101", 4, 17);

    return canvas.toDataURL().slice(-40);
  } catch {
    return "canvas-err";
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server-env";

  // 1. Get or create persistent device UUID
  let deviceUuid = localStorage.getItem("sciora_device_uuid");
  if (!deviceUuid) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      deviceUuid = crypto.randomUUID();
    } else {
      deviceUuid = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
    try {
      localStorage.setItem("sciora_device_uuid", deviceUuid);
    } catch {
      // private browsing / storage quota
    }
  }

  // 2. Extract hardware & browser characteristics
  const canvasSignature = getCanvasHash();
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const timezone = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "";
  const concurrency = navigator.hardwareConcurrency || 1;
  const userAgent = navigator.userAgent;

  const rawSeed = `${deviceUuid}|${canvasSignature}|${screenInfo}|${timezone}|${concurrency}|${userAgent}`;

  // 3. Hash with SHA-256 using Web Crypto
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawSeed);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
  } catch {
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < rawSeed.length; i++) {
      hash = (hash << 5) - hash + rawSeed.charCodeAt(i);
      hash |= 0;
    }
    return `fp_${Math.abs(hash).toString(16)}`;
  }
}

