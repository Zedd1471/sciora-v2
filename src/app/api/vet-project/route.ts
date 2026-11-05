import "@/lib/polyfill";
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  getStudent,
  getStudentUsageToday,
  consumeStudentQuota,
  saveVettingReview,
  DAILY_QUOTA_LIMIT,
  normalizeStudentId,
} from "@/lib/vetting/db";
import { extractTextFromFile } from "@/lib/vetting/parser";
import { VETTING_SYSTEM_PROMPT } from "@/lib/vetting/prompt";
import { callGroqChat, isGroqConfigured } from "@/lib/groq";

import fs from "fs";
import path from "path";

export const maxDuration = 60; // Allow sufficient time for large thesis parsing & AI generation

function getGeminiApiKey(): string | undefined {
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

function getGeminiModel(): string {
  if (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim().length > 0) {
    const m = process.env.GEMINI_MODEL.trim();
    if (!m.includes("2.0")) return m;
  }

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GEMINI_MODEL\s*=\s*(.*)$/m);
      if (match) {
        const m = match[1].trim().replace(/^["']|["']$/g, "");
        if (m.length > 0 && !m.includes("2.0")) return m;
      }
    }
  } catch (err) {
    console.warn("Failed to read GEMINI_MODEL fallback:", err);
  }

  return "gemini-2.5-flash";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const rawStudentId = formData.get("studentId") as string | null;
    const projectTitle = (formData.get("projectTitle") as string | null) || "Untitled Project";
    const documentMode = (formData.get("documentMode") as string | null) || "auto";
    const file = formData.get("file") as File | null;
    const pastedText = (formData.get("pastedText") as string | null) || "";

    // 1. Validate Input
    if (!rawStudentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    // 2. Check API Key early (with dynamic .env.local hot-reload fallback)
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Server AI configuration missing: GEMINI_API_KEY is not set. Please make sure you saved .env.local (Ctrl+S) with your Gemini API key.",
        },
        { status: 500 }
      );
    }

    const studentId = normalizeStudentId(rawStudentId);

    // 3. ID Authentication
    const student = await getStudent(studentId);
    if (!student) {
      return NextResponse.json(
        { error: "Student ID not found in authorized vetting directory. Contact your project supervisor." },
        { status: 403 }
      );
    }

    if (!student.is_active) {
      return NextResponse.json(
        { error: `Submissions are closed for your cohort (${student.academic_year}).` },
        { status: 403 }
      );
    }

    // 4. Quota Pre-Check
    const currentUsage = await getStudentUsageToday(studentId);
    if (currentUsage >= DAILY_QUOTA_LIMIT) {
      return NextResponse.json(
        {
          error: "Daily submission quota reached. You are limited to 3 reviews per day to prevent abuse and ensure thoughtful revisions.",
          remaining: 0,
          usedToday: currentUsage,
          limit: DAILY_QUOTA_LIMIT,
        },
        { status: 429 }
      );
    }

    // 5. Extract Text
    let documentContent = "";
    let pdfBase64: string | null = null;
    let fileName = "pasted_text.txt";

    if (file && file.size > 0) {
      fileName = file.name;
      try {
        const parsed = await extractTextFromFile(file);
        if (parsed.pdfBase64) {
          pdfBase64 = parsed.pdfBase64;
        } else {
          documentContent = parsed.text;
        }
      } catch (err) {
        return NextResponse.json(
          { error: `File extraction failed: ${err instanceof Error ? err.message : "Could not read file"}` },
          { status: 400 }
        );
      }
    } else if (pastedText.trim()) {
      documentContent = pastedText.trim();
    } else {
      return NextResponse.json(
        { error: "Please upload a project draft (.docx or .pdf) or paste the chapter text." },
        { status: 400 }
      );
    }

    if (!pdfBase64 && documentContent.length < 50) {
      return NextResponse.json(
        { error: "Document text is too short. Please provide a substantive proposal or project chapter draft." },
        { status: 400 }
      );
    }

    // 6. Call Gemini API
    const ai = new GoogleGenAI({ apiKey });
    const userPrompt = `
PROJECT VETTING SUBMISSION DETAILS:
- Student ID: ${studentId}
${student.name ? `- Student Name: ${student.name}` : ""}
- Academic Year Cohort: ${student.academic_year}
- Project Title: "${projectTitle}"
- Selected Mode Request: ${documentMode}
- Uploaded Document Name: ${fileName}

${pdfBase64 ? "The project manuscript is attached in the accompanying PDF document." : `DOCUMENT DRAFT CONTENT TO AUDIT:\n"""\n${documentContent}\n"""`}

Please perform your comprehensive, rigorous departmental vetting according to the strict 5-step instructions and output all 5 required sections.
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
    contents.push(userPrompt);

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

    let geminiResponse: any = null;
    let lastError: any = null;

    for (const modelCandidate of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          geminiResponse = await ai.models.generateContent({
            model: modelCandidate,
            contents: contents,
            config: {
              systemInstruction: VETTING_SYSTEM_PROMPT,
              temperature: 0.15, // highly consistent, rigorous academic auditing
            },
          });
          if (geminiResponse && geminiResponse.text) break;
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          console.warn(`Model ${modelCandidate} attempt ${attempt + 1} failed:`, errMsg);
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
      if (geminiResponse && geminiResponse.text) break;
    }

    let reviewMarkdown = geminiResponse?.text || "";

    // Automatic fallback to Groq / Grok if Gemini failed and documentContent is present
    if (!reviewMarkdown && isGroqConfigured() && documentContent.length > 50) {
      try {
        console.log("Attempting fallback to Groq (Llama 3.3 70B) for ThesisLab vetting...");
        const groqReview = await callGroqChat({
          messages: [
            { role: "system", content: VETTING_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.15,
        });
        if (groqReview) {
          reviewMarkdown = groqReview;
        }
      } catch (groqErr) {
        console.warn("Groq vetting fallback failed:", groqErr);
      }
    }

    if (!reviewMarkdown) {
      throw lastError || new Error("Failed to generate vetting review with AI models.");
    }

    // 7. Atomic Quota Increment (Only consumed upon successful AI generation!)
    let quotaResult: { newCount: number; remaining: number };
    try {
      quotaResult = await consumeStudentQuota(studentId);
    } catch (quotaErr) {
      console.warn("Quota race condition encountered:", quotaErr);
      return NextResponse.json(
        { error: "Quota limit exceeded during processing.", remaining: 0 },
        { status: 429 }
      );
    }

    // 8. Extract Status / Verdict from markdown for summary
    let statusVerdict = "Review Completed";
    const statusMatch = reviewMarkdown.match(/\*\*Status:\*\*\s*\[?([A-Za-z\s&]+)\]?/i);
    if (statusMatch) {
      const parsed = statusMatch[1].trim();
      if (/ready/i.test(parsed)) statusVerdict = "Ready for Submission";
      else if (/minor/i.test(parsed)) statusVerdict = "Minor Revisions";
      else if (/major/i.test(parsed)) statusVerdict = "Major Revisions";
      else if (/reject/i.test(parsed)) statusVerdict = "Reject & Rewrite";
    } else {
      if (reviewMarkdown.includes("Ready for Submission")) statusVerdict = "Ready for Submission";
      else if (reviewMarkdown.includes("Minor Revisions")) statusVerdict = "Minor Revisions";
      else if (reviewMarkdown.includes("Major Revisions")) statusVerdict = "Major Revisions";
      else if (reviewMarkdown.includes("Reject & Rewrite")) statusVerdict = "Reject & Rewrite";
    }

    // 9. Save review history in Firestore
    const createdAt = new Date().toISOString();
    let reviewId: string | null = null;
    try {
      reviewId = await saveVettingReview({
        student_id: studentId,
        project_title: projectTitle,
        file_name: fileName,
        document_mode: documentMode,
        verdict: statusVerdict,
        review_markdown: reviewMarkdown,
        created_at: createdAt,
      });
    } catch (saveErr) {
      console.warn("Non-fatal: Failed to save review doc:", saveErr);
    }

    // 10. Return result to client
    return NextResponse.json({
      success: true,
      reviewId: reviewId || `rev_${Date.now()}`,
      createdAt,
      review: reviewMarkdown,
      verdict: statusVerdict,
      studentId,
      studentName: student.name || "",
      projectTitle,
      fileName,
      usedToday: quotaResult.newCount,
      remaining: quotaResult.remaining,
      limit: DAILY_QUOTA_LIMIT,
    });
  } catch (error) {
    console.error("Vetting API error:", error);
    const msg = error instanceof Error ? error.message : "An unexpected error occurred during project vetting.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
