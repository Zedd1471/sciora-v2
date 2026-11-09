import { NextResponse } from "next/server";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  verifyAttendanceCode,
  normalizeStudentId,
  validateStudentIdFormat,
  type AttendanceSession,
  type AttendanceRecord,
} from "@/lib/attendance";
import {
  getOfflineSession,
  saveOfflineRecord,
} from "@/lib/attendance-offline-store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, code, studentId, studentName, method, deviceFingerprint } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Attendance session ID is required." }, { status: 400 });
    }

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }

    const normalizedStudentId = normalizeStudentId(studentId);
    if (!validateStudentIdFormat(normalizedStudentId)) {
      return NextResponse.json(
        { error: "Invalid Student ID format. Expected format like ABC/12/3456 or BTH/19/0421." },
        { status: 400 }
      );
    }

    // 1. FAST PATH: Check local offline classroom store first (0ms disk read)
    let sessionData: AttendanceSession | null = getOfflineSession(sessionId) || null;
    let isCloudSession = false;

    // 2. Only if not found locally, try Firestore with a fast 1.5s timeout
    if (!sessionData) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
        const firestorePromise = getDoc(doc(db, "attendance_sessions", sessionId)).then((snap) => {
          if (snap.exists()) {
            isCloudSession = true;
            return snap.data() as AttendanceSession;
          }
          return null;
        });
        sessionData = await Promise.race([firestorePromise, timeoutPromise]);
      } catch (firestoreErr) {
        console.warn("Firestore unavailable during check-in, using offline store:", firestoreErr);
      }
    }

    if (!sessionData) {
      return NextResponse.json(
        { error: "This attendance session does not exist or has been removed." },
        { status: 404 }
      );
    }

    if (sessionData.status !== "active") {
      return NextResponse.json(
        { error: "This attendance session has ended. Check-ins are closed." },
        { status: 400 }
      );
    }

    // 2. Verify dynamic rolling code if provided (e.g. from QR scan)
    if (code && typeof code === "string" && code.trim().length === 6) {
      const isValidCode = await verifyAttendanceCode(
        code.trim(),
        sessionData.secretSeed,
        sessionData.stepSeconds || 20,
        3 // allow +/- 3 steps (70s) tolerance for scan & network latency
      );

      if (!isValidCode) {
        return NextResponse.json(
          {
            error:
              "This QR code has expired. Please look at the board and scan the current QR code.",
          },
          { status: 400 }
        );
      }
    }

    // 3. Name is optional: use studentName if provided
    const finalStudentName = (typeof studentName === "string" ? studentName.trim() : "") || undefined;

    const recordDocId = `${sessionId}_${normalizedStudentId.replace(/[\/\s]/g, "_")}`;

    const newRecord: AttendanceRecord = {
      id: recordDocId,
      sessionId,
      courseId: sessionData.courseId,
      courseCode: sessionData.courseCode,
      studentId: normalizedStudentId,
      studentName: finalStudentName || undefined,
      timestamp: new Date().toISOString(),
      method: method === "short_code" ? "short_code" : method === "manual" ? "manual" : "qr_scan",
    };

    // 4. Save to local offline store with single-device enforcement (ANTI-PROXY)
    const offlineResult = saveOfflineRecord({
      ...newRecord,
      deviceFingerprint: deviceFingerprint || undefined,
    });

    if (offlineResult.deviceBlocked) {
      return NextResponse.json(
        {
          error: `Anti-Proxy Protection: This phone has already been used to check in student [${offlineResult.blockedForId}]. Only 1 student check-in is permitted per device.`,
        },
        { status: 403 }
      );
    }

    if (offlineResult.alreadyCheckedIn) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        message: "You have already checked in for this session.",
        record: offlineResult.record,
      });
    }

    // 5. Non-blocking cloud sync if online (does not delay offline response)
    if (isCloudSession) {
      const recordDocRef = doc(db, "attendance_records", recordDocId);
      setDoc(recordDocRef, newRecord)
        .then(() => updateDoc(doc(db, "attendance_sessions", sessionId), { attendeeCount: increment(1) }))
        .catch((cloudErr) => console.warn("Could not write to cloud (saved offline):", cloudErr));
    }

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: false,
      message: `Attendance marked successfully for ${sessionData.courseCode}!`,
      record: newRecord,
    });
  } catch (error) {
    console.error("Error during attendance check-in:", error);
    const msg = error instanceof Error ? error.message : "Attendance check-in failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
