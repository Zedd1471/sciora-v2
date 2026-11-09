import { describe, it, expect, beforeEach } from "vitest";
import {
  saveOfflineSession,
  getOfflineSession,
  getOfflineSessions,
  saveOfflineRecord,
  getOfflineRecords,
  deleteOfflineRecord,
  deleteOfflineSession,
  type OfflineAttendanceSession,
} from "./attendance-offline-store";

describe("Offline Attendance Store", () => {
  const testSession: OfflineAttendanceSession = {
    id: "test_session_offline_1",
    courseId: "course_1",
    courseCode: "BTH 401",
    courseTitle: "Molecular Biology",
    title: "Lecture 1: DNA Cloning",
    createdAt: new Date().toISOString(),
    status: "active",
    secretSeed: "JBSWY3DPEHPK3PXP",
    stepSeconds: 20,
    attendeeCount: 0,
  };

  beforeEach(() => {
    deleteOfflineSession(testSession.id);
  });

  it("saves and retrieves offline sessions", () => {
    saveOfflineSession(testSession);
    const session = getOfflineSession(testSession.id);
    expect(session).toBeDefined();
    expect(session?.courseCode).toBe("BTH 401");
    expect(session?.title).toBe("Lecture 1: DNA Cloning");
  });

  it("records attendance and prevents duplicates for the same student", () => {
    saveOfflineSession(testSession);

    // First check-in
    const res1 = saveOfflineRecord({
      id: "rec_1",
      sessionId: testSession.id,
      courseId: testSession.courseId,
      courseCode: testSession.courseCode,
      studentId: "BTH/19/0421",
      studentName: "John Doe",
      timestamp: new Date().toISOString(),
      method: "qr_scan",
      deviceFingerprint: "device_fp_student_a",
    });

    expect(res1.success).toBe(true);
    expect(res1.alreadyCheckedIn).toBe(false);

    // Second check-in by the SAME student
    const res2 = saveOfflineRecord({
      id: "rec_1",
      sessionId: testSession.id,
      courseId: testSession.courseId,
      courseCode: testSession.courseCode,
      studentId: "BTH/19/0421",
      studentName: "John Doe",
      timestamp: new Date().toISOString(),
      method: "qr_scan",
      deviceFingerprint: "device_fp_student_a",
    });

    expect(res2.success).toBe(true);
    expect(res2.alreadyCheckedIn).toBe(true);
  });

  it("ENFORCES ANTI-PROXY: blocks the same device from checking in a second student", () => {
    saveOfflineSession(testSession);

    // Student A checks in on their phone (device_phone_1)
    const resStudentA = saveOfflineRecord({
      id: "rec_student_a",
      sessionId: testSession.id,
      courseId: testSession.courseId,
      courseCode: testSession.courseCode,
      studentId: "BTH/19/0421",
      studentName: "Student A",
      timestamp: new Date().toISOString(),
      method: "qr_scan",
      deviceFingerprint: "device_phone_1",
    });

    expect(resStudentA.success).toBe(true);

    // Student B attempts to check in using Student A's phone (device_phone_1)
    const resStudentB = saveOfflineRecord({
      id: "rec_student_b",
      sessionId: testSession.id,
      courseId: testSession.courseId,
      courseCode: testSession.courseCode,
      studentId: "BTH/19/0999",
      studentName: "Student B (Absent Friend)",
      timestamp: new Date().toISOString(),
      method: "qr_scan",
      deviceFingerprint: "device_phone_1",
    });

    expect(resStudentB.success).toBe(false);
    expect(resStudentB.deviceBlocked).toBe(true);
    expect(resStudentB.blockedForId).toBe("BTH/19/0421");
  });
});

