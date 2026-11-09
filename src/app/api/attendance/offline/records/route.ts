import { NextResponse } from "next/server";
import {
  getOfflineRecords,
  getOfflineRecordsByStudent,
  deleteOfflineRecord,
  getOfflineSession,
} from "@/lib/attendance-offline-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const studentId = searchParams.get("studentId");

    if (studentId) {
      const records = getOfflineRecordsByStudent(studentId);
      return NextResponse.json({
        success: true,
        records,
        count: records.length,
      });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID or Student ID is required." }, { status: 400 });
    }

    const records = getOfflineRecords(sessionId);
    const session = getOfflineSession(sessionId);

    return NextResponse.json({
      success: true,
      records,
      attendeeCount: records.length,
      sessionStatus: session?.status || "active",
    });
  } catch (error) {
    console.error("Error loading offline attendance records:", error);
    return NextResponse.json({ error: "Failed to load offline records." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const recordId = searchParams.get("recordId");
    const sessionId = searchParams.get("sessionId");

    if (!recordId || !sessionId) {
      return NextResponse.json(
        { error: "Record ID and Session ID are required." },
        { status: 400 }
      );
    }

    deleteOfflineRecord(recordId, sessionId);
    return NextResponse.json({ success: true, message: "Record removed." });
  } catch (error) {
    console.error("Error deleting offline record:", error);
    return NextResponse.json({ error: "Failed to delete record." }, { status: 500 });
  }
}

