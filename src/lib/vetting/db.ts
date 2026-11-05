import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  runTransaction,
  increment,
  Timestamp,
  enableNetwork,
} from "firebase/firestore";

export interface StudentRecord {
  student_id: string;
  academic_year: string;
  is_active: boolean;
  project_topic?: string;
  created_at?: Timestamp | string;
  name?: string;
}

export interface StudentImportItem {
  studentId: string;
  name?: string;
  topic?: string;
}

export interface UsageLogRecord {
  student_id: string;
  date: string;
  request_count: number;
  last_updated?: Timestamp;
}

export interface VettingReviewRecord {
  id?: string;
  student_id: string;
  project_title: string;
  file_name: string;
  document_mode?: string;
  verdict?: string;
  review_markdown: string;
  created_at: Timestamp | string;
}

export const DAILY_QUOTA_LIMIT = 3;

/**
 * Executes a Firestore operation with retry and automatic network re-enable
 * if the client enters an offline or unavailable state.
 */
export async function withFirestoreRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isOfflineOrUnavailable =
        errMsg.includes("client is offline") ||
        errMsg.includes("unavailable") ||
        errMsg.includes("DEADLINE_EXCEEDED") ||
        errMsg.includes("network");

      if (isOfflineOrUnavailable && attempt < maxRetries) {
        try {
          await enableNetwork(db);
        } catch (_) {}
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export function getTodayDateString(): string {
  // ISO Date YYYY-MM-DD
  return new Date().toISOString().split("T")[0];
}

export function normalizeStudentId(id: string): string {
  return id.trim().toUpperCase();
}

/**
 * Safely encode student IDs with slashes for Firestore document keys.
 * Firestore document IDs cannot contain forward slashes ('/').
 * e.g. "MCB/12A/3456" -> "MCB__12A__3456"
 */
export function studentIdToDocId(id: string): string {
  return normalizeStudentId(id).replace(/[\/\\]/g, "__");
}

export function docIdToStudentId(docId: string): string {
  return docId.replace(/__/g, "/");
}

/**
 * Fetch a student record by ID and check active status.
 */
export async function getStudent(studentIdRaw: string): Promise<StudentRecord | null> {
  return withFirestoreRetry(async () => {
    const studentId = normalizeStudentId(studentIdRaw);
    const studentRef = doc(db, "students", studentIdToDocId(studentId));
    const snap = await getDoc(studentRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    return {
      student_id: data.student_id || docIdToStudentId(snap.id),
      academic_year: data.academic_year || "Unknown",
      is_active: data.is_active !== false,
      project_topic: data.project_topic || data.topic || "",
      created_at: data.created_at,
      name: data.name,
    };
  });
}

/**
 * Get the current student usage count for today.
 */
export async function getStudentUsageToday(studentIdRaw: string): Promise<number> {
  return withFirestoreRetry(async () => {
    const studentId = normalizeStudentId(studentIdRaw);
    const dateStr = getTodayDateString();
    const logDocId = `${studentIdToDocId(studentId)}_${dateStr}`;
    const logRef = doc(db, "usage_logs", logDocId);
    const snap = await getDoc(logRef);

    if (!snap.exists()) {
      return 0;
    }
    return snap.data().request_count || 0;
  });
}

/**
 * Atomic quota verification & consumption.
 * Throws an error if quota is already reached.
 * Returns the new request_count.
 */
export async function consumeStudentQuota(studentIdRaw: string): Promise<{ newCount: number; remaining: number }> {
  const studentId = normalizeStudentId(studentIdRaw);
  const dateStr = getTodayDateString();
  const logDocId = `${studentIdToDocId(studentId)}_${dateStr}`;
  const logRef = doc(db, "usage_logs", logDocId);

  return await runTransaction(db, async (transaction) => {
    const logSnap = await transaction.get(logRef);
    const currentCount = logSnap.exists() ? (logSnap.data().request_count || 0) : 0;

    if (currentCount >= DAILY_QUOTA_LIMIT) {
      throw new Error(`Quota exceeded: You have already used all ${DAILY_QUOTA_LIMIT} submissions allowed for today.`);
    }

    const newCount = currentCount + 1;

    if (logSnap.exists()) {
      transaction.update(logRef, {
        request_count: increment(1),
        last_updated: serverTimestamp(),
      });
    } else {
      transaction.set(logRef, {
        student_id: studentId,
        date: dateStr,
        request_count: 1,
        last_updated: serverTimestamp(),
      });
    }

    return {
      newCount,
      remaining: Math.max(0, DAILY_QUOTA_LIMIT - newCount),
    };
  });
}

/**
 * Store a copy of the completed review in Firestore.
 */
export async function saveVettingReview(review: Omit<VettingReviewRecord, "id">): Promise<string | null> {
  try {
    return await withFirestoreRetry(async () => {
      const colRef = collection(db, "vetting_reviews");
      const docRef = doc(colRef);
      await setDoc(docRef, {
        ...review,
        created_at: serverTimestamp(),
      });
      return docRef.id;
    });
  } catch (err) {
    console.error("Failed to save review history:", err);
    return null;
  }
}

/**
 * Fetch all previous vetting review trials for a specific student, sorted newest first.
 */
export async function getStudentReviews(studentIdRaw: string): Promise<VettingReviewRecord[]> {
  return withFirestoreRetry(async () => {
    const studentId = normalizeStudentId(studentIdRaw);
    const colRef = collection(db, "vetting_reviews");
    const q = query(colRef, where("student_id", "==", studentId));
    const snap = await getDocs(q);

    const reviews: VettingReviewRecord[] = [];
    snap.forEach((d) => {
      const data = d.data();
      let isoDate = new Date().toISOString();
      if (data.created_at) {
        if (typeof data.created_at.toDate === "function") {
          isoDate = data.created_at.toDate().toISOString();
        } else if (typeof data.created_at === "string") {
          isoDate = data.created_at;
        }
      }

      reviews.push({
        id: d.id,
        student_id: data.student_id || studentId,
        project_title: data.project_title || "",
        file_name: data.file_name || "Document Draft",
        document_mode: data.document_mode || "auto",
        verdict: data.verdict || "Review Completed",
        review_markdown: data.review_markdown || "",
        created_at: isoDate,
      });
    });

    // Sort newest trial first
    reviews.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

    return reviews;
  });
}

/**
 * Admin: Bulk import student IDs with optional assigned project topics.
 */
export async function bulkImportStudents(
  items: (string | StudentImportItem)[],
  academicYear: string
): Promise<{ added: number; updated: number }> {
  const batch = writeBatch(db);
  let count = 0;

  for (const item of items) {
    let rawId = "";
    let name = "";
    let topic = "";

    if (typeof item === "string") {
      const line = item.trim();
      if (!line) continue;

      if (line.includes("\t")) {
        const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
        rawId = parts[0] || "";
        if (parts.length >= 3) {
          name = parts[1];
          topic = parts.slice(2).join(" - ");
        } else if (parts.length === 2) {
          if (parts[1].length > 25 || parts[1].split(/\s+/).length > 3) {
            topic = parts[1];
          } else {
            name = parts[1];
          }
        }
      } else if (line.includes(" - ")) {
        const parts = line.split(" - ").map((p) => p.trim()).filter(Boolean);
        rawId = parts[0] || "";
        if (parts.length >= 3) {
          name = parts[1];
          topic = parts.slice(2).join(" - ");
        } else if (parts.length === 2) {
          if (parts[1].length > 25 || parts[1].split(/\s+/).length > 3) {
            topic = parts[1];
          } else {
            name = parts[1];
          }
        }
      } else if (line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
        rawId = parts[0] || "";
        if (parts.length >= 3) {
          name = parts[1];
          topic = parts.slice(2).join(" | ");
        } else if (parts.length === 2) {
          if (parts[1].length > 25 || parts[1].split(/\s+/).length > 3) {
            topic = parts[1];
          } else {
            name = parts[1];
          }
        }
      } else if (line.includes(",")) {
        const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
        rawId = parts[0] || "";
        if (parts.length >= 3) {
          name = parts[1];
          topic = parts.slice(2).join(", ");
        } else if (parts.length === 2) {
          if (parts[1].length > 25 || parts[1].split(/\s+/).length > 3) {
            topic = parts[1];
          } else {
            name = parts[1];
          }
        }
      } else {
        rawId = line;
      }
    } else if (item && typeof item === "object") {
      rawId = item.studentId;
      name = item.name || "";
      topic = item.topic || "";
    }

    const studentId = normalizeStudentId(rawId);
    if (!studentId) continue;

    const studentRef = doc(db, "students", studentIdToDocId(studentId));
    const updatePayload: Record<string, any> = {
      student_id: studentId,
      academic_year: academicYear.trim(),
      is_active: true,
      created_at: serverTimestamp(),
    };
    if (name) {
      updatePayload.name = name;
    }
    if (topic) {
      updatePayload.project_topic = topic;
    }

    batch.set(studentRef, updatePayload, { merge: true });
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }
  return { added: count, updated: 0 };
}

/**
 * Admin: Update/assign student name and project topic.
 */
export async function updateStudentDetails(
  studentIdRaw: string,
  details: { name?: string; topic?: string }
): Promise<void> {
  const studentId = normalizeStudentId(studentIdRaw);
  const studentRef = doc(db, "students", studentIdToDocId(studentId));
  const payload: Record<string, any> = {};
  if (typeof details.name === "string") {
    payload.name = details.name.trim();
  }
  if (typeof details.topic === "string") {
    payload.project_topic = details.topic.trim();
  }
  if (Object.keys(payload).length > 0) {
    await updateDoc(studentRef, payload);
  }
}

/**
 * Admin: Update/assign a project topic to a specific student.
 */
export async function updateStudentTopic(studentIdRaw: string, topic: string): Promise<void> {
  await updateStudentDetails(studentIdRaw, { topic });
}

/**
 * Public/ThesisLab: Get active students and their registered project topics.
 */
export async function getActiveStudentsWithTopics(cohort?: string): Promise<{
  student_id: string;
  name?: string;
  academic_year: string;
  project_topic: string;
}[]> {
  const q = query(collection(db, "students"), where("is_active", "==", true));
  const snap = await getDocs(q);
  const list: { student_id: string; name?: string; academic_year: string; project_topic: string }[] = [];

  snap.forEach((d) => {
    const data = d.data();
    if (!cohort || cohort === "all" || data.academic_year === cohort) {
      list.push({
        student_id: data.student_id || docIdToStudentId(d.id),
        name: data.name || "",
        academic_year: data.academic_year || "",
        project_topic: data.project_topic || data.topic || "",
      });
    }
  });

  return list.sort((a, b) => a.student_id.localeCompare(b.student_id));
}

/**
 * Admin: Toggle active state for an entire academic year cohort.
 */
export async function toggleCohortStatus(academicYear: string, isActive: boolean): Promise<number> {
  const q = query(collection(db, "students"), where("academic_year", "==", academicYear.trim()));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  let updatedCount = 0;
  snap.forEach((d) => {
    batch.update(d.ref, { is_active: isActive });
    updatedCount++;
  });

  if (updatedCount > 0) {
    await batch.commit();
  }
  return updatedCount;
}

/**
 * Admin: Toggle single student status.
 */
export async function toggleStudentStatus(studentIdRaw: string, isActive: boolean): Promise<void> {
  const studentId = normalizeStudentId(studentIdRaw);
  const studentRef = doc(db, "students", studentIdToDocId(studentId));
  await updateDoc(studentRef, { is_active: isActive });
}

/**
 * Admin: Delete single student.
 */
export async function deleteStudent(studentIdRaw: string): Promise<void> {
  const studentId = normalizeStudentId(studentIdRaw);
  const studentRef = doc(db, "students", studentIdToDocId(studentId));
  await deleteDoc(studentRef);
}

/**
 * Admin: Get all students and summary audit metrics.
 */
export async function getAdminStudentsData(): Promise<{
  students: StudentRecord[];
  metrics: {
    totalStudents: number;
    activeStudents: number;
    cohorts: string[];
    todaySubmissions: number;
  };
}> {
  const studentsSnap = await getDocs(collection(db, "students"));
  const students: StudentRecord[] = [];
  const cohortSet = new Set<string>();
  let activeCount = 0;

  studentsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const st: StudentRecord = {
      student_id: data.student_id || docIdToStudentId(docSnap.id),
      academic_year: data.academic_year || "Unknown",
      is_active: data.is_active !== false,
      project_topic: data.project_topic || data.topic || "",
      created_at: data.created_at ? (typeof data.created_at.toDate === "function" ? data.created_at.toDate().toISOString() : String(data.created_at)) : undefined,
      name: data.name,
    };
    if (st.is_active) activeCount++;
    if (st.academic_year) cohortSet.add(st.academic_year);
    students.push(st);
  });

  // Calculate today's submissions count from usage_logs
  const todayStr = getTodayDateString();
  const qLogs = query(collection(db, "usage_logs"), where("date", "==", todayStr));
  const logsSnap = await getDocs(qLogs);
  let todayTotal = 0;
  logsSnap.forEach((d) => {
    todayTotal += d.data().request_count || 0;
  });

  return {
    students,
    metrics: {
      totalStudents: students.length,
      activeStudents: activeCount,
      cohorts: Array.from(cohortSet).sort().reverse(),
      todaySubmissions: todayTotal,
    },
  };
}
