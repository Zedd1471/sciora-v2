import "@/lib/polyfill";
import mammoth from "mammoth";

export async function extractTextFromFile(
  file: File
): Promise<{ text: string; pageEstimate?: number; pdfBase64?: string }> {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    if (!text) {
      throw new Error("The DOCX document appears to be empty or unreadable.");
    }
    return { text };
  }

  if (fileName.endsWith(".pdf")) {
    return {
      text: "PDF document uploaded.",
      pdfBase64: buffer.toString("base64"),
    };
  }

  if (fileName.endsWith(".txt")) {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new Error("The text file is empty.");
    return { text };
  }

  throw new Error("Unsupported file format. Please upload a .docx, .pdf, or .txt file.");
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  nameOrUrl: string
): Promise<{ text?: string; pdfBase64?: string }> {
  const lower = nameOrUrl.toLowerCase();

  if (lower.includes(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    if (!text) throw new Error("The DOCX document appears to be empty or unreadable.");
    return { text };
  }

  if (lower.includes(".txt")) {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new Error("The text file is empty.");
    return { text };
  }

  // Default to PDF
  return {
    pdfBase64: buffer.toString("base64"),
  };
}
