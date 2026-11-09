"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  CalendarCheck,
  ShieldAlert,
  Loader2,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import {
  normalizeStudentId,
  validateStudentIdFormat,
  type AttendanceSession,
} from "@/lib/attendance";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

function AttendanceCheckInContent() {
  const searchParams = useSearchParams();

  const urlSessionId = searchParams.get("session") || "";

  // Hydration safety flag
  const [isClient, setIsClient] = useState(false);

  // Core Form State
  const [sessionId, setSessionId] = useState(urlSessionId);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");

  // Session State
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success Result State
  const [result, setResult] = useState<{
    alreadyCheckedIn?: boolean;
    timestamp?: string;
    courseCode?: string;
    sessionTitle?: string;
    studentId?: string;
  } | null>(null);

  // 1. Mount effect: Mark client active and load saved student ID
  useEffect(() => {
    setIsClient(true);
    try {
      const savedId = localStorage.getItem("sciora_student_id");
      if (savedId) setStudentId(savedId);
      const savedName = localStorage.getItem("sciora_student_name");
      if (savedName) setStudentName(savedName);
    } catch {
      // ignore
    }
  }, []);

  // 2. Keep sessionId in sync if searchParams change
  useEffect(() => {
    if (urlSessionId) {
      setSessionId(urlSessionId);
    }
  }, [urlSessionId]);

  // 3. Resolve session fast (local offline store first)
  const resolveSession = useCallback(async () => {
    try {
      // If we have a sessionId, try to load that specific session
      if (sessionId) {
        try {
          const res = await fetch(`/api/attendance/session?sessionId=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session && data.session.status === "active") {
              setSession(data.session);
              setIsLoadingSession(false);
              return;
            }
          }
        } catch {
          // fallback to active session scan
        }
      }

      // If no session or requested session ended, discover live active lecture
      const listRes = await fetch("/api/attendance/session");
      if (listRes.ok) {
        const listData = await listRes.json();
        const active = (listData.sessions || []).filter(
          (s: AttendanceSession) => s.status === "active"
        );
        setActiveSessions(active);

        if (active.length > 0) {
          setSessionId(active[0].id);
          setSession(active[0]);
          setError(null);
        } else {
          setSession(null);
        }
      }
    } catch (err) {
      console.warn("Failed resolving session:", err);
    } finally {
      setIsLoadingSession(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!isClient) return;
    resolveSession();

    // Auto-poll every 3s only if waiting for lecturer to start
    const interval = setInterval(() => {
      if (!session || session.status !== "active") {
        resolveSession();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isClient, resolveSession, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedId = normalizeStudentId(studentId);
    if (!validateStudentIdFormat(normalizedId)) {
      setError("Please enter a valid Student ID format (e.g. BTH/19/0421 or MCB/12A/3456).");
      return;
    }

    const targetSessionId = session?.id || sessionId;
    if (!targetSessionId) {
      setError("No active lecture session detected. Please wait for the lecturer to present the QR code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();

      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: targetSessionId,
          studentId: normalizedId,
          studentName: studentName.trim() || undefined,
          method: "qr_scan",
          deviceFingerprint,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit attendance.");
      }

      // Persist student ID on device
      try {
        localStorage.setItem("sciora_student_id", normalizedId);
        if (studentName.trim()) {
          localStorage.setItem("sciora_student_name", studentName.trim());
        }
      } catch {
        // ignore
      }

      setResult({
        alreadyCheckedIn: data.alreadyCheckedIn,
        timestamp: data.record?.timestamp || new Date().toISOString(),
        courseCode: session?.courseCode || data.record?.courseCode,
        sessionTitle: session?.title,
        studentId: normalizedId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    session &&
    session.status === "active" &&
    studentId.trim().length >= 4 &&
    !isSubmitting;

  // Hydration guard: render an identical shell on SSR to guarantee 0 hydration mismatch
  if (!isClient) {
    return (
      <div className="min-h-[100dvh] w-full bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-3 sm:p-6 font-sans antialiased">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                Class Attendance
              </h1>
              <p className="text-xs text-zinc-400">Sciora Classroom Attendance</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center text-xs text-zinc-400">
            Connecting to classroom system...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-3 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5">
        {/* HEADER */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
              Class Attendance
            </h1>
            <p className="text-xs text-zinc-400 truncate">Sciora Classroom Attendance</p>
          </div>
        </div>

        {/* SUCCESS VIEW */}
        {result ? (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">
                {result.alreadyCheckedIn ? "Already Checked In" : "Attendance Recorded!"}
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                {result.alreadyCheckedIn
                  ? "Your presence was already confirmed for this lecture."
                  : "You are marked present in the lecturer's offline gradebook."}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-left space-y-2.5 text-xs sm:text-sm font-mono">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-sans">Student ID:</span>
                <span className="font-bold text-white tracking-wider">{result.studentId}</span>
              </div>
              {result.courseCode && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-sans">Course:</span>
                  <span className="font-semibold text-indigo-400">{result.courseCode}</span>
                </div>
              )}
              {result.sessionTitle && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-sans">Session:</span>
                  <span className="text-zinc-200 truncate max-w-[180px] font-sans">
                    {result.sessionTitle}
                  </span>
                </div>
              )}
              {result.timestamp && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-sans">Time:</span>
                  <span className="text-zinc-400 text-xs">
                    {new Date(result.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                href="/notes"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 text-sm transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                View Course Notes
              </Link>

              <button
                type="button"
                onClick={() => {
                  setResult(null);
                }}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 font-medium py-2.5 px-4 text-xs transition-colors"
              >
                Check In Another Student
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* LECTURE SESSION BANNER */}
            {isLoadingSession ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                Connecting to lecture session...
              </div>
            ) : session && session.status === "active" ? (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wide text-indigo-400">
                      {session.courseCode}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      Active Lecture
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-white mt-0.5">{session.title}</p>
                </div>
                {activeSessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSession(null);
                      setSessionId("");
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white underline shrink-0 ml-2"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : activeSessions.length > 0 ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Select Active Class:
                </label>
                <div className="space-y-1.5">
                  {activeSessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSessionId(s.id);
                        setSession(s);
                      }}
                      className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 hover:border-indigo-500 hover:bg-indigo-950/20 transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-400">
                          {s.courseCode}
                        </span>
                        <p className="font-semibold text-xs text-white mt-0.5">{s.title}</p>
                      </div>
                      <span className="text-[11px] text-zinc-500">Select →</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center text-xs text-amber-200">
                <Clock className="h-5 w-5 mx-auto mb-1 text-amber-400" />
                <p className="font-semibold">Waiting for Lecturer to Start</p>
                <p className="text-[11px] text-amber-300/80 mt-1">
                  Once the lecturer starts the session on their computer, this form will connect automatically.
                </p>
              </div>
            )}

            {/* PERMANENT STUDENT ID INPUT (NEVER UNMOUNTS WHILE TYPING) */}
            <div className="space-y-1.5">
              <label
                htmlFor="student-id-field"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                Student ID Number <span className="text-red-400">*</span>
              </label>
              <input
                id="student-id-field"
                type="text"
                required
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                placeholder="e.g. BTH/19/0421"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 font-mono text-base font-bold uppercase tracking-wider text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-zinc-500">
                Format: Faculty/Year/Number (e.g. BTH/19/0421)
              </p>
            </div>

            {/* OPTIONAL NAME */}
            <div className="space-y-1.5">
              <label
                htmlFor="student-name-field"
                className="block text-xs font-medium text-zinc-400"
              >
                Full Name (Optional)
              </label>
              <input
                id="student-name-field"
                type="text"
                placeholder="e.g. Samuel Ade"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* ERROR BANNER */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2.5">
                {error.includes("device") || error.includes("another student") ? (
                  <ShieldAlert className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{error}</p>
                  {(error.includes("device") || error.includes("another student")) && (
                    <p className="mt-1 text-[11px] text-red-400/90 font-sans">
                      Anti-proxy lock: Only 1 student check-in is permitted per device.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={!isFormValid}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed font-semibold text-white py-3.5 px-4 text-base transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording Attendance...
                </>
              ) : !session || session.status !== "active" ? (
                "Waiting for Active Session..."
              ) : (
                "Confirm Attendance"
              )}
            </button>

            {/* ANTI-PROXY FOOTER */}
            <p className="text-center text-[10px] text-zinc-500 pt-1">
              Protected by Anti-Proxy Device Lock • Local Classroom Hotspot
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] w-full bg-zinc-950 text-zinc-400 flex items-center justify-center p-6 text-sm">
          Loading attendance form...
        </div>
      }
    >
      <AttendanceCheckInContent />
    </Suspense>
  );
}
