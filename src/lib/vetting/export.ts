import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface ExportReportData {
  studentId: string;
  studentName?: string;
  projectTitle: string;
  verdict: string;
  reviewMarkdown: string;
  createdAt: string;
  trialNumber?: number;
  fileName?: string;
  documentMode?: string;
}

function getVerdictColorHex(verdict: string): { bgHex: string; fgHex: string } {
  const v = verdict.toLowerCase();
  if (v.includes("ready")) return { bgHex: "16A34A", fgHex: "FFFFFF" };
  if (v.includes("minor")) return { bgHex: "0D9488", fgHex: "FFFFFF" };
  if (v.includes("major")) return { bgHex: "D97706", fgHex: "FFFFFF" };
  if (v.includes("reject")) return { bgHex: "DC2626", fgHex: "FFFFFF" };
  return { bgHex: "4F46E5", fgHex: "FFFFFF" };
}

function getVerdictColorRgb(verdict: string): [number, number, number] {
  const v = verdict.toLowerCase();
  if (v.includes("ready")) return [0.08, 0.64, 0.29];
  if (v.includes("minor")) return [0.05, 0.58, 0.53];
  if (v.includes("major")) return [0.85, 0.47, 0.02];
  if (v.includes("reject")) return [0.86, 0.15, 0.15];
  return [0.31, 0.27, 0.9];
}

function sanitizeFileName(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Clean markdown symbols for cleaner plain text rendering
 */
function cleanMarkdownLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

/**
 * Generate and download a formatted Word Document (.docx)
 */
export async function exportAuditToDocx(data: ExportReportData): Promise<void> {
  const { bgHex, fgHex } = getVerdictColorHex(data.verdict);
  const safeId = sanitizeFileName(data.studentId);
  const trialText = data.trialNumber ? `Trial #${data.trialNumber}` : "Audit Trial";
  const dateStr = new Date(data.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const children: (Paragraph | Table)[] = [];

  // Header Titles
  children.push(
    new Paragraph({
      text: "DEPARTMENT OF MICROBIOLOGY — ACADEMIC VETTING COMMITTEE",
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      run: {
        size: 20,
        font: "Arial",
        color: "666666",
        bold: true,
      },
    }),
    new Paragraph({
      text: "Undergraduate Project Vetting & Editorial Audit Report",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      run: {
        size: 32,
        font: "Arial",
        bold: true,
        color: "1E1B4B",
      },
    })
  );

  // Metadata Table
  const tableRows: TableRow[] = [];

  if (data.studentName) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "Student Name:", bold: true })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: data.studentName })],
          }),
        ],
      })
    );
  }

  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: "Student ID:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: data.studentId })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: "Project Topic:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: data.projectTitle || "N/A" })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: "Audit Trial & Date:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: `${trialText} — ${dateStr}` })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: "Analyzed Draft:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ text: data.fileName || "Pasted Manuscript Text" })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: "Overall Verdict:", bold: true })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          shading: { fill: bgHex, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: data.verdict.toUpperCase(),
                  bold: true,
                  color: fgHex,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }),
    new Paragraph({ text: "", spacing: { after: 280 } })
  );

  // Parse Markdown Sections into DOCX Paragraphs
  const lines = data.reviewMarkdown.split("\n");
  let inSupervisorMemo = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      continue;
    }

    if (trimmed.startsWith("### 4.") || trimmed.toLowerCase().includes("supervisor's feedback memo")) {
      inSupervisorMemo = true;
    } else if (trimmed.startsWith("### 5.") || trimmed.toLowerCase().includes("action checklist")) {
      inSupervisorMemo = false;
    }

    if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          text: cleanMarkdownLine(trimmed),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          text: cleanMarkdownLine(trimmed),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          text: cleanMarkdownLine(trimmed),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 },
        })
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const clean = cleanMarkdownLine(trimmed.substring(2));
      children.push(
        new Paragraph({
          text: clean,
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    } else {
      const clean = cleanMarkdownLine(trimmed);
      if (inSupervisorMemo) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: clean, italics: true, color: "374151" })],
            spacing: { after: 80 },
            border: {
              left: { color: "6366F1", size: 12, style: BorderStyle.SINGLE, space: 10 },
            },
          })
        );
      } else {
        children.push(
          new Paragraph({
            text: clean,
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                text: "Sciora ThesisLab — Academic Project Vetting",
                alignment: AlignmentType.RIGHT,
                run: { size: 16, color: "999999" },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "888888" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }),
                  new TextRun({ text: " — Confidential Academic Audit", size: 16, color: "888888" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `ThesisLab_Audit_${safeId}_Trial_${data.trialNumber || 1}.docx`);
}

/**
 * Generate and download a formatted PDF Document (.pdf) using pdf-lib
 */
export async function exportAuditToPdf(data: ExportReportData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const safeId = sanitizeFileName(data.studentId);
  const trialText = data.trialNumber ? `Trial #${data.trialNumber}` : "Audit Trial";
  const dateStr = new Date(data.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89; // A4
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  // Helper to split text into lines fitting within max width
  const wrapText = (text: string, maxWidth: number, font: any, size: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // 1. Department Header Banner
  currentPage.drawRectangle({
    x: 0,
    y: pageHeight - 8,
    width: pageWidth,
    height: 8,
    color: rgb(0.31, 0.27, 0.9), // Indigo accent
  });

  currentPage.drawText("DEPARTMENT OF MICROBIOLOGY — ACADEMIC VETTING COMMITTEE", {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 18;

  currentPage.drawText("Project Vetting & Editorial Audit Report", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.12),
  });
  y -= 24;

  // Metadata Box
  currentPage.drawRectangle({
    x: margin,
    y: y - 72,
    width: contentWidth,
    height: 72,
    color: rgb(0.96, 0.96, 0.97),
    borderColor: rgb(0.88, 0.88, 0.9),
    borderWidth: 1,
  });

  const studentText = data.studentName
    ? `Student:  ${data.studentName} (${data.studentId})`
    : `Student ID:  ${data.studentId}`;

  currentPage.drawText(studentText, {
    x: margin + 12,
    y: y - 18,
    size: 9.5,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.15),
  });

  currentPage.drawText(`Trial:  ${trialText} (${dateStr})`, {
    x: margin + 260,
    y: y - 18,
    size: 9,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.35),
  });

  const topicLines = wrapText(`Project Topic: ${data.projectTitle || "N/A"}`, contentWidth - 24, fontRegular, 9.5);
  currentPage.drawText(topicLines[0] || "", {
    x: margin + 12,
    y: y - 36,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.25),
  });

  currentPage.drawText(`Document: ${data.fileName || "Draft Manuscript"}`, {
    x: margin + 12,
    y: y - 54,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.45),
  });

  // Verdict Pill
  const [vr, vg, vb] = getVerdictColorRgb(data.verdict);
  const verdictPillWidth = 160;
  currentPage.drawRectangle({
    x: pageWidth - margin - verdictPillWidth - 12,
    y: y - 62,
    width: verdictPillWidth,
    height: 20,
    color: rgb(vr, vg, vb),
  });

  currentPage.drawText(data.verdict.toUpperCase(), {
    x: pageWidth - margin - verdictPillWidth + 6,
    y: y - 56,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 95;

  // 2. Render Review Content Lines
  const rawLines = data.reviewMarkdown.split("\n");

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y -= 8;
      if (y < margin + 30) addNewPage();
      continue;
    }

    // Heading 1 / 2 / 3
    if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
      const clean = cleanMarkdownLine(trimmed);
      y -= 14;
      if (y < margin + 40) addNewPage();

      currentPage.drawText(clean, {
        x: margin,
        y,
        size: 12,
        font: fontBold,
        color: rgb(0.12, 0.12, 0.3),
      });
      y -= 16;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const clean = cleanMarkdownLine(trimmed.substring(2));
      const wrapped = wrapText(clean, contentWidth - 20, fontRegular, 9.5);

      for (let i = 0; i < wrapped.length; i++) {
        if (y < margin + 25) addNewPage();
        if (i === 0) {
          currentPage.drawText("•", {
            x: margin + 4,
            y,
            size: 11,
            font: fontBold,
            color: rgb(0.31, 0.27, 0.9),
          });
        }
        currentPage.drawText(wrapped[i], {
          x: margin + 16,
          y,
          size: 9.5,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.2),
        });
        y -= 13;
      }
    } else {
      const clean = cleanMarkdownLine(trimmed);
      const wrapped = wrapText(clean, contentWidth, fontRegular, 9.5);

      for (const line of wrapped) {
        if (y < margin + 25) addNewPage();
        currentPage.drawText(line, {
          x: margin,
          y,
          size: 9.5,
          font: fontRegular,
          color: rgb(0.18, 0.18, 0.22),
        });
        y -= 13;
      }
    }
  }

  // Draw Page Footers
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    p.drawText(`Page ${i + 1} of ${pageCount} — Confidential Academic Vetting Audit`, {
      x: margin,
      y: 20,
      size: 8,
      font: fontItalic,
      color: rgb(0.5, 0.5, 0.55),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  triggerDownload(blob, `ThesisLab_Audit_${safeId}_Trial_${data.trialNumber || 1}.pdf`);
}
