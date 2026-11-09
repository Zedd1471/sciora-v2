import { base32Encode } from "./totp";

export interface AttendanceSession {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  createdAt: string;
  endedAt?: string;
  status: "active" | "ended";
  secretSeed: string;
  stepSeconds: number;
  attendeeCount: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  courseId: string;
  courseCode: string;
  studentId: string;
  studentName?: string;
  timestamp: string;
  method: "qr_scan" | "short_code" | "manual";
}

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, "").toUpperCase();
  const lookup: Record<string, number> = {};
  for (let i = 0; i < BASE32_CHARS.length; i++) lookup[BASE32_CHARS[i]] = i;

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = lookup[char];
    if (idx === undefined) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export function generateAttendanceSecret(bytes = 20): string {
  const buffer = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    // Fallback for non-browser/node environments if necessary
    for (let i = 0; i < bytes; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return base32Encode(buffer);
}

async function hmacSha1(secret: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const subtle =
    typeof crypto !== "undefined" && crypto.subtle
      ? crypto.subtle
      : (await import("crypto")).webcrypto?.subtle;

  if (!subtle) {
    throw new Error("Web Crypto API is not available.");
  }

  const key = await subtle.importKey(
    "raw",
    secret as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await subtle.sign("HMAC", key, message as BufferSource);
  return new Uint8Array(sig);
}

function intToBytes(num: number): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = Math.floor(num / 256);
  }
  return bytes;
}

export async function generateTOTPForStep(secret: string, timeStep: number): Promise<string> {
  const key = base32Decode(secret);
  const msg = intToBytes(timeStep);
  const hash = await hmacSha1(key, msg);

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Returns the current rolling 6-digit code and the seconds remaining in the current window.
 */
export async function getLiveAttendanceCode(
  secret: string,
  stepSeconds = 20
): Promise<{ code: string; secondsRemaining: number; step: number }> {
  const now = Math.floor(Date.now() / 1000);
  const step = Math.floor(now / stepSeconds);
  const secondsRemaining = stepSeconds - (now % stepSeconds);
  const code = await generateTOTPForStep(secret, step);
  return { code, secondsRemaining, step };
}

/**
 * Verifies a code against a secret with window tolerance (step ± 1).
 */
export async function verifyAttendanceCode(
  candidateCode: string,
  secret: string,
  stepSeconds = 20,
  windowSteps = 2
): Promise<boolean> {
  if (!candidateCode || candidateCode.trim().length !== 6) return false;
  const cleanCode = candidateCode.trim();
  const now = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(now / stepSeconds);

  for (let i = -windowSteps; i <= windowSteps; i++) {
    const code = await generateTOTPForStep(secret, currentStep + i);
    if (code === cleanCode) return true;
  }
  return false;
}

/**
 * Standardizes student IDs (e.g., " bth/19/0421 " -> "BTH/19/0421").
 */
export function normalizeStudentId(id: string): string {
  return id ? id.trim().toUpperCase() : "";
}

/**
 * Validates student ID format (e.g. ABC/12A/3456 or BTH/19/1234).
 */
export function validateStudentIdFormat(id: string): boolean {
  if (!id) return false;
  const normalized = normalizeStudentId(id);
  return /^[A-Z0-9]+(\/[A-Z0-9]+)+$/.test(normalized);
}

/**
 * Exports attendance records to CSV and initiates browser download.
 */
export function exportAttendanceToCsv(
  session: { courseCode: string; title: string; createdAt?: string },
  records: AttendanceRecord[]
): void {
  if (typeof window === "undefined" || !records) return;

  const rows: string[][] = [
    ["Student ID", "Student Name", "Course", "Session Topic", "Check-in Time", "Method"],
  ];

  // Sort by student ID
  const sorted = [...records].sort((a, b) => a.studentId.localeCompare(b.studentId));

  sorted.forEach((r) => {
    rows.push([
      r.studentId,
      r.studentName || "N/A",
      session.courseCode,
      session.title,
      r.timestamp ? new Date(r.timestamp).toLocaleString() : "",
      r.method === "qr_scan" ? "QR Scan" : r.method === "short_code" ? "6-Digit Code" : "Manual",
    ]);
  });

  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeSessionTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, "_");
  a.download = `${session.courseCode}_Attendance_${safeSessionTitle}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
