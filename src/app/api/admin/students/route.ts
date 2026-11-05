import { NextResponse } from "next/server";
import {
  getAdminStudentsData,
  bulkImportStudents,
  toggleCohortStatus,
  toggleStudentStatus,
  updateStudentTopic,
  updateStudentDetails,
  deleteStudent,
  normalizeStudentId,
} from "@/lib/vetting/db";

export async function GET() {
  try {
    const data = await getAdminStudentsData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching students:", error);
    const msg = error instanceof Error ? error.message : "Failed to load students data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { studentIds, students, academicYear } = body;

    if (!academicYear || typeof academicYear !== "string") {
      return NextResponse.json({ error: "Academic year (e.g., '2026/2027') is required." }, { status: 400 });
    }

    let parsedItems: (string | { studentId: string; name?: string; topic?: string })[] = [];
    const candidateList = studentIds ?? students;
    if (Array.isArray(candidateList)) {
      parsedItems = candidateList;
    } else if (typeof candidateList === "string") {
      parsedItems = candidateList
        .split(/[\r\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: "No valid student entries provided." }, { status: 400 });
    }

    const result = await bulkImportStudents(parsedItems, academicYear);

    return NextResponse.json({
      success: true,
      message: `Successfully registered/updated ${result.added} student(s) under cohort ${academicYear}.`,
      count: result.added,
    });
  } catch (error) {
    console.error("Error bulk importing students:", error);
    const msg = error instanceof Error ? error.message : "Bulk import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    // Cohort active toggle
    if (body.academicYear && typeof body.isActive === "boolean") {
      const count = await toggleCohortStatus(body.academicYear, body.isActive);
      return NextResponse.json({
        success: true,
        message: `${count} student(s) in cohort ${body.academicYear} marked as ${body.isActive ? "Active" : "Inactive"}.`,
        updatedCount: count,
      });
    }

    // Individual active toggle
    if (body.studentId && typeof body.isActive === "boolean") {
      await toggleStudentStatus(body.studentId, body.isActive);
      return NextResponse.json({
        success: true,
        message: `Student ${normalizeStudentId(body.studentId)} status updated.`,
      });
    }

    // Individual topic and/or name update
    if (body.studentId && (typeof body.topic === "string" || typeof body.name === "string")) {
      await updateStudentDetails(body.studentId, {
        name: typeof body.name === "string" ? body.name : undefined,
        topic: typeof body.topic === "string" ? body.topic : undefined,
      });
      return NextResponse.json({
        success: true,
        message: `Details updated for student ${normalizeStudentId(body.studentId)}.`,
      });
    }

    return NextResponse.json({ error: "Invalid parameters for update." }, { status: 400 });
  } catch (error) {
    console.error("Error updating student:", error);
    const msg = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId query parameter is required." }, { status: 400 });
    }

    await deleteStudent(studentId);
    return NextResponse.json({
      success: true,
      message: `Student ${normalizeStudentId(studentId)} removed.`,
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    const msg = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
