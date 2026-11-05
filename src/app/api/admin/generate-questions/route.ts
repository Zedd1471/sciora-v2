import "@/lib/polyfill";
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, getGeminiModel } from "@/lib/gemini";
import { callGroqChat, isGroqConfigured } from "@/lib/groq";
import { extractTextFromFile, extractTextFromBuffer } from "@/lib/vetting/parser";

export const maxDuration = 60; // Allow sufficient time for AI generation & parsing

export async function POST(req: Request) {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment or .env.local.",
        },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const materialUrl = formData.get("materialUrl") as string | null;
    const pastedText = (formData.get("pastedText") as string | null) || "";
    const difficulty = (formData.get("difficulty") as string | null) || "medium";
    const rawCount = formData.get("questionCount") as string | null;
    const questionCount = rawCount ? Math.max(5, Math.min(50, parseInt(rawCount, 10))) : 20;
    const focusTopic = (formData.get("focusTopic") as string | null) || "";
    const courseCode = (formData.get("courseCode") as string | null) || "";
    const courseTitle = (formData.get("courseTitle") as string | null) || "";

    // 1. Extract content from source
    let documentText = "";
    let pdfBase64: string | null = null;
    let sourceName = "Pasted Notes";

    if (file && file.size > 0) {
      sourceName = file.name;
      try {
        const parsed = await extractTextFromFile(file);
        if (parsed.pdfBase64) {
          pdfBase64 = parsed.pdfBase64;
        } else {
          documentText = parsed.text;
        }
      } catch (err) {
        return NextResponse.json(
          { error: `Could not parse uploaded file: ${err instanceof Error ? err.message : "Invalid document"}` },
          { status: 400 }
        );
      }
    } else if (materialUrl && materialUrl.trim()) {
      sourceName = "Course Lecture Note";
      try {
        const cleanUrl = materialUrl.replace("/fl_attachment", "");
        const res = await fetch(cleanUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to download document`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const parsed = await extractTextFromBuffer(buffer, cleanUrl);
        if (parsed.pdfBase64) {
          pdfBase64 = parsed.pdfBase64;
        } else if (parsed.text) {
          documentText = parsed.text;
        }
      } catch (err) {
        return NextResponse.json(
          { error: `Could not load course material: ${err instanceof Error ? err.message : "Network error"}` },
          { status: 400 }
        );
      }
    } else if (pastedText.trim()) {
      documentText = pastedText.trim();
    } else {
      return NextResponse.json(
        { error: "Please select an existing course document, upload a lecture file, or paste lecture notes." },
        { status: 400 }
      );
    }

    if (!pdfBase64 && documentText.length < 50) {
      return NextResponse.json(
        { error: "The document text is too short to generate a reliable question bank." },
        { status: 400 }
      );
    }

    // 2. Build Gemini prompt
    const difficultyDescriptions: Record<string, string> = {
      easy: "Foundational knowledge, basic definitions, direct factual recall, and key terms explicitly stated in the text.",
      medium: "Conceptual comprehension, application of principles, distinguishing similar concepts, and interpreting processes.",
      hard: "Advanced critical thinking, complex multi-step scenario analysis, diagnosing problem cases, and synthesis of ideas.",
      mixed: "Balanced across Bloom's Taxonomy: approximately 30% Easy (recall), 50% Medium (application), and 20% Hard (analysis/synthesis).",
    };

    const targetDifficultyDesc = difficultyDescriptions[difficulty.toLowerCase()] || difficultyDescriptions.medium;

    const promptText = `
You are an expert university professor and psychometrics assessment specialist.
Analyze the provided university lecture material ("${sourceName}") for ${courseCode ? `${courseCode} (${courseTitle})` : "this course"} and create a high-quality, rigorous multiple-choice question bank.

${documentText ? `LECTURE NOTES:\n"""\n${documentText.slice(0, 150000)}\n"""\n` : "The lecture notes are attached in the accompanying PDF document."}

TASK REQUIREMENTS:
1. Generate exactly ${questionCount} multiple-choice questions grounded STRICTLY in the provided notes.
2. Target Difficulty Level: "${difficulty.toUpperCase()}".
   - Pedagogical target: ${targetDifficultyDesc}
${focusTopic.trim() ? `3. Specific Focus Area: Focus primarily on "${focusTopic.trim()}".` : ""}
4. Quality & Formatting Rules:
   - The question stem must be clear, unambiguous, and grammatically complete.
   - Provide EXACTLY 4 distinct, plausible options (A, B, C, D).
   - Distractors must be realistic and scientifically plausible based on the subject matter.
   - Do NOT use "All of the above" or "None of the above".
   - Exactly one answer is correct. The "correct" field must match the exact string of that option.
5. Also provide:
   - A concise, academic "suggestedTitle" for the test (e.g., "Assessment: Cellular Respiration & Krebs Cycle").

OUTPUT FORMAT:
Return pure, valid JSON with this exact structure:
{
  "suggestedTitle": "Title of the test",
  "questions": [
    {
      "text": "What is the primary function of...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "Option B"
    }
  ]
}
`;

    const contents: any[] = [];
    if (pdfBase64) {
      contents.push({
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      });
    }
    contents.push(promptText);

    // 3. Invoke Gemini with automatic high-demand fallback
    const ai = new GoogleGenAI({ apiKey });
    const primaryModel = getGeminiModel();
    const candidateModels = [
      primaryModel,
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
    ].filter(
      (m, idx, arr) =>
        arr.indexOf(m) === idx && !m.includes("2.0") && !m.includes("1.5")
    );

    let response: any = null;
    const modelErrors: string[] = [];

    for (const modelCandidate of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelCandidate,
            contents: contents,
            config: {
              responseMimeType: "application/json",
              temperature: 0.35,
            },
          });
          if (response && response.text) break;
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          modelErrors.push(`[${modelCandidate} attempt ${attempt + 1}]: ${errMsg}`);
          console.warn(`Model ${modelCandidate} attempt ${attempt + 1} failed:`, errMsg);
          // If model is completely unavailable/404, break to next candidate immediately
          if (
            errMsg.includes("404") ||
            errMsg.includes("NOT_FOUND") ||
            errMsg.includes("not found") ||
            errMsg.includes("not supported")
          ) {
            break;
          }
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }
      if (response && response.text) break;
    }

    let responseText = response?.text || "";

    // 4. Automatic fallback to Groq / Grok if Gemini attempts failed
    if (!responseText && isGroqConfigured() && documentText.length >= 50) {
      try {
        console.log("Attempting automatic fallback to Groq (Llama 3.3 70B)...");
        const groqResponse = await callGroqChat({
          messages: [
            {
              role: "system",
              content:
                "You are an expert university professor and psychometrics assessment specialist. Always return pure JSON matching the requested structure.",
            },
            {
              role: "user",
              content: promptText,
            },
          ],
          responseFormat: "json",
          temperature: 0.35,
        });
        if (groqResponse) {
          responseText = groqResponse;
        }
      } catch (groqErr) {
        console.warn("Groq question generator fallback failed:", groqErr);
      }
    }

    if (!responseText) {
      throw new Error(modelErrors.join(" | ") || "Failed to generate questions with AI models.");
    }
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Clean possible markdown code fence
      const cleaned = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsedData = JSON.parse(cleaned);
    }

    if (!parsedData || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
      throw new Error("AI returned an invalid question structure.");
    }

    // Map into Sciora's Question format with unique IDs
    const formattedQuestions = parsedData.questions.map((q: any, idx: number) => {
      const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o).trim()) : [];
      let correct = String(q.correct || "").trim();

      // Ensure correct matches one of the options
      if (!options.includes(correct) && options.length > 0) {
        // If correct was given as "A", "B", etc.
        const letterIdx = ["a", "b", "c", "d"].indexOf(correct.toLowerCase());
        if (letterIdx >= 0 && options[letterIdx]) {
          correct = options[letterIdx];
        } else {
          correct = options[0];
        }
      }

      return {
        id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        text: String(q.text || "").trim(),
        options,
        correct,
      };
    });

    return NextResponse.json({
      success: true,
      suggestedTitle: parsedData.suggestedTitle || `${courseCode ? `${courseCode} ` : ""}Quiz`,
      questions: formattedQuestions,
    });
  } catch (error) {
    console.error("AI Question Generation Error:", error);
    let msg = error instanceof Error ? error.message : "Failed to generate question bank with AI.";
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {
      // not json
    }

    if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || msg.includes("401") || msg.includes("403")) {
      msg = "Invalid Gemini API Key. Please make sure your GEMINI_API_KEY in .env.local is a valid key from Google AI Studio (starts with 'AIzaSy...').";
    } else if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
      msg = "Gemini API rate limit reached. Please wait a moment and click Generate again.";
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

