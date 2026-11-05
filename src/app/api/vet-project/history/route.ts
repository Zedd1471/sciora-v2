import { NextResponse } from "next/server";
import { getStudentReviews, normalizeStudentId } from "@/lib/vetting/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawStudentId = searchParams.get("studentId");

    if (!rawStudentId) {
      return NextResponse.json({ error: "Student ID parameter is required" }, { status: 400 });
    }

    const studentId = normalizeStudentId(rawStudentId);
    const reviews = await getStudentReviews(studentId);

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Failed to fetch student review history:", error);
    const msg = error instanceof Error ? error.message : "Failed to load review history";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
