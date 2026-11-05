import fs from "fs";
import path from "path";

/**
 * Retrieves the Groq / xAI API key from environment variables or .env.local
 */
export function getGroqApiKey(): string | undefined {
  const direct =
    process.env.GROQ_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.XAI_API_KEY;
  if (direct && direct.trim().length > 0) {
    return direct.trim();
  }

  // Fallback: read .env.local directly to support hot updates without server restart
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(
        /^(?:GROQ_API_KEY|GROK_API_KEY|XAI_API_KEY)\s*=\s*(.*)$/m
      );
      if (match) {
        const key = match[1].trim().replace(/^["']|["']$/g, "");
        if (key.length > 0) return key;
      }
    }
  } catch (err) {
    console.warn("Failed to read Groq API key fallback:", err);
  }

  return undefined;
}

export function isGroqConfigured(): boolean {
  return Boolean(getGroqApiKey());
}

export interface GroqChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  responseFormat?: "json" | "text";
}

/**
 * Calls Groq chat completion API with automatic model fallback
 */
export async function callGroqChat({
  messages,
  model = "llama-3.3-70b-versatile",
  temperature = 0.3,
  responseFormat = "text",
}: GroqChatOptions): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const isXai = apiKey.startsWith("xai-");
  const endpoint = isXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";

  const candidateModels = isXai
    ? ["grok-2-latest", "grok-beta"]
    : [model, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

  let lastError: Error | null = null;

  for (const targetModel of candidateModels) {
    try {
      const body: Record<string, unknown> = {
        model: targetModel,
        messages,
        temperature,
      };
      if (responseFormat === "json") {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const output = data.choices?.[0]?.message?.content;
      if (output && typeof output === "string") {
        return output.trim();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(errMsg);
      console.warn(`Groq model ${targetModel} failed:`, errMsg);
    }
  }

  throw lastError || new Error("Failed to generate response with Groq fallback.");
}

