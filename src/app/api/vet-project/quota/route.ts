import { NextResponse } from "next/server";
import { getStudent, getStudentUsageToday, DAILY_QUOTA_LIMIT, normalizeStudentId } from "@/lib/vetting/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("studentId");

    if (!rawId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const studentId = normalizeStudentId(rawId);
    const student = await getStudent(studentId);

    if (!student) {
      return NextResponse.json(
        {
          error: "Student ID is not registered in the project vetting directory. Please contact your supervisor to be added.",
          code: "STUDENT_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    if (!student.is_active) {
      return NextResponse.json(
        {
          error: `Your cohort (${student.academic_year}) has been deactivated. Submissions are closed for this academic session.`,
          code: "STUDENT_INACTIVE",
          academicYear: student.academic_year,
          isActive: false,
        },
        { status: 403 }
      );
    }

    const usedToday = await getStudentUsageToday(studentId);
    const remaining = Math.max(0, DAILY_QUOTA_LIMIT - usedToday);

    return NextResponse.json({
      valid: true,
      studentId: student.student_id,
      name: student.name || "",
      studentName: student.name || "",
      academicYear: student.academic_year,
      projectTopic: student.project_topic || "",
      isActive: true,
      usedToday,
      remaining,
      limit: DAILY_QUOTA_LIMIT,
    });
  } catch (error) {
    console.error("Error checking quota:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
