"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Download,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
  CalendarCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  X,
  GraduationCap,
  Percent,
} from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

type StudentGradebookRecord = {
  studentId: string;
  studentName?: string;
  testScores: Record<string, { score: number; max: number; title: string }>;
  grandTotalScore: number;
  grandTotalMax: number;
  grandTotalPct: number;
  attendanceCount: number;
  totalSessions: number;
  attendancePct: number;
};

type AiAnalysisResult = {
  correlationSummary: string;
  executiveInsight: string;
  recommendations: string[];
  attendanceStats: {
    totalStudents: number;
    eligibleCount: number;
    belowThresholdCount: number;
    zeroAttendanceCount: number;
    averageAttendancePct: number;
    averageScorePct: number;
    threshold: number;
  };
  flaggedStudents: Array<{
    studentId: string;
    studentName?: string;
    flagType: "ghost_tester" | "discrepancy" | "at_risk" | "high_performer";
    reason: string;
  }>;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  course: {
    id: string;
    code: string;
    title: string;
    materials?: any[];
  };
};

const PRESET_THRESHOLDS = [50, 60, 70, 75, 80, 85];

export function CourseGradebookModal({ isOpen, onClose, course }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentGradebookRecord[]>([]);
  const [courseTests, setCourseTests] = useState<Array<{ id: string; title: string }>>([]);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);

  // Filter & threshold state
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(75);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "eligible" | "below" | "zero" | "anomaly" | "flagged"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);

  // Load and compile all data when modal opens
  const loadGradebookData = async () => {
    if (!course?.id) return;
    setLoading(true);
    setAiResult(null);

    try {
      // 1. Fetch tests for this course
      const testsMap = new Map<string, string>();
      if (Array.isArray(course.materials)) {
        course.materials.forEach((m: any) => {
          if (m.type === "test" || m.testData) {
            testsMap.set(m.id, m.title || "Assessment");
          }
        });
      }
      const testsList = Array.from(testsMap.entries()).map(([id, title]) => ({ id, title }));
      setCourseTests(testsList);

      // 2. Fetch all grades for this course
      const gradesQuery = query(collection(db, "grades"), where("courseId", "==", course.id));
      const gradesSnap = await getDocs(gradesQuery);
      const gradesList = gradesSnap.docs.map((d) => d.data());

      // 3. Fetch all attendance sessions for this course
      const sessionsQuery = query(
        collection(db, "attendance_sessions"),
        where("courseId", "==", course.id)
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      const firestoreSessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Fetch offline sessions
      let offlineSessions: any[] = [];
      try {
        const offSessRes = await fetch("/api/attendance/offline/sessions");
        if (offSessRes.ok) {
          const offSessData = await offSessRes.json();
          offlineSessions = (offSessData.sessions || []).filter(
            (s: any) => s.courseId === course.id || s.courseCode === course.code
          );
        }
      } catch {
        // offline api non-blocking
      }

      // Merge unique sessions
      const sessionsMap = new Map<string, any>();
      firestoreSessions.forEach((s) => sessionsMap.set(s.id, s));
      offlineSessions.forEach((s) => sessionsMap.set(s.id, s));
      const allSessions = Array.from(sessionsMap.values());
      const totalSessions = allSessions.length;
      setTotalSessionsCount(totalSessions);

      // 4. Fetch attendance records
      const attendanceRecordsQuery = query(
        collection(db, "attendance_records"),
        where("courseId", "==", course.id)
      );
      const attRecordsSnap = await getDocs(attendanceRecordsQuery);
      const firestoreRecords = attRecordsSnap.docs.map((d) => d.data());

      let offlineRecords: any[] = [];
      try {
        const offRecRes = await fetch("/api/attendance/offline/records");
        if (offRecRes.ok) {
          const offRecData = await offRecRes.json();
          offlineRecords = (offRecData.records || []).filter(
            (r: any) =>
              r.courseId === course.id ||
              r.courseCode === course.code ||
              sessionsMap.has(r.sessionId)
          );
        }
      } catch {
        // non-blocking
      }

      // 5. Aggregate by student
      const studentMap = new Map<
        string,
        {
          studentId: string;
          studentName?: string;
          testScores: Record<string, { score: number; max: number; title: string }>;
          attendedSessions: Set<string>;
        }
      >();

      const getOrCreateStudent = (rawId: string, name?: string) => {
        const id = rawId.trim().toUpperCase();
        if (!studentMap.has(id)) {
          studentMap.set(id, {
            studentId: id,
            studentName: name || undefined,
            testScores: {},
            attendedSessions: new Set<string>(),
          });
        }
        const student = studentMap.get(id)!;
        if (!student.studentName && name) {
          student.studentName = name;
        }
        return student;
      };

      // Process grades
      gradesList.forEach((g: any) => {
        if (!g.studentId) return;
        const student = getOrCreateStudent(g.studentId, g.studentName);
        const testKey = g.testId || g.testTitle || "Test";
        student.testScores[testKey] = {
          score: Number(g.score) || 0,
          max: Number(g.totalQuestions) || 1,
          title: g.testTitle || testKey,
        };
      });

      // Process attendance records (merge firestore + offline)
      const allAttendanceRecords = [...firestoreRecords, ...offlineRecords];
      allAttendanceRecords.forEach((r: any) => {
        if (!r.studentId) return;
        const student = getOrCreateStudent(r.studentId, r.studentName);
        const sessId = r.sessionId || "default-session";
        student.attendedSessions.add(sessId);
      });

      // Format compile records
      const compiled: StudentGradebookRecord[] = Array.from(studentMap.values()).map(
        (st) => {
          let grandTotalScore = 0;
          let grandTotalMax = 0;

          Object.values(st.testScores).forEach((sc) => {
            grandTotalScore += sc.score;
            grandTotalMax += sc.max;
          });

          const grandTotalPct =
            grandTotalMax > 0 ? Math.round((grandTotalScore / grandTotalMax) * 100) : 0;
          const attendanceCount = st.attendedSessions.size;
          const attendancePct =
            totalSessions > 0
              ? Math.min(100, Math.round((attendanceCount / totalSessions) * 100))
              : 0;

          return {
            studentId: st.studentId,
            studentName: st.studentName,
            testScores: st.testScores,
            grandTotalScore,
            grandTotalMax,
            grandTotalPct,
            attendanceCount,
            totalSessions,
            attendancePct,
          };
        }
      );

      // Sort alphabetically by student ID
      compiled.sort((a, b) => a.studentId.localeCompare(b.studentId));
      setStudents(compiled);
    } catch (err) {
      console.error("Failed to load course gradebook:", err);
      toast({
        kind: "error",
        title: "Load Failed",
        description: "Could not compile course records. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGradebookData();
    }
  }, [isOpen, course?.id]);

  // Run AI Analysis
  const handleRunAiAnalysis = async () => {
    if (students.length === 0) {
      toast({ kind: "error", title: "No records to analyze" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const payload = {
        courseCode: course.code,
        courseTitle: course.title,
        totalSessions: totalSessionsCount,
        threshold: attendanceThreshold,
        students: students.map((s) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          attendanceCount: s.attendanceCount,
          totalSessions: s.totalSessions,
          attendancePct: s.attendancePct,
          testCount: Object.keys(s.testScores).length,
          grandTotalScore: s.grandTotalScore,
          grandTotalMax: s.grandTotalMax,
          grandTotalPct: s.grandTotalPct,
          testScoresSummary: Object.entries(s.testScores)
            .map(([_, v]) => `${v.title}: ${v.score}/${v.max}`)
            .join(", "),
        })),
      };

      const res = await fetch("/api/admin/course-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Analytics endpoint returned an error");
      }

      const data: AiAnalysisResult = await res.json();
      setAiResult(data);
      toast({
        kind: "success",
        title: "AI Analysis Complete",
        description: `Correlated ${students.length} students across ${totalSessionsCount} lectures.`,
      });
    } catch (err) {
      console.error("AI analysis error:", err);
      toast({
        kind: "error",
        title: "Analysis Failed",
        description: "Could not run AI synthesis. Falling back to rule-based metrics.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Flagged students Set for quick lookup
  const flaggedStudentIds = useMemo(() => {
    if (!aiResult) return new Set<string>();
    return new Set(aiResult.flaggedStudents.map((f) => f.studentId));
  }, [aiResult]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchId = s.studentId.toLowerCase().includes(q);
        const matchName = s.studentName?.toLowerCase().includes(q);
        if (!matchId && !matchName) return false;
      }

      // 2. Filter Tab
      if (activeFilter === "eligible") {
        return s.attendancePct >= attendanceThreshold;
      }
      if (activeFilter === "below") {
        return s.attendancePct < attendanceThreshold;
      }
      if (activeFilter === "zero") {
        return s.attendanceCount === 0;
      }
      if (activeFilter === "anomaly") {
        return s.attendanceCount === 0 && Object.keys(s.testScores).length > 0;
      }
      if (activeFilter === "flagged") {
        return flaggedStudentIds.has(s.studentId);
      }

      return true;
    });
  }, [students, searchQuery, activeFilter, attendanceThreshold, flaggedStudentIds]);

  // Counts for pills
  const counts = useMemo(() => {
    let eligible = 0;
    let below = 0;
    let zero = 0;
    let anomaly = 0;

    students.forEach((s) => {
      if (s.attendancePct >= attendanceThreshold) eligible++;
      else below++;

      if (s.attendanceCount === 0) {
        zero++;
        if (Object.keys(s.testScores).length > 0) {
          anomaly++;
        }
      }
    });

    return {
      all: students.length,
      eligible,
      below,
      zero,
      anomaly,
      flagged: aiResult?.flaggedStudents.length || 0,
    };
  }, [students, attendanceThreshold, aiResult]);

  // Export full master gradebook to CSV
  const handleExportCsv = () => {
    if (students.length === 0) return;

    const testHeaders = courseTests.map((t) => `"${t.title.replace(/"/g, '""')}"`);
    const headerRow = [
      '"Student ID"',
      '"Student Name"',
      ...testHeaders,
      '"Grand Total Score"',
      '"Grand Total Max"',
      '"Grand Total %"',
      '"Lectures Attended"',
      '"Total Lectures"',
      '"Attendance %"',
      '"Exam Status"',
    ].join(",");

    const dataRows = students.map((s) => {
      const isEligible = s.attendancePct >= attendanceThreshold;
      const testScoreCols = courseTests.map((t) => {
        const sc = s.testScores[t.id];
        return sc ? `"${sc.score}/${sc.max}"` : '"-"';
      });

      return [
        `"${s.studentId}"`,
        `"${(s.studentName || "").replace(/"/g, '""')}"`,
        ...testScoreCols,
        `"${s.grandTotalScore}"`,
        `"${s.grandTotalMax}"`,
        `"${s.grandTotalPct}%"`,
        `"${s.attendanceCount}"`,
        `"${totalSessionsCount}"`,
        `"${s.attendancePct}%"`,
        `"${isEligible ? "CLEARED" : "BARRED"}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${course.code}_Master_Gradebook_and_Attendance.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      kind: "success",
      title: "Master Gradebook Exported",
      description: `Downloaded comprehensive records for ${students.length} students.`,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="3xl"
    >
      <div className="space-y-7 -mt-2">
        {/* HEADER */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-edge/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-card">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent bg-accent-soft px-2.5 py-0.5 rounded-lg border border-accent/20">
                  {course.code}
                </span>
                <span className="text-xs text-muted font-medium">Master Ledger</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Course Gradebook &amp; Attendance
              </h2>
            </div>
          </div>
          <p className="text-xs text-muted max-w-sm sm:text-right font-medium">
            Unified test scores, classroom attendance, eligibility filtering, and AI synthesis for{" "}
            <span className="text-foreground font-semibold">{course.title}</span>.
          </p>
        </div>

        {/* TOP SUMMARY STATS — APPLE BENTO GRID */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Total Students */}
          <div className="glass group relative overflow-hidden rounded-3xl p-5 border border-edge transition-all hover:border-accent/40 hover:shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Assessed Students
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {loading ? "—" : students.length}
            </p>
            <p className="mt-1 text-[11px] text-muted">Total enrolled in cohort</p>
          </div>

          {/* Lectures Conducted */}
          <div className="glass group relative overflow-hidden rounded-3xl p-5 border border-edge transition-all hover:border-indigo-500/40 hover:shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Class Lectures
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <CalendarCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {loading ? "—" : totalSessionsCount}
            </p>
            <p className="mt-1 text-[11px] text-muted">Physical sessions conducted</p>
          </div>

          {/* Exam Qualified */}
          <div className="glass group relative overflow-hidden rounded-3xl p-5 border border-edge transition-all hover:border-emerald-500/40 hover:shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Cleared for Exam
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-mono text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                {loading ? "—" : counts.eligible}
              </p>
              {!loading && students.length > 0 && (
                <span className="text-xs font-mono font-semibold text-emerald-600/80 dark:text-emerald-400/80">
                  ({Math.round((counts.eligible / students.length) * 100)}%)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted">Met &ge; {attendanceThreshold}% requirement</p>
          </div>

          {/* Below Threshold */}
          <div className="glass group relative overflow-hidden rounded-3xl p-5 border border-edge transition-all hover:border-rose-500/40 hover:shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">
                Barred / Deficient
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-mono text-3xl font-bold tracking-tight text-rose-500 tabular-nums">
                {loading ? "—" : counts.below}
              </p>
              {!loading && students.length > 0 && (
                <span className="text-xs font-mono font-semibold text-rose-500/80">
                  ({Math.round((counts.below / students.length) * 100)}%)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted">&lt; {attendanceThreshold}% attendance</p>
          </div>
        </div>

        {/* AI SYNTHESIS CARD (APPLE INTELLIGENCE STYLE) */}
        {aiResult ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 via-background to-accent/5 p-6 backdrop-blur-xl shadow-card space-y-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5 text-accent font-bold">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white shadow-soft">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="text-sm tracking-tight text-foreground font-bold">
                  AI Cohort Performance &amp; Attendance Synthesis
                </h4>
              </div>
              <span className="font-mono text-xs font-semibold text-muted bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full border border-edge">
                Audited against {attendanceThreshold}% threshold
              </span>
            </div>

            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans font-medium">
              {aiResult.correlationSummary}
            </p>

            {aiResult.recommendations && aiResult.recommendations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-accent/20">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Actionable Recommendations:
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {aiResult.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-edge bg-background/60 p-3 text-xs text-muted-strong shadow-2xs"
                    >
                      <span className="font-bold text-accent mr-1.5 font-mono">0{i + 1}.</span>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiResult.flaggedStudents && aiResult.flaggedStudents.length > 0 && (
              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-accent/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-500">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    {aiResult.flaggedStudents.length} student{aiResult.flaggedStudents.length === 1 ? "" : "s"} flagged for attendance or proxy anomalies
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFilter("flagged")}
                  className="rounded-full bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-1 text-xs font-bold text-rose-500 transition-colors border border-rose-500/25"
                >
                  Filter AI-Flagged Students &rarr;
                </button>
              </div>
            )}
          </motion.div>
        ) : null}

        {/* APPLE-STYLE CONTROL STRIP: SLIDER, PRESETS & ACTIONS */}
        <div className="glass rounded-3xl border border-edge p-6 space-y-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* THRESHOLD SLIDER & PRESETS */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Exam Attendance Requirement:
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-accent bg-accent-soft px-3 py-1 rounded-xl border border-accent/25">
                  {attendanceThreshold}%
                </span>
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={attendanceThreshold}
                onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-2 bg-black/10 dark:bg-white/10 rounded-lg appearance-none"
              />

              {/* Preset Snapping Buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] font-medium text-muted">Quick Presets:</span>
                {PRESET_THRESHOLDS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAttendanceThreshold(pct)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-mono font-semibold transition-all ${
                      attendanceThreshold === pct
                        ? "bg-accent text-white shadow-soft"
                        : "bg-black/5 dark:bg-white/5 text-muted hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 border border-edge"
                    }`}
                  >
                    {pct}% {pct === 75 ? "(Standard)" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-3 flex-wrap lg:self-center">
              <Button
                variant="primary"
                icon={Sparkles}
                loading={isAnalyzing}
                onClick={handleRunAiAnalysis}
                className="shadow-card hover:shadow-float font-semibold px-5"
              >
                {aiResult ? "Re-Run AI Synthesis" : "Run AI Gradebook Synthesis"}
              </Button>
              <Button
                variant="glass"
                icon={Download}
                onClick={handleExportCsv}
                disabled={students.length === 0}
                className="font-semibold"
              >
                Export CSV
              </Button>
              <IconButton
                icon={RefreshCw}
                label="Refresh Data"
                onClick={loadGradebookData}
                disabled={loading}
              />
            </div>
          </div>

          {/* FILTER SEGMENTED CONTROLS & SEARCH */}
          <div className="flex flex-col gap-3 pt-3 border-t border-edge/60 md:flex-row md:items-center md:justify-between">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === "all"
                    ? "bg-accent text-white shadow-soft"
                    : "bg-black/5 dark:bg-white/5 text-muted hover:text-foreground border border-edge"
                }`}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("eligible")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === "eligible"
                    ? "bg-emerald-600 text-white shadow-soft"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                }`}
              >
                Eligible &ge;{attendanceThreshold}% ({counts.eligible})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("below")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === "below"
                    ? "bg-rose-600 text-white shadow-soft"
                    : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20"
                }`}
              >
                Below Threshold ({counts.below})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("zero")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === "zero"
                    ? "bg-amber-600 text-white shadow-soft"
                    : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20"
                }`}
              >
                Zero Attendance ({counts.zero})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("anomaly")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === "anomaly"
                    ? "bg-purple-600 text-white shadow-soft"
                    : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                }`}
              >
                Score with 0% Attendance ({counts.anomaly})
              </button>
              {aiResult && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("flagged")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeFilter === "flagged"
                      ? "bg-rose-600 text-white shadow-soft"
                      : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                  }`}
                >
                  AI Flagged ({counts.flagged})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by Student ID or Name..."
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-edge bg-background/50 text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* GRADEBOOK TABLE CONTAINER */}
        <div className="overflow-hidden rounded-3xl border border-edge glass shadow-card">
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-edge z-10 text-muted uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-4 px-5">Student</th>
                  <th className="py-4 px-5">Grand Total Score</th>
                  <th className="py-4 px-5 min-w-[170px]">Attendance Record</th>
                  <th className="py-4 px-5">Exam Status</th>
                  {courseTests.map((t) => (
                    <th key={t.id} className="py-4 px-5 truncate max-w-[140px]">
                      {t.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {loading ? (
                  <tr>
                    <td colSpan={4 + courseTests.length} className="py-16 text-center text-muted">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" />
                        <span className="text-sm font-medium">
                          Compiling all course scores and physical attendance records...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4 + courseTests.length} className="py-16 text-center text-muted">
                      <p className="text-base font-semibold text-foreground">No students found</p>
                      <p className="text-xs text-muted mt-1">
                        Try adjusting your search query or attendance filter criteria above.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const isEligible = st.attendancePct >= attendanceThreshold;
                    const isFlagged = flaggedStudentIds.has(st.studentId);
                    const isGhost = st.attendanceCount === 0 && Object.keys(st.testScores).length > 0;

                    return (
                      <tr
                        key={st.studentId}
                        className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                          isFlagged ? "bg-rose-500/5" : ""
                        }`}
                      >
                        {/* Student ID & Name */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <p className="font-mono font-bold text-foreground text-sm tracking-wide">
                                {st.studentId}
                              </p>
                              {st.studentName && (
                                <p className="text-xs text-muted font-medium mt-0.5">
                                  {st.studentName}
                                </p>
                              )}
                            </div>
                            {isGhost && (
                              <span
                                title="Warning: Completed tests but 0 physical lecture attendances recorded"
                                className="inline-flex rounded-full bg-amber-500/15 p-1 text-amber-500 border border-amber-500/30"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Grand Total */}
                        <td className="py-4 px-5">
                          {st.grandTotalMax > 0 ? (
                            <div>
                              <div className="flex items-baseline gap-1.5 font-bold text-foreground font-mono">
                                <span className="text-base">{st.grandTotalScore}</span>
                                <span className="text-xs text-muted font-normal">/ {st.grandTotalMax}</span>
                                <span className="ml-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                                  {st.grandTotalPct}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Attendance Meter */}
                        <td className="py-4 px-5 min-w-[170px]">
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1.5 font-mono">
                              <span className="font-semibold text-foreground">
                                {st.attendanceCount} of {totalSessionsCount} lectures
                              </span>
                              <span
                                className={`font-bold ${
                                  isEligible
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-500"
                                }`}
                              >
                                {st.attendancePct}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isEligible
                                    ? "bg-emerald-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, st.attendancePct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Eligibility Badge */}
                        <td className="py-4 px-5">
                          {isEligible ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Cleared
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-500">
                              <XCircle className="h-3.5 w-3.5" />
                              Barred (&lt;{attendanceThreshold}%)
                            </span>
                          )}
                        </td>

                        {/* Individual Test Scores */}
                        {courseTests.map((t) => {
                          const sc = st.testScores[t.id];
                          return (
                            <td key={t.id} className="py-4 px-5 font-mono">
                              {sc ? (
                                <span className="inline-block rounded-lg bg-black/5 dark:bg-white/5 border border-edge px-2.5 py-1 text-xs font-semibold text-foreground">
                                  {sc.score} / {sc.max}
                                </span>
                              ) : (
                                <span className="text-muted text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-edge bg-black/5 dark:bg-white/5 text-muted hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-40 shadow-2xs"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
