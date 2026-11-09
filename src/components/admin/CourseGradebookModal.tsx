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
  Award,
  CalendarCheck,
  TrendingUp,
  ShieldAlert,
  Loader2,
  RefreshCw,
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
        // High score or test completed but zero attendance
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
      title={`Master Gradebook: ${course.code}`}
      className="max-w-5xl"
    >
      <div className="space-y-6">
        <p className="-mt-3 text-xs sm:text-sm text-muted">
          Unified test scores, lecture attendance, eligibility filtering, and AI performance synthesis for {course.title}.
        </p>
        {/* TOP SUMMARY STATS */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass rounded-2xl border border-edge p-4">
            <span className="text-xs font-medium text-muted">Total Students</span>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">
              {loading ? "—" : students.length}
            </p>
          </div>
          <div className="glass rounded-2xl border border-edge p-4">
            <span className="text-xs font-medium text-muted">Lectures Conducted</span>
            <p className="mt-1 font-mono text-2xl font-bold text-foreground">
              {loading ? "—" : totalSessionsCount}
            </p>
          </div>
          <div className="glass rounded-2xl border border-edge p-4">
            <span className="text-xs font-medium text-emerald-500">Eligible for Exam</span>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-500">
              {loading ? "—" : counts.eligible}
            </p>
          </div>
          <div className="glass rounded-2xl border border-edge p-4">
            <span className="text-xs font-medium text-rose-500">Below Threshold</span>
            <p className="mt-1 font-mono text-2xl font-bold text-rose-500">
              {loading ? "—" : counts.below}
            </p>
          </div>
        </div>

        {/* AI INSIGHTS CARD */}
        {aiResult ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-5 space-y-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-accent">
                <Sparkles className="h-5 w-5" />
                <h4 className="font-bold text-sm">AI Cohort Evaluation & Synthesis</h4>
              </div>
              <span className="text-[11px] font-mono text-muted">
                Exam Threshold: {attendanceThreshold}%
              </span>
            </div>

            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans">
              {aiResult.correlationSummary}
            </p>

            {aiResult.recommendations && aiResult.recommendations.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Actionable Recommendations:
                </span>
                <ul className="space-y-1 text-xs text-muted-strong">
                  {aiResult.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-accent">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiResult.flaggedStudents && aiResult.flaggedStudents.length > 0 && (
              <div className="pt-2 flex items-center justify-between border-t border-accent/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                  <span>{aiResult.flaggedStudents.length} students flagged for review</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFilter("flagged")}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  View Flagged Students →
                </button>
              </div>
            )}
          </motion.div>
        ) : null}

        {/* CONTROLS: SLIDER, FILTER BUTTONS, SEARCH, AND ACTIONS */}
        <div className="glass rounded-2xl border border-edge p-4 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* THRESHOLD SLIDER */}
            <div className="flex-1 max-w-sm space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-accent" />
                  Attendance Exam Threshold:
                </span>
                <span className="font-mono font-bold text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                  {attendanceThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={attendanceThreshold}
                onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-muted font-mono">
                <span>0% (All Pass)</span>
                <span>50%</span>
                <span>75% (Standard)</span>
                <span>100%</span>
              </div>
            </div>

            {/* ACTION BUTTONS: RUN AI & EXPORT CSV */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                icon={Sparkles}
                loading={isAnalyzing}
                onClick={handleRunAiAnalysis}
                className="shadow-soft"
              >
                {aiResult ? "Re-Run AI Analysis" : "Run AI Correlation"}
              </Button>
              <Button
                variant="glass"
                icon={Download}
                onClick={handleExportCsv}
                disabled={students.length === 0}
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

          {/* FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === "all"
                  ? "bg-accent text-white shadow-soft"
                  : "bg-black/5 dark:bg-white/5 text-muted hover:text-foreground"
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("eligible")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === "eligible"
                  ? "bg-emerald-600 text-white shadow-soft"
                  : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
              }`}
            >
              Eligible ≥{attendanceThreshold}% ({counts.eligible})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("below")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === "below"
                  ? "bg-rose-600 text-white shadow-soft"
                  : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
              }`}
            >
              Below Threshold ({counts.below})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("zero")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === "zero"
                  ? "bg-amber-600 text-white shadow-soft"
                  : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              }`}
            >
              Zero Attendance ({counts.zero})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("anomaly")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === "anomaly"
                  ? "bg-purple-600 text-white shadow-soft"
                  : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
              }`}
            >
              Tested with 0% Attendance ({counts.anomaly})
            </button>
            {aiResult && (
              <button
                type="button"
                onClick={() => setActiveFilter("flagged")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === "flagged"
                    ? "bg-rose-600 text-white shadow-soft"
                    : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                }`}
              >
                AI Flagged ({counts.flagged})
              </button>
            )}
          </div>

          {/* SEARCH INPUT */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Student ID or Name..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-edge bg-background/50 text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* GRADEBOOK TABLE */}
        <div className="overflow-hidden rounded-2xl border border-edge glass">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-edge z-10 text-muted uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="p-3.5">Student ID</th>
                  <th className="p-3.5">Grand Total Score</th>
                  <th className="p-3.5">Attendance</th>
                  <th className="p-3.5">Exam Status</th>
                  {courseTests.slice(0, 3).map((t) => (
                    <th key={t.id} className="p-3.5 truncate max-w-[120px]">
                      {t.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Compiling master gradebook and attendance records...
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      No student records matched your filter criteria.
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
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-mono font-bold text-foreground">
                                {st.studentId}
                              </p>
                              {st.studentName && (
                                <p className="text-[11px] text-muted">{st.studentName}</p>
                              )}
                            </div>
                            {isGhost && (
                              <span
                                title="Taken tests but 0% classroom presence"
                                className="inline-flex rounded-full bg-amber-500/15 p-1 text-amber-500"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Grand Total */}
                        <td className="p-3.5">
                          {st.grandTotalMax > 0 ? (
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-foreground">
                                <span>{st.grandTotalScore}</span>
                                <span className="text-muted font-normal">/ {st.grandTotalMax}</span>
                                <span className="font-mono text-accent ml-1">
                                  ({st.grandTotalPct}%)
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted font-mono">—</span>
                          )}
                        </td>

                        {/* Attendance Meter */}
                        <td className="p-3.5 min-w-[140px]">
                          <div>
                            <div className="flex justify-between items-center text-[11px] mb-1">
                              <span className="font-bold font-mono">
                                {st.attendanceCount} / {totalSessionsCount}
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  isEligible ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {st.attendancePct}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isEligible ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, st.attendancePct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Eligibility Badge */}
                        <td className="p-3.5">
                          {isEligible ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">
                              <CheckCircle2 className="h-3 w-3" />
                              Cleared
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-500">
                              <XCircle className="h-3 w-3" />
                              Barred (&lt;{attendanceThreshold}%)
                            </span>
                          )}
                        </td>

                        {/* Individual Test Scores */}
                        {courseTests.slice(0, 3).map((t) => {
                          const sc = st.testScores[t.id];
                          return (
                            <td key={t.id} className="p-3.5 font-mono">
                              {sc ? (
                                <span className="font-semibold text-foreground">
                                  {sc.score}/{sc.max}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
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
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-black/5 dark:bg-white/5 text-muted hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
