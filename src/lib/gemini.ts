import fs from "fs";
import path from "path";

export function getGeminiApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
    return process.env.GEMINI_API_KEY.trim();
  }

  // Fallback: read .env.local directly to support hot updates without server restart
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
      if (match) {
        const key = match[1].trim().replace(/^["']|["']$/g, "");
        if (key.length > 0) return key;
      }
    }
  } catch (err) {
    console.warn("Failed to read .env.local fallback:", err);
  }

  return undefined;
}

export function getGeminiModel(): string {
  if (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim().length > 0) {
    const m = process.env.GEMINI_MODEL.trim();
    if (!m.includes("2.0") && !m.includes("1.5")) return m;
  }

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GEMINI_MODEL\s*=\s*(.*)$/m);
      if (match) {
        const m = match[1].trim().replace(/^["']|["']$/g, "");
        if (m.length > 0 && !m.includes("2.0") && !m.includes("1.5")) return m;
      }
    }
  } catch (err) {
    console.warn("Failed to read GEMINI_MODEL fallback:", err);
  }

  return "gemini-2.5-flash";
}

