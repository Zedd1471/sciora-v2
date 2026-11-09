import { NextResponse } from "next/server";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getOfflineSessions,
  getOfflineRecords,
  getPendingSyncStats,
  markAllAsSynced,
} from "@/lib/attendance-offline-store";

export async function GET() {
  try {
    const stats = getPendingSyncStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get sync stats." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const sessions = getOfflineSessions();
    const stats = getPendingSyncStats();

    if (stats.pendingSessions === 0 && stats.pendingRecords === 0) {
      return NextResponse.json({
        success: true,
        message: "Everything is already synced to the cloud.",
        sessionsSynced: 0,
        recordsSynced: 0,
      });
    }

    let sessionsSynced = 0;
    let recordsSynced = 0;

    // Sync sessions
    for (const s of sessions) {
      const { syncedToCloud: _, ...cleanSession } = s;
      try {
        await setDoc(doc(db, "attendance_sessions", s.id), cleanSession, { merge: true });
        sessionsSynced++;
      } catch (err) {
        console.warn(`Could not sync session ${s.id} to cloud:`, err);
      }

      // Sync corresponding records
      const records = getOfflineRecords(s.id);
      for (const r of records) {
        const { syncedToCloud: _rSync, ...cleanRecord } = r;
        try {
          await setDoc(doc(db, "attendance_records", r.id), cleanRecord, { merge: true });
          recordsSynced++;
        } catch (err) {
          console.warn(`Could not sync record ${r.id} to cloud:`, err);
        }
      }
    }

    markAllAsSynced();

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${sessionsSynced} session(s) and ${recordsSynced} attendance record(s) to the cloud!`,
      sessionsSynced,
      recordsSynced,
    });
  } catch (error) {
    console.error("Error syncing offline attendance data:", error);
    const msg = error instanceof Error ? error.message : "Cloud sync failed.";
    return NextResponse.json(
      {
        error: `${msg} Please ensure you are connected to the internet before syncing.`,
      },
      { status: 500 }
    );
  }
}

