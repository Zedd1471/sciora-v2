import "@/lib/polyfill";
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, getGeminiModel } from "@/lib/gemini";
import { callGroqChat, isGroqConfigured } from "@/lib/groq";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      questionText,
      options,
      correctAnswer,
      studentAnswer,
      courseCode,
      courseTitle,
    } = body;

    if (!questionText || !correctAnswer) {
      return NextResponse.json(
        { error: "Question text and correct answer are required." },
        { status: 400 }
      );
    }

    const prompt = `You are a helpful university professor providing quick, clear, pedagogical feedback to a student reviewing a test question.

COURSE: ${courseCode ? `${courseCode} (${courseTitle || ""})` : "General University Course"}
QUESTION: "${questionText}"
OPTIONS:
${Array.isArray(options) ? options.map((opt: string, i: number) => `(${String.fromCharCode(65 + i)}) ${opt}`).join("\n") : "N/A"}

CORRECT ANSWER: "${correctAnswer}"
STUDENT'S ANSWER: ${studentAnswer ? `"${studentAnswer}"` : "Not answered"}

TASK:
Provide a clear, encouraging, academic explanation in pure JSON:
{
  "explanation": "Direct explanation of why the correct answer is right (2-3 sentences max).",
  "misconception": ${studentAnswer && studentAnswer !== correctAnswer ? `"Brief explanation of why the student's answer '${studentAnswer}' is incorrect or a common confusion (1-2 sentences)."` : "null"},
  "takeaway": "A concise 1-sentence mnemonic or key rule to remember."
}

Return strictly valid JSON with no markdown formatting.`;

    let explanationData: {
      explanation?: string;
      misconception?: string | null;
      takeaway?: string;
    } | null = null;
    let providerUsed = "gemini";

    // 1. Try Google Gemini first
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const candidateModels = [getGeminiModel(), "gemini-2.5-flash", "gemini-2.5-flash-lite"].filter(
        (m, idx, arr) => arr.indexOf(m) === idx && !m.includes("2.0") && !m.includes("1.5")
      );

      for (const model of candidateModels) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.25,
            },
          });

          if (res?.text) {
            const cleaned = res.text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
            explanationData = JSON.parse(cleaned);
            providerUsed = `gemini (${model})`;
            break;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`Gemini explanation attempt on ${model} failed:`, msg);
        }
      }
    }

    // 2. Fallback to Groq / Grok if Gemini failed or key not configured
    if (!explanationData && isGroqConfigured()) {
      try {
        const groqOutput = await callGroqChat({
          messages: [
            {
              role: "system",
              content:
                "You are an expert university professor explaining multiple-choice question answers clearly to undergraduate students. Always return pure JSON.",
            },
            { role: "user", content: prompt },
          ],
          responseFormat: "json",
          temperature: 0.25,
        });

        if (groqOutput) {
          const cleaned = groqOutput.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
          explanationData = JSON.parse(cleaned);
          providerUsed = "groq (llama-3.3-70b)";
        }
      } catch (groqErr) {
        console.warn("Groq explanation fallback failed:", groqErr);
      }
    }

    if (!explanationData || !explanationData.explanation) {
      return NextResponse.json(
        {
          error:
            "Could not generate an explanation at this moment. Please check API keys or try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      explanation: explanationData.explanation,
      misconception: explanationData.misconception || null,
      takeaway: explanationData.takeaway || null,
      provider: providerUsed,
    });
  } catch (error) {
    console.error("Explain Question Error:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation." },
      { status: 500 }
    );
  }
}

