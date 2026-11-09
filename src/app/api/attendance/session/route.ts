import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateAttendanceSecret, type AttendanceSession } from "@/lib/attendance";
import {
  saveOfflineSession,
  getOfflineSession,
  getOfflineSessions,
  updateOfflineSessionStatus,
  deleteOfflineSession,
} from "@/lib/attendance-offline-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const courseId = searchParams.get("courseId");
    const isAdmin = searchParams.get("admin") === "true";

    if (sessionId) {
      // 1. FAST PATH: Check local offline classroom store first (0ms disk read)
      let data: AttendanceSession | null = getOfflineSession(sessionId) || null;
      let snapId = sessionId;

      // 2. If not found locally, try Firestore with a fast 1.5s timeout
      if (!data) {
        try {
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
          const firestorePromise = getDoc(doc(db, "attendance_sessions", sessionId)).then((snap) =>
            snap.exists() ? (snap.data() as AttendanceSession) : null
          );
          const cloudData = await Promise.race([firestorePromise, timeoutPromise]);
          if (cloudData) {
            data = cloudData;
          }
        } catch (err) {
          console.warn("Firestore unavailable, checked offline store:", err);
        }
      }

      if (!data) {
        return NextResponse.json({ error: "Attendance session not found." }, { status: 404 });
      }

      // Do NOT expose secretSeed to non-admins
      if (!isAdmin) {
        const { secretSeed: _, id: _id, ...publicData } = data;
        return NextResponse.json({ session: { id: snapId, ...publicData } });
      }

      const { id: _id, ...fullData } = data;
      return NextResponse.json({ session: { id: snapId, ...fullData } });
    }

    if (courseId) {
      const sessionsMap = new Map<string, AttendanceSession>();

      // 1. Fetch offline store sessions first (immediate)
      getOfflineSessions()
        .filter((s) => s.courseId === courseId)
        .forEach((s) => sessionsMap.set(s.id, s));

      // 2. Fetch cloud sessions with 1.5s timeout if online
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
        const q = query(
          collection(db, "attendance_sessions"),
          where("courseId", "==", courseId)
        );
        const fetchPromise = getDocs(q).then((snap) => {
          snap.docs.forEach((d) => {
            sessionsMap.set(d.id, { id: d.id, ...d.data() } as AttendanceSession);
          });
        });
        await Promise.race([fetchPromise, timeoutPromise]);
      } catch {
        // use offline sessions
      }

      const sessions = Array.from(sessionsMap.values());
      sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ sessions });
    }

    // Default: fetch all sessions
    const sessionsMap = new Map<string, AttendanceSession>();
    // Fast path: load offline sessions immediately
    const offlineSessions = getOfflineSessions();
    offlineSessions.forEach((s) => sessionsMap.set(s.id, s));

    // If we already have active sessions in the offline classroom store, return them immediately
    // without waiting 10 seconds for Google Cloud to time out!
    const hasActiveOffline = offlineSessions.some((s) => s.status === "active");
    if (!hasActiveOffline) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
        const fetchPromise = getDocs(collection(db, "attendance_sessions")).then((snap) => {
          snap.docs.forEach((d) => {
            sessionsMap.set(d.id, { id: d.id, ...d.data() } as AttendanceSession);
          });
        });
        await Promise.race([fetchPromise, timeoutPromise]);
      } catch {
        // use offline sessions
      }
    }

    const sessions = Array.from(sessionsMap.values());
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching attendance session(s):", error);
    const msg = error instanceof Error ? error.message : "Failed to load session.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { courseId, courseCode, courseTitle, title } = body;

    if (!courseId || !courseCode || !title?.trim()) {
      return NextResponse.json(
        { error: "Course ID, course code, and session title are required." },
        { status: 400 }
      );
    }

    let sessionId: string;
    try {
      sessionId = doc(collection(db, "attendance_sessions")).id;
    } catch {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const secretSeed = generateAttendanceSecret(20);

    const newSession: AttendanceSession = {
      id: sessionId,
      courseId,
      courseCode: courseCode.trim().toUpperCase(),
      courseTitle: courseTitle?.trim() || courseCode.trim().toUpperCase(),
      title: title.trim(),
      createdAt: new Date().toISOString(),
      status: "active",
      secretSeed,
      stepSeconds: 20,
      attendeeCount: 0,
    };

    // Always save to local offline store first (guarantees offline availability)
    saveOfflineSession(newSession);

    // Also attempt saving to Firestore if online
    try {
      await setDoc(doc(db, "attendance_sessions", sessionId), newSession);
    } catch (err) {
      console.warn("Could not save session to cloud (saved offline):", err);
    }

    return NextResponse.json({ success: true, session: newSession });
  } catch (error) {
    console.error("Error creating attendance session:", error);
    const msg = error instanceof Error ? error.message : "Failed to create session.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, status } = body;

    if (!sessionId || !status) {
      return NextResponse.json({ error: "Session ID and status are required." }, { status: 400 });
    }

    if (status !== "active" && status !== "ended") {
      return NextResponse.json({ error: "Invalid status. Must be 'active' or 'ended'." }, { status: 400 });
    }

    // Update offline store
    updateOfflineSessionStatus(sessionId, status);

    // Try updating cloud if online
    try {
      const updates: Record<string, any> = { status };
      if (status === "ended") {
        updates.endedAt = new Date().toISOString();
      }
      await updateDoc(doc(db, "attendance_sessions", sessionId), updates);
    } catch {
      // offline
    }

    return NextResponse.json({ success: true, message: `Session marked as ${status}.` });
  } catch (error) {
    console.error("Error updating session:", error);
    const msg = error instanceof Error ? error.message : "Failed to update session.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
    }

    // Delete from offline store
    deleteOfflineSession(sessionId);

    // Try deleting from cloud if online
    try {
      await deleteDoc(doc(db, "attendance_sessions", sessionId));
      const recordsQuery = query(
        collection(db, "attendance_records"),
        where("sessionId", "==", sessionId)
      );
      const recordsSnap = await getDocs(recordsQuery);
      const deletePromises = recordsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch {
      // offline
    }

    return NextResponse.json({ success: true, message: "Session and records deleted." });
  } catch (error) {
    console.error("Error deleting session:", error);
    const msg = error instanceof Error ? error.message : "Failed to delete session.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
