import { NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfBase64 = buffer.toString("base64");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
        "Extract all multiple-choice questions, options, and answer keys from this document verbatim. Return the plain text without extra commentary so it can be parsed into tests.",
      ],
    });

    return NextResponse.json({ text: response.text || "" });
  } catch (error) {
    console.error('Error parsing PDF with AI:', error);
    return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 });
  }
}
