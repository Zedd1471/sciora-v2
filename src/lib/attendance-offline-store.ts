import fs from "fs";
import path from "path";
import { type AttendanceSession, type AttendanceRecord } from "./attendance";

export interface OfflineAttendanceRecord extends AttendanceRecord {
  deviceFingerprint?: string;
  syncedToCloud?: boolean;
}

export interface OfflineAttendanceSession extends AttendanceSession {
  syncedToCloud?: boolean;
}

interface OfflineStoreData {
  sessions: OfflineAttendanceSession[];
  records: OfflineAttendanceRecord[];
  lastSyncedAt?: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "attendance-offline.json");

function ensureStoreFile(): OfflineStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }

  if (!fs.existsSync(STORE_FILE)) {
    const initial: OfflineStoreData = { sessions: [], records: [] };
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), "utf8");
    } catch {
      // ignore
    }
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading offline attendance store:", err);
    return { sessions: [], records: [] };
  }
}

function writeStoreFile(data: OfflineStoreData): void {
  ensureStoreFile();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing offline attendance store:", err);
  }
}

export function getOfflineSessions(): OfflineAttendanceSession[] {
  const data = ensureStoreFile();
  return [...data.sessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOfflineSession(sessionId: string): OfflineAttendanceSession | undefined {
  const data = ensureStoreFile();
  return data.sessions.find((s) => s.id === sessionId);
}

export function saveOfflineSession(session: AttendanceSession): void {
  const data = ensureStoreFile();
  const index = data.sessions.findIndex((s) => s.id === session.id);
  const enriched: OfflineAttendanceSession = { ...session, syncedToCloud: false };

  if (index >= 0) {
    data.sessions[index] = enriched;
  } else {
    data.sessions.unshift(enriched);
  }
  writeStoreFile(data);
}

export function updateOfflineSessionStatus(sessionId: string, status: "active" | "ended"): void {
  const data = ensureStoreFile();
  const sess = data.sessions.find((s) => s.id === sessionId);
  if (sess) {
    sess.status = status;
    if (status === "ended") {
      sess.endedAt = new Date().toISOString();
    }
    sess.syncedToCloud = false;
    writeStoreFile(data);
  }
}

export function deleteOfflineSession(sessionId: string): void {
  const data = ensureStoreFile();
  data.sessions = data.sessions.filter((s) => s.id !== sessionId);
  data.records = data.records.filter((r) => r.sessionId !== sessionId);
  writeStoreFile(data);
}

export function getOfflineRecords(sessionId: string): OfflineAttendanceRecord[] {
  const data = ensureStoreFile();
  return data.records
    .filter((r) => r.sessionId === sessionId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Saves an attendance record with single-device enforcement (anti-proxy).
 */
export function saveOfflineRecord(
  record: AttendanceRecord & { deviceFingerprint?: string }
): {
  success: boolean;
  alreadyCheckedIn?: boolean;
  deviceBlocked?: boolean;
  blockedForId?: string;
  record?: OfflineAttendanceRecord;
} {
  const data = ensureStoreFile();

  // 1. Check if this student already checked in for this session
  const existingStudentRecord = data.records.find(
    (r) => r.sessionId === record.sessionId && r.studentId === record.studentId
  );
  if (existingStudentRecord) {
    return { success: true, alreadyCheckedIn: true, record: existingStudentRecord };
  }

  // 2. ANTI-PROXY: Check if this phone/device already checked in for ANOTHER student
  if (record.deviceFingerprint) {
    const existingDeviceRecord = data.records.find(
      (r) =>
        r.sessionId === record.sessionId &&
        r.deviceFingerprint === record.deviceFingerprint &&
        r.studentId !== record.studentId
    );
    if (existingDeviceRecord) {
      return {
        success: false,
        deviceBlocked: true,
        blockedForId: existingDeviceRecord.studentId,
      };
    }
  }

  // 3. Add record
  const newRecord: OfflineAttendanceRecord = {
    ...record,
    syncedToCloud: false,
  };
  data.records.unshift(newRecord);

  // Increment session attendee count
  const sess = data.sessions.find((s) => s.id === record.sessionId);
  if (sess) {
    sess.attendeeCount = (sess.attendeeCount || 0) + 1;
    sess.syncedToCloud = false;
  }

  writeStoreFile(data);
  return { success: true, alreadyCheckedIn: false, record: newRecord };
}

export function deleteOfflineRecord(recordId: string, sessionId: string): void {
  const data = ensureStoreFile();
  data.records = data.records.filter((r) => r.id !== recordId);
  const sess = data.sessions.find((s) => s.id === sessionId);
  if (sess && (sess.attendeeCount || 0) > 0) {
    sess.attendeeCount = (sess.attendeeCount || 1) - 1;
    sess.syncedToCloud = false;
  }
  writeStoreFile(data);
}

export function getPendingSyncStats(): { pendingSessions: number; pendingRecords: number } {
  const data = ensureStoreFile();
  const pendingSessions = data.sessions.filter((s) => !s.syncedToCloud).length;
  const pendingRecords = data.records.filter((r) => !r.syncedToCloud).length;
  return { pendingSessions, pendingRecords };
}

export function markAllAsSynced(): void {
  const data = ensureStoreFile();
  data.sessions.forEach((s) => (s.syncedToCloud = true));
  data.records.forEach((r) => (r.syncedToCloud = true));
  data.lastSyncedAt = new Date().toISOString();
  writeStoreFile(data);
}

