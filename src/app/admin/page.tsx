"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  Settings,
  Download,
  Shield,
  LayoutDashboard,
  QrCode,
  Trash2,
  Plus,
  PlayCircle,
  FolderOpen,
  Eye, AlertTriangle, Users, BookOpenCheck, CheckCircle2,
  BarChart3, TrendingUp, Check, Search, ArrowRight,
  CalendarCheck, Radio, Sparkles, CloudUpload, Wifi,
} from "lucide-react";
import { AttendanceProjectorModal } from "@/components/attendance/AttendanceProjectorModal";
import { AttendanceRosterModal } from "@/components/attendance/AttendanceRosterModal";
import { CourseGradebookModal } from "@/components/admin/CourseGradebookModal";
import {
  type AttendanceSession,
  exportAttendanceToCsv,
} from "@/lib/attendance";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader, BackButton } from "@/components/ui/PageHeader";
import { CourseCard, CourseBadge, type Course } from "@/components/ui/CourseCard";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { CourseSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { viewMotion, riseIn } from "@/lib/motion";

type Material = { id: string; title: string; date: string; size: string; url?: string };
type Question = { id: string; text: string; options: string[]; correct: string };

export default function AdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Modals state
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Form state
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [currentResults, setCurrentResults] = useState<Record<string, any>[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsTestTitle, setResultsTestTitle] = useState<string>("");
  const [selectedTestForResults, setSelectedTestForResults] = useState<any>(null);
  const [resultsTab, setResultsTab] = useState<"scores" | "analysis">("scores");
  const [analysisFilter, setAnalysisFilter] = useState<"all" | "flagged" | "optimal" | "mastery">("all");
  const [resultsSearchQuery, setResultsSearchQuery] = useState("");
  const [isExportingAnalysis, setIsExportingAnalysis] = useState(false);

  // Test Configurator state
  const [isConfiguringTest, setIsConfiguringTest] = useState(false);
  const [rawQuestionsText, setRawQuestionsText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [testTitle, setTestTitle] = useState("Mid-Term Assessment");
  const [testDuration, setTestDuration] = useState("00:30:00");
  const [hasUserEditedDuration, setHasUserEditedDuration] = useState(false);
  const [testPoolSize, setTestPoolSize] = useState("");
  const [testCooldown, setTestCooldown] = useState("00:30");
  const [testValidity, setTestValidity] = useState("");
  const [testValidFrom, setTestValidFrom] = useState("");
  const [testMaxTakes, setTestMaxTakes] = useState("");
  const [testIsPracticeMode, setTestIsPracticeMode] = useState(false);

  // AI Question Generator State
  const [questionMode, setQuestionMode] = useState<"ai" | "manual">("ai");
  const [aiMaterialId, setAiMaterialId] = useState<string>("auto");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("medium");
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(20);
  const [aiFocusTopic, setAiFocusTopic] = useState<string>("");
  const [aiUploadedFile, setAiUploadedFile] = useState<File | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [isEditTestModalOpen, setIsEditTestModalOpen] = useState(false);

  const [isBlocksModalOpen, setIsBlocksModalOpen] = useState(false);
  const [currentBlocks, setCurrentBlocks] = useState<any[]>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [blocksTestTitle, setBlocksTestTitle] = useState("");

  // Attendance State (strictly managed inside courses)
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [activeAttendanceSession, setActiveAttendanceSession] = useState<AttendanceSession | null>(null);
  const [rosterAttendanceSession, setRosterAttendanceSession] = useState<AttendanceSession | null>(null);
  const [isCreateAttendanceModalOpen, setIsCreateAttendanceModalOpen] = useState(false);
  const [newAttendanceTopic, setNewAttendanceTopic] = useState("");
  const [isCreatingAttendance, setIsCreatingAttendance] = useState(false);
  const [courseTab, setCourseTab] = useState<"content" | "attendance">("content");
  const [selectedCourseForNewAttendance, setSelectedCourseForNewAttendance] = useState<string>("");
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isGradebookOpen, setIsGradebookOpen] = useState(false);

  // Settings & Navigation State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [dashboardSection, setDashboardSection] = useState<"courses" | "supervision">("courses");
  const [supervisionStudents, setSupervisionStudents] = useState<any[]>([]);
  const [supervisionMetrics, setSupervisionMetrics] = useState({
    totalStudents: 0,
    activeStudents: 0,
    cohorts: [] as string[],
    todaySubmissions: 0,
  });
  const [loadingSupervision, setLoadingSupervision] = useState(false);
  const [supervisionSearch, setSupervisionSearch] = useState("");
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).scioraDesktop?.isDesktop) {
      setIsDesktopApp(true);
    }
  }, []);

  // Load supervision metrics on mount
  useEffect(() => {
    const fetchSupervision = async () => {
      setLoadingSupervision(true);
      try {
        const res = await fetch("/api/admin/students");
        const data = await res.json();
        if (res.ok) {
          setSupervisionStudents(data.students || []);
          setSupervisionMetrics(
            data.metrics || { totalStudents: 0, activeStudents: 0, cohorts: [], todaySubmissions: 0 }
          );
        }
      } catch (err) {
        console.error("Failed to load supervision metrics:", err);
      } finally {
        setLoadingSupervision(false);
      }
    };
    fetchSupervision();
  }, []);

  useEffect(() => {
    // Background auto-cleanup of grades older than 3 months
    const cleanupOldGrades = async () => {
      try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const q = query(
          collection(db, "grades"),
          where("completedAt", "<", threeMonthsAgo)
        );
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map((docSnap) => 
          deleteDoc(doc(db, "grades", docSnap.id))
        );
        
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
          console.log(`Auto-cleaned ${deletePromises.length} expired grade records.`);
        }
      } catch (err) {
        console.error("Auto-cleanup failed:", err);
      }
    };
    cleanupOldGrades();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "courses"),
      (snapshot) => {
        const coursesData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Course),
        );
        coursesData.sort((a, b) => a.code.localeCompare(b.code));
        setCourses(coursesData);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [retryKey]);

  // Subscribe to all attendance sessions
  useEffect(() => {
    const q = query(collection(db, "attendance_sessions"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AttendanceSession[];
        list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAttendanceSessions(list);
      },
      (err) => console.error("Error loading attendance sessions:", err)
    );
    return () => unsubscribe();
  }, []);

  // Keep active modals in sync with live Firestore session updates
  useEffect(() => {
    if (activeAttendanceSession) {
      const match = attendanceSessions.find((s) => s.id === activeAttendanceSession.id);
      if (match && match.attendeeCount !== activeAttendanceSession.attendeeCount) {
        setActiveAttendanceSession(match);
      }
    }
    if (rosterAttendanceSession) {
      const match = attendanceSessions.find((s) => s.id === rosterAttendanceSession.id);
      if (match) {
        setRosterAttendanceSession(match);
      }
    }
  }, [attendanceSessions, activeAttendanceSession, rosterAttendanceSession]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const courseAttendanceSessions = useMemo(() => {
    if (!selectedCourseId) return [];
    return attendanceSessions.filter((s) => s.courseId === selectedCourseId);
  }, [attendanceSessions, selectedCourseId]);

  const filteredSupervisionStudents = useMemo(() => {
    if (!supervisionSearch.trim()) return supervisionStudents;
    const q = supervisionSearch.toLowerCase();
    return supervisionStudents.filter(
      (s) =>
        s.student_id?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.project_topic?.toLowerCase().includes(q) ||
        s.academic_year?.toLowerCase().includes(q)
    );
  }, [supervisionStudents, supervisionSearch]);

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseToUse = selectedCourse || courses.find((c) => c.id === selectedCourseForNewAttendance);
    if (!courseToUse || !newAttendanceTopic.trim()) {
      toast({ kind: "error", title: "Select a course and enter a topic" });
      return;
    }

    setIsCreatingAttendance(true);
    try {
      const res = await fetch("/api/attendance/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: courseToUse.id,
          courseCode: courseToUse.code,
          courseTitle: courseToUse.title,
          title: newAttendanceTopic.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create attendance session.");
      }

      const data = await res.json();
      setIsCreateAttendanceModalOpen(false);
      setNewAttendanceTopic("");
      toast({ kind: "success", title: "Attendance Session Started!" });
      setActiveAttendanceSession(data.session);
    } catch (err) {
      console.error("Error creating attendance:", err);
      toast({
        kind: "error",
        title: "Could not start attendance",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsCreatingAttendance(false);
    }
  };

  const handleEndAttendanceSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/attendance/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: "ended" }),
      });
      if (res.ok) {
        toast({ kind: "success", title: "Session ended." });
        if (activeAttendanceSession?.id === sessionId) {
          setActiveAttendanceSession(null);
        }
      }
    } catch (err) {
      console.error("Error ending attendance session:", err);
    }
  };

  const handleDeleteAttendanceSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/attendance/session?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ kind: "success", title: "Attendance session deleted." });
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      toast({ kind: "error", title: "Could not delete session." });
    }
  };

  const handleSyncOfflineData = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await fetch("/api/attendance/offline/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast({
        kind: "success",
        title: "Cloud Sync Complete",
        description: data.message,
      });
    } catch (err) {
      console.error("Cloud sync error:", err);
      toast({
        kind: "error",
        title: "Sync Failed",
        description: err instanceof Error ? err.message : "Connect to internet and try again.",
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleDeleteMaterial = async (courseId: string, materialId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;
    try {
      await updateDoc(doc(db, "courses", courseId), {
        materials: course.materials.filter((m) => m.id !== materialId),
      });
      toast({ kind: "success", title: "Material removed" });
    } catch (error) {
      console.error("Error deleting material:", error);
      toast({
        kind: "error",
        title: "Couldn't remove material",
        description: "Check your connection and try again.",
      });
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourseId) return;
    try {
      await deleteDoc(doc(db, "courses", selectedCourseId));
      setSelectedCourseId(null);
      toast({ kind: "success", title: "Course deleted" });
    } catch (error) {
      console.error("Error deleting course:", error);
      toast({
        kind: "error",
        title: "Couldn't delete course",
        description: "Check your connection and try again.",
      });
    } finally {
      setIsConfirmDeleteOpen(false);
    }
  };

  const handleEndTest = async (courseId: string, testId?: string) => {
    try {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;

      if (testId && course.activeTests) {
        await updateDoc(doc(db, "courses", courseId), {
          activeTests: course.activeTests.filter((t: Record<string, unknown>) => t.id !== testId),
        });
      } else {
        await updateDoc(doc(db, "courses", courseId), { activeTest: null });
      }

      toast({ kind: "success", title: "Test ended", description: "Students can no longer start it." });
    } catch (error) {
      console.error("Error ending test:", error);
      toast({ kind: "error", title: "Couldn't end the test" });
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseFormError(null);
    if (!newCourseCode.trim() || !newCourseTitle.trim()) {
      setCourseFormError("Both course code and title are required.");
      return;
    }
    setIsAddingCourse(true);
    try {
      await addDoc(collection(db, "courses"), {
        code: newCourseCode.trim().toUpperCase(),
        title: newCourseTitle.trim(),
        materials: [],
        activeTest: null,
      });
      setIsAddCourseModalOpen(false);
      setNewCourseCode("");
      setNewCourseTitle("");
      toast({ kind: "success", title: "Course created" });
    } catch (error) {
      console.error("Error adding course:", error);
      setCourseFormError("The course couldn't be created. Check your connection and try again.");
    } finally {
      setIsAddingCourse(false);
    }
  };

  const closeAddCourseModal = () => {
    if (isAddingCourse) return;
    setIsAddCourseModalOpen(false);
    setCourseFormError(null);
  };

  const handleViewResults = async (testTitle: string, testObj?: any) => {
    if (!selectedCourse) return;
    setIsLoadingResults(true);
    setResultsTestTitle(testTitle);
    const foundTest =
      testObj ||
      selectedCourse.activeTests?.find((t: any) => t.title === testTitle) ||
      (selectedCourse.activeTest?.title === testTitle ? selectedCourse.activeTest : null);
    setSelectedTestForResults(foundTest || null);
    setResultsTab("scores");
    setAnalysisFilter("all");
    setResultsSearchQuery("");
    setIsResultsModalOpen(true);
    try {
      const q = query(
        collection(db, "grades"),
        where("courseId", "==", selectedCourse.id)
      );
      const snap = await getDocs(q);
      let results = snap.docs.map(d => d.data());
      if (testTitle) {
        results = results.filter(r => r.testTitle === testTitle);
      }
      setCurrentResults(results);
    } catch (error) {
      console.error("Error fetching results", error);
      toast({ kind: "error", title: "Failed to load results" });
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleViewBlocks = async (testTitle: string) => {
    if (!selectedCourse) return;
    setIsLoadingBlocks(true);
    setBlocksTestTitle(testTitle);
    setIsBlocksModalOpen(true);
    try {
      const q = query(
        collection(db, "test_blocks"),
        where("courseId", "==", selectedCourse.id),
        where("testTitle", "==", testTitle)
      );
      const snap = await getDocs(q);
      const blocks = snap.docs.map(d => d.data());
      // Sort by timestamp descending
      blocks.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setCurrentBlocks(blocks);
    } catch (error) {
      console.error("Error fetching blocked attempts", error);
      toast({ kind: "error", title: "Failed to load attempt logs" });
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  const handleExportCsv = async (testTitle?: string) => {
    if (!selectedCourse || isExporting) return;
    setIsExporting(true);
    try {
      const q = query(
        collection(db, "grades"),
        where("courseId", "==", selectedCourse.id),
      );
      const snap = await getDocs(q);

      let docsData = snap.docs.map(d => d.data());
      if (testTitle) {
        docsData = docsData.filter(g => g.testTitle === testTitle);
      }

      if (docsData.length === 0) {
        toast({
          kind: "info",
          title: "No results yet",
          description: "No student has completed this test.",
        });
        return;
      }

      const rows: string[][] = [
        ["Student ID", "Course", "Test", "Score", "Total", "Percentage", "Completed"],
      ];
      docsData.forEach((g) => {
        const pct = Math.round((g.score / g.totalQuestions) * 100);
        rows.push([
          g.studentId,
          selectedCourse.code,
          g.testTitle,
          String(g.score),
          String(g.totalQuestions),
          `${pct}%`,
          g.completedAt?.seconds
            ? new Date(g.completedAt.seconds * 1000).toLocaleString()
            : "",
        ]);
      });

      const csv = rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedCourse.code}-results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        kind: "success",
        title: "Results exported",
        description: `${docsData.length} row${docsData.length === 1 ? "" : "s"} downloaded as CSV.`,
      });
    } catch (error) {
      console.error("Error exporting results:", error);
      toast({
        kind: "error",
        title: "Export failed",
        description: "Couldn't read the results. Check your connection and try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const itemAnalysis = useMemo(() => {
    if (!selectedTestForResults?.testData || selectedTestForResults.testData.length === 0) {
      return [];
    }

    const questions: Question[] = selectedTestForResults.testData;
    const totalSubmissions = currentResults.length;

    return questions.map((q, qIndex) => {
      let attemptsCount = 0;
      let correctCount = 0;
      const optionCounts: Record<string, number> = {};

      (q.options || []).forEach((opt) => {
        optionCounts[opt] = 0;
      });

      currentResults.forEach((res) => {
        if (res.responses) {
          const selected = res.responses[q.id] ?? res.responses[qIndex] ?? res.responses[String(qIndex)];
          if (selected !== undefined && selected !== null && selected !== "") {
            attemptsCount++;
            if (selected === q.correct) {
              correctCount++;
            }
            optionCounts[selected] = (optionCounts[selected] || 0) + 1;
          }
        }
      });

      const hasDetailedResponses = attemptsCount > 0;
      const pValue = hasDetailedResponses
        ? Math.round((correctCount / attemptsCount) * 100)
        : (totalSubmissions > 0
            ? Math.round(
                (currentResults.reduce((acc, r) => acc + (Number(r.score) / (Number(r.totalQuestions) || 1)), 0) /
                  totalSubmissions) *
                  100
              )
            : 0);

      let distractorTrapOption: string | null = null;
      let distractorTrapPct = 0;

      if (hasDetailedResponses && attemptsCount >= 2) {
        (q.options || []).forEach((opt) => {
          if (opt !== q.correct) {
            const count = optionCounts[opt] || 0;
            const pct = Math.round((count / attemptsCount) * 100);
            if (pct >= 35 && pct > distractorTrapPct) {
              distractorTrapOption = opt;
              distractorTrapPct = pct;
            }
          }
        });
      }

      let classification: "hard" | "optimal" | "mastery" = "optimal";
      if (pValue < 40) {
        classification = "hard";
      } else if (pValue >= 80) {
        classification = "mastery";
      }

      const isFlagged = classification === "hard" || distractorTrapOption !== null;

      return {
        index: qIndex + 1,
        id: q.id,
        text: q.text,
        options: q.options || [],
        correct: q.correct,
        attemptsCount: hasDetailedResponses ? attemptsCount : totalSubmissions,
        correctCount: hasDetailedResponses ? correctCount : Math.round((pValue / 100) * totalSubmissions),
        pValue,
        optionCounts,
        hasDetailedResponses,
        distractorTrapOption,
        distractorTrapPct,
        classification,
        isFlagged,
      };
    });
  }, [selectedTestForResults, currentResults]);

  const cohortMetrics = useMemo(() => {
    if (currentResults.length === 0) {
      return {
        totalStudents: 0,
        avgScore: 0,
        passRate: 0,
        highScore: 0,
        lowScore: 0,
        flaggedCount: 0,
        masteryCount: 0,
        optimalCount: 0,
      };
    }

    const percentages = currentResults.map((r) =>
      Math.round((Number(r.score) / (Number(r.totalQuestions) || 1)) * 100)
    );
    const totalStudents = currentResults.length;
    const avgScore = Math.round(percentages.reduce((a, b) => a + b, 0) / totalStudents);
    const passRate = Math.round((percentages.filter((p) => p >= 50).length / totalStudents) * 100);
    const highScore = Math.max(...percentages);
    const lowScore = Math.min(...percentages);

    const flaggedCount = itemAnalysis.filter((i) => i.isFlagged).length;
    const masteryCount = itemAnalysis.filter((i) => i.classification === "mastery").length;
    const optimalCount = itemAnalysis.filter((i) => i.classification === "optimal" && !i.isFlagged).length;

    return {
      totalStudents,
      avgScore,
      passRate,
      highScore,
      lowScore,
      flaggedCount,
      masteryCount,
      optimalCount,
    };
  }, [currentResults, itemAnalysis]);

  const filteredResults = useMemo(() => {
    if (!resultsSearchQuery.trim()) return currentResults;
    const q = resultsSearchQuery.trim().toLowerCase();
    return currentResults.filter((r) =>
      String(r.studentId || "").toLowerCase().includes(q)
    );
  }, [currentResults, resultsSearchQuery]);

  const filteredItems = useMemo(() => {
    if (analysisFilter === "flagged") {
      return itemAnalysis.filter((i) => i.isFlagged);
    }
    if (analysisFilter === "optimal") {
      return itemAnalysis.filter((i) => i.classification === "optimal" && !i.isFlagged);
    }
    if (analysisFilter === "mastery") {
      return itemAnalysis.filter((i) => i.classification === "mastery");
    }
    return itemAnalysis;
  }, [itemAnalysis, analysisFilter]);

  const handleExportItemAnalysisCsv = () => {
    if (!selectedCourse || itemAnalysis.length === 0) return;
    setIsExportingAnalysis(true);
    try {
      const rows: string[][] = [
        [
          "Question Number",
          "Question Prompt",
          "Correct Answer",
          "Difficulty Facility Index (p-value)",
          "Quality Classification",
          "Total Student Attempts",
          "Correct Responses",
          "Distractor Trap Flag",
          "Distractor Details",
        ],
      ];

      itemAnalysis.forEach((item) => {
        rows.push([
          String(item.index),
          item.text,
          item.correct,
          `${item.pValue}%`,
          item.classification === "hard"
            ? "Hard (Requires Review)"
            : item.classification === "mastery"
            ? "High Mastery"
            : "Optimal Discrimination",
          String(item.attemptsCount),
          String(item.correctCount),
          item.distractorTrapOption ? "YES" : "NO",
          item.distractorTrapOption
            ? `${item.distractorTrapPct}% selected: ${item.distractorTrapOption}`
            : "None",
        ]);
      });

      const csv = rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedCourse.code}_${resultsTestTitle || "Test"}_Item_Analysis.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        kind: "success",
        title: "Item Analysis Exported",
        description: `Exported psychometrics for ${itemAnalysis.length} questions.`,
      });
    } catch (err) {
      console.error("Export item analysis error:", err);
      toast({
        kind: "error",
        title: "Export failed",
        description: "Couldn't generate item analysis CSV. Try again.",
      });
    } finally {
      setIsExportingAnalysis(false);
    }
  };

  const handlePdfParseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse PDF');
      
      setRawQuestionsText(prev => prev ? prev + '\n\n' + data.text : data.text);
    } catch (err) {
      console.error(err);
      alert('Error extracting text from PDF');
    } finally {
      setIsParsingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleParseQuestions = () => {
    const blocks = rawQuestionsText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const result: Question[] = blocks.map((block, idx) => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const questionText = lines[0].replace(/^\d+[\.\)]\s*/, '');
      const options: string[] = [];
      let correct = "";
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^answer:/i.test(line) || /^correct:/i.test(line)) {
          correct = line.replace(/^(answer|correct):\s*/i, '').trim();
        } else if (/^[a-e1-5][\.\)]\s*/i.test(line) || /^-/.test(line)) {
          options.push(line.replace(/^[a-e1-5][\.\)]\s*/i, '').replace(/^-/, '').trim());
        } else if (/^(true|false|yes|no)$/i.test(line)) {
          options.push(line.trim());
        }
      }
      let correctText = correct;
      if (options.length > 0) {
        if (/^[a-e]$/i.test(correct)) {
          const idx = correct.toLowerCase().charCodeAt(0) - 97;
          if (options[idx]) correctText = options[idx];
        } else if (/^[1-5]$/.test(correct)) {
          const idx = parseInt(correct, 10) - 1;
          if (options[idx]) correctText = options[idx];
        }
      }

      const isTrueFalse = /^(true|false)$/i.test(correctText);
      const defaultOptions = isTrueFalse ? ["True", "False"] : ["Option A", "Option B", "Option C", "Option D"];

      return {
        id: Date.now().toString() + idx,
        text: questionText,
        options: options.length > 0 ? options : defaultOptions,
        correct: correctText || options[0] || defaultOptions[0]
      };
    });
    setParsedQuestions(result);
  };

  const handleGenerateAiQuestions = async () => {
    if (!selectedCourse) return;

    setIsGeneratingAi(true);
    try {
      const formData = new FormData();
      formData.append("difficulty", aiDifficulty);
      formData.append("questionCount", String(aiQuestionCount));
      formData.append("courseCode", selectedCourse.code || "");
      formData.append("courseTitle", selectedCourse.title || "");
      if (aiFocusTopic.trim()) {
        formData.append("focusTopic", aiFocusTopic.trim());
      }

      if (aiMaterialId === "upload") {
        if (!aiUploadedFile) {
          toast({
            kind: "error",
            title: "File required",
            description: "Please select a document file (.pdf, .docx, or .txt) to upload.",
          });
          setIsGeneratingAi(false);
          return;
        }
        formData.append("file", aiUploadedFile);
      } else if (aiMaterialId === "paste") {
        if (!rawQuestionsText.trim()) {
          toast({
            kind: "error",
            title: "Text required",
            description: "Please paste your lecture notes or text to generate questions from.",
          });
          setIsGeneratingAi(false);
          return;
        }
        formData.append("pastedText", rawQuestionsText.trim());
      } else {
        // Material from course
        let targetMat = selectedCourse.materials.find((m) => m.id === aiMaterialId);
        if (!targetMat && selectedCourse.materials.length > 0) {
          targetMat = selectedCourse.materials[0];
        }

        if (targetMat && targetMat.url) {
          formData.append("materialUrl", targetMat.url);
        } else if (rawQuestionsText.trim()) {
          formData.append("pastedText", rawQuestionsText.trim());
        } else {
          toast({
            kind: "error",
            title: "No document available",
            description: "Upload a lecture PDF to the course first, or choose 'Upload New Document'.",
          });
          setIsGeneratingAi(false);
          return;
        }
      }

      const res = await fetch("/api/admin/generate-questions", {
        method: "POST",
        body: formData,
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        if (res.status === 404) {
          throw new Error(
            "The AI Question Generator endpoint is not found on this deployment. Please run 'npx vercel --prod' to deploy the new backend to Vercel."
          );
        }
        throw new Error(
          `Server returned status ${res.status}: ${responseText.slice(0, 150) || "Empty response"}`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || data.details || `Generation failed with status ${res.status}`);
      }

      setParsedQuestions(data.questions || []);

      if (data.suggestedTitle && (!testTitle || testTitle === "Mid-Term Assessment")) {
        setTestTitle(data.suggestedTitle);
      }
      // Never overwrite testDuration — keep the lecturer's customized timer intact

      toast({
        kind: "success",
        title: "Questions generated",
        description: `AI generated ${data.questions.length} questions from ${selectedCourse.code}.`,
      });
    } catch (err) {
      console.error("AI question generation error:", err);
      toast({
        kind: "error",
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Failed to generate question bank.",
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDeleteParsedQuestion = (indexToDelete: number) => {
    setParsedQuestions((prev) => prev.filter((_, idx) => idx !== indexToDelete));
  };

  const handleSaveTest = async () => {
    if (!selectedCourseId || parsedQuestions.length === 0) return;
    try {
      let expiresAt = null;
      let validFrom = null;
      if (testValidity) {
        const parsedDate = new Date(testValidity).getTime();
        if (!isNaN(parsedDate)) expiresAt = parsedDate;
      }
      if (testValidFrom) {
        const parsedDate = new Date(testValidFrom).getTime();
        if (!isNaN(parsedDate)) validFrom = parsedDate;
      }

      const newTest = {
          id: Date.now().toString(),
          title: testTitle,
          duration: testDuration,
          questions: testPoolSize ? parseInt(testPoolSize, 10) : parsedQuestions.length,
          poolSize: testPoolSize || parsedQuestions.length.toString(),
          cooldown: testCooldown || "30",
          expiresAt: expiresAt,
          validFrom: validFrom,
          maxTakes: testMaxTakes ? parseInt(testMaxTakes, 10) : null,
          isPracticeMode: testIsPracticeMode,
          testData: parsedQuestions,
      };

      const course = courses.find(c => c.id === selectedCourseId);
      const activeTests = course?.activeTests || [];
      if (course?.activeTest && activeTests.length === 0) {
        activeTests.push(course.activeTest);
      }
      activeTests.push(newTest);

      await updateDoc(doc(db, "courses", selectedCourseId), {
        activeTests: activeTests,
        activeTest: null, // Clear legacy field
      });
      setIsConfiguringTest(false);
      setRawQuestionsText("");
      setParsedQuestions([]);
      setTestMaxTakes("");
      setTestValidity("");
      setTestValidFrom("");
      setTestIsPracticeMode(false);
      toast({ kind: "success", title: "Test Published" });
    } catch (error) {
      console.error(error);
      toast({ kind: "error", title: "Failed to save test" });
    }
  };

  const openEditTestModal = (test: any) => {
    setEditingTestId(test.id);
    setTestTitle(test.title || "");
    setTestDuration(test.duration || "");
    setTestPoolSize(test.poolSize || "");
    setTestCooldown(test.cooldown || "");
    setTestMaxTakes(test.maxTakes ? String(test.maxTakes) : "");
    setTestIsPracticeMode(!!test.isPracticeMode);
    if (test.expiresAt) {
      const d = new Date(test.expiresAt);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setTestValidity(formatted);
    } else {
      setTestValidity("");
    }
    if (test.validFrom) {
      const d = new Date(test.validFrom);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setTestValidFrom(formatted);
    } else {
      setTestValidFrom("");
    }
    setIsEditTestModalOpen(true);
  };

  const handleUpdateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !editingTestId) return;

    try {
      let expiresAt = null;
      let validFrom = null;
      if (testValidity) {
        const parsedDate = new Date(testValidity).getTime();
        if (!isNaN(parsedDate)) expiresAt = parsedDate;
      }
      if (testValidFrom) {
        const parsedDate = new Date(testValidFrom).getTime();
        if (!isNaN(parsedDate)) validFrom = parsedDate;
      }

      const course = courses.find(c => c.id === selectedCourseId);
      if (!course) return;

      const activeTests = (course.activeTests || []).map((t: any) => {
        if (t.id === editingTestId) {
          return {
            ...t,
            title: testTitle,
            duration: testDuration,
            poolSize: testPoolSize,
            questions: testPoolSize ? parseInt(testPoolSize, 10) : t.testData?.length || 0,
            cooldown: testCooldown,
            expiresAt: expiresAt,
            validFrom: validFrom,
            maxTakes: testMaxTakes ? parseInt(testMaxTakes, 10) : null,
            isPracticeMode: testIsPracticeMode,
          };
        }
        return t;
      });

      // Legacy fallback
      let updatedLegacyActiveTest = course.activeTest;
      if (course.activeTest && course.activeTest.id === editingTestId) {
        updatedLegacyActiveTest = {
            ...course.activeTest,
            title: testTitle,
            duration: testDuration,
            poolSize: testPoolSize,
            questions: testPoolSize ? parseInt(testPoolSize, 10) : course.activeTest.testData?.length || 0,
            cooldown: testCooldown,
            expiresAt: expiresAt,
            validFrom: validFrom,
            maxTakes: testMaxTakes ? parseInt(testMaxTakes, 10) : null,
            isPracticeMode: testIsPracticeMode,
        };
      }

      await updateDoc(doc(db, "courses", selectedCourseId), {
        activeTests,
        ...(updatedLegacyActiveTest ? { activeTest: updatedLegacyActiveTest } : {})
      });

      setIsEditTestModalOpen(false);
      setEditingTestId(null);
      toast({ kind: "success", title: "Test updated" });
    } catch (error) {
      console.error(error);
      toast({ kind: "error", title: "Failed to update test" });
    }
  };

  function handleUploadPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile || !pdfTitle || !selectedCourseId) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", pdfFile);
    formData.append("upload_preset", "zayyad");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.cloudinary.com/v1_1/dkxsqkjkd/auto/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const newMaterial: Material = {
            id: Date.now().toString(),
            title: pdfTitle,
            date: new Date().toLocaleDateString(),
            size: `${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB`,
            url: response.secure_url,
          };

          await updateDoc(doc(db, "courses", selectedCourseId), {
            materials: [...course.materials, newMaterial],
          });

          setIsUploadModalOpen(false);
          setPdfTitle("");
          setPdfFile(null);
          toast({ kind: "success", title: "Material uploaded", description: pdfTitle });
        } catch (error) {
          console.error("Error updating firestore:", error);
          setUploadError(
            error instanceof Error ? error.message : "The file uploaded but couldn't be saved.",
          );
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      } else {
        let message = "Upload failed";
        try {
          const errResponse = JSON.parse(xhr.responseText);
          message = errResponse.error?.message || message;
        } catch {
          /* keep default */
        }
        setUploadError(message);
        setIsUploading(false);
        setUploadProgress(0);
      }
    };

    xhr.onerror = () => {
      setUploadError("Network error occurred during upload");
      setIsUploading(false);
      setUploadProgress(0);
    };

    xhr.send(formData);
  }

  return (
    <div className="relative z-10 min-h-[100dvh] p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          icon={LayoutDashboard}
          eyebrow={
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-accent tracking-wide uppercase">Admin</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success normal-case tracking-normal">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Authenticated
              </span>
              {isDesktopApp && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent normal-case tracking-normal">
                  <Wifi className="h-3 w-3" />
                  Desktop Hotspot Mode
                </span>
              )}
            </span>
          }
          title="Dashboard"
          actions={
            <Button
              variant="glass"
              icon={Settings}
              onClick={() => setIsSettingsModalOpen(true)}
              aria-label="Admin Settings & Security"
            >
              Settings
            </Button>
          }
        />

        <AnimatePresence mode="wait">
          {!selectedCourseId ? (
            /* MAIN DASHBOARD: COURSES & SUPERVISION */
            <motion.div key="admin-main-dashboard" {...viewMotion} className="space-y-6">
              {/* SECTION SWITCHER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge/60 pb-4">
                <div className="inline-flex items-center gap-1 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-edge">
                  <button
                    type="button"
                    onClick={() => setDashboardSection("courses")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      dashboardSection === "courses"
                        ? "bg-white text-zinc-950 shadow-sm font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <BookOpenCheck className="h-4 w-4" />
                    Courses
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-xs font-mono font-bold ${
                        dashboardSection === "courses"
                          ? "bg-zinc-900/10 text-zinc-950"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {courses.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashboardSection("supervision")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      dashboardSection === "supervision"
                        ? "bg-white text-zinc-950 shadow-sm font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Supervision
                    {supervisionMetrics.totalStudents > 0 && (
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs font-mono font-bold ${
                          dashboardSection === "supervision"
                            ? "bg-zinc-900/10 text-zinc-950"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        {supervisionMetrics.totalStudents}
                      </span>
                    )}
                  </button>
                </div>

                {dashboardSection === "courses" ? (
                  <Button icon={Plus} onClick={() => setIsAddCourseModalOpen(true)}>
                    Add Course
                  </Button>
                ) : (
                  <Link href="/admin/students">
                    <Button icon={ArrowRight} variant="primary">
                      Manage Supervision Roster
                    </Button>
                  </Link>
                )}
              </div>

              {dashboardSection === "courses" ? (
                /* COURSES SECTION */
                <div>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-muted-strong">Your Courses</h2>
                  </div>

                  {loadError ? (
                    <ErrorState
                      title="Courses couldn't be loaded"
                      onRetry={() => {
                        setLoadError(false);
                        setLoading(true);
                        setRetryKey((k) => k + 1);
                      }}
                    />
                  ) : loading ? (
                    <div
                      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                      role="status"
                      aria-label="Loading courses"
                    >
                      <CourseSkeleton height={200} />
                      <CourseSkeleton height={200} />
                      <CourseSkeleton height={200} />
                      <span className="sr-only">Loading courses...</span>
                    </div>
                  ) : courses.length === 0 ? (
                    <EmptyState
                      icon={FolderOpen}
                      title="No courses yet"
                      description="Create your first course to start uploading materials and publishing tests."
                      action={
                        <Button icon={Plus} onClick={() => setIsAddCourseModalOpen(true)}>
                          Add Course
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {courses.map((course, idx) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          index={idx}
                          height={200}
                          onSelect={() => setSelectedCourseId(course.id)}
                          badges={
                            <>
                              <CourseBadge>
                                <FileText className="h-3 w-3" aria-hidden="true" />
                                {course.materials.length}{" "}
                                {course.materials.length === 1 ? "Material" : "Materials"}
                              </CourseBadge>
                              {course.activeTest && (
                                <CourseBadge tone="success" dot>
                                  Test Active
                                </CourseBadge>
                              )}
                              {attendanceSessions.some((s) => s.courseId === course.id && s.status === "active") && (
                                <CourseBadge tone="accent" dot>
                                  Attendance Live
                                </CourseBadge>
                              )}
                            </>
                          }
                          action={<>Manage Course &rarr;</>}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* SUPERVISION SECTION */
                <div className="space-y-6">
                  {/* BENTO STATS CARDS */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                        <Users className="h-4 w-4 text-accent" />
                        Supervised Students
                      </div>
                      <div className="mt-2 font-mono text-2xl font-bold text-foreground">
                        {supervisionMetrics.totalStudents}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">Assigned to your lab</div>
                    </div>

                    <div className="rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Active Roster
                      </div>
                      <div className="mt-2 font-mono text-2xl font-bold text-success">
                        {supervisionMetrics.activeStudents}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">Eligible for AI vetting</div>
                    </div>

                    <div className="rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                        <CalendarCheck className="h-4 w-4 text-accent" />
                        Active Cohorts
                      </div>
                      <div className="mt-2 truncate font-mono text-base sm:text-lg font-bold text-foreground">
                        {supervisionMetrics.cohorts.length > 0
                          ? supervisionMetrics.cohorts.join(", ")
                          : "None"}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">Academic sessions</div>
                    </div>

                    <div className="rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Vetting Today
                      </div>
                      <div className="mt-2 font-mono text-2xl font-bold text-foreground">
                        {supervisionMetrics.todaySubmissions}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">ThesisLab queries</div>
                    </div>
                  </div>

                  {/* SUPERVISION ROSTER CARD */}
                  <div className="rounded-2xl border border-edge bg-card p-5 shadow-card space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Research Students Roster</h3>
                        <p className="text-xs text-muted">
                          Undergraduate &amp; postgraduate project students under your active academic supervision.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Filter by ID, name, or topic..."
                            value={supervisionSearch}
                            onChange={(e) => setSupervisionSearch(e.target.value)}
                            className="field w-full pl-9 py-1.5 text-xs"
                          />
                        </div>
                        <Link href="/admin/students">
                          <Button variant="primary" size="sm" icon={ArrowRight}>
                            Full Directory
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {loadingSupervision ? (
                      <div className="py-12 text-center text-sm text-muted">
                        Loading supervision roster...
                      </div>
                    ) : filteredSupervisionStudents.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title={
                          supervisionSearch ? "No matching students found" : "No supervised students yet"
                        }
                        description={
                          supervisionSearch
                            ? `No students match "${supervisionSearch}".`
                            : "Register your research students to allocate daily AI vetting quotas and approve project topics."
                        }
                        action={
                          <Link href="/admin/students">
                            <Button icon={Plus}>Add Supervised Student</Button>
                          </Link>
                        }
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-edge">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-black/5 dark:bg-white/5 border-b border-edge">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-muted-strong">Student ID</th>
                              <th className="px-4 py-3 font-semibold text-muted-strong">Name</th>
                              <th className="px-4 py-3 font-semibold text-muted-strong">Approved Thesis Topic</th>
                              <th className="px-4 py-3 font-semibold text-muted-strong">Cohort</th>
                              <th className="px-4 py-3 font-semibold text-muted-strong">Status</th>
                              <th className="px-4 py-3 font-semibold text-right text-muted-strong">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-edge">
                            {filteredSupervisionStudents.slice(0, 10).map((student) => (
                              <tr key={student.student_id} className="hover:bg-accent/5 transition-colors">
                                <td className="px-4 py-3 font-mono font-bold text-accent">
                                  {student.student_id}
                                </td>
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {student.name || <span className="text-muted italic">Unassigned</span>}
                                </td>
                                <td className="px-4 py-3 max-w-xs truncate text-muted">
                                  {student.project_topic || (
                                    <span className="italic text-muted/70">No topic submitted yet</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-mono text-muted">
                                  {student.academic_year || "2026/2027"}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      student.is_active
                                        ? "bg-success/15 text-success"
                                        : "bg-danger/15 text-danger"
                                    }`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        student.is_active ? "bg-success" : "bg-danger"
                                      }`}
                                    />
                                    {student.is_active ? "Active" : "Disabled"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Link href={`/admin/students?search=${encodeURIComponent(student.student_id)}`}>
                                    <span className="text-xs font-semibold text-accent hover:underline">
                                      Edit &rarr;
                                    </span>
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filteredSupervisionStudents.length > 10 && (
                          <div className="p-3 text-center border-t border-edge bg-black/5 dark:bg-white/5">
                            <Link
                              href="/admin/students"
                              className="text-xs font-semibold text-accent hover:underline"
                            >
                              Showing 10 of {filteredSupervisionStudents.length} students — View full roster in Supervision Console &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* COURSE MANAGEMENT VIEW */
            <motion.div key="admin-course-manage" {...viewMotion} className="space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <BackButton
                    label="Back to courses"
                    onClick={() => setSelectedCourseId(null)}
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {selectedCourse?.title}
                    </h2>
                    <p className="text-sm font-medium text-muted">
                      {selectedCourse?.code}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="primary"
                    icon={BookOpenCheck}
                    onClick={() => setIsGradebookOpen(true)}
                    className="shadow-soft"
                  >
                    All-in-One Gradebook
                  </Button>
                  <Button
                    variant="subtle"
                    icon={QrCode}
                    onClick={() => {
                      setNewAttendanceTopic(`Lecture ${courseAttendanceSessions.length + 1}`);
                      setSelectedCourseForNewAttendance(selectedCourse?.id || "");
                      setIsCreateAttendanceModalOpen(true);
                    }}
                  >
                    Start QR Attendance
                  </Button>
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setIsConfirmDeleteOpen(true)}
                  >
                    <span className="hidden sm:inline">Delete Course</span>
                  </Button>
                </div>
              </div>

              {/* TAB SWITCHER */}
              <div className="flex items-center gap-2 border-b border-edge pb-2">
                <button
                  type="button"
                  onClick={() => setCourseTab("content")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                    courseTab === "content"
                      ? "bg-accent text-white shadow-soft"
                      : "bg-black/5 dark:bg-white/5 text-muted hover:text-foreground"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Materials & Tests
                </button>
                <button
                  type="button"
                  onClick={() => setCourseTab("attendance")}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                    courseTab === "attendance"
                      ? "bg-accent text-white shadow-soft"
                      : "bg-black/5 dark:bg-white/5 text-muted hover:text-foreground"
                  }`}
                >
                  <CalendarCheck className="h-4 w-4" />
                  QR Attendance
                  {courseAttendanceSessions.filter((s) => s.status === "active").length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-success animate-ping" />
                  )}
                  <span className="ml-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-xs">
                    {courseAttendanceSessions.length}
                  </span>
                </button>
              </div>

              {courseTab === "attendance" ? (
                <div className="space-y-6">
                  {/* ACTIVE SESSION HIGHLIGHT CARD */}
                  {courseAttendanceSessions
                    .filter((s) => s.status === "active")
                    .map((activeSess) => (
                      <motion.div
                        key={activeSess.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative overflow-hidden rounded-2xl border-2 border-accent/40 bg-accent-soft p-5 shadow-card"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-soft">
                              <Radio className="h-6 w-6 animate-pulse" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                                  <span className="h-2 w-2 rounded-full bg-success animate-ping" />
                                  Live Broadcast Active
                                </span>
                                <span className="text-xs text-muted font-mono">
                                  Started {new Date(activeSess.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <h3 className="text-xl font-bold text-foreground mt-0.5">{activeSess.title}</h3>
                              <p className="text-xs text-muted">
                                Dynamic rotating QR code & 6-digit code live on screen
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-accent bg-white/70 dark:bg-white/10 px-3 py-1.5 rounded-xl border border-accent/20">
                              {activeSess.attendeeCount || 0} Checked In
                            </span>
                            <Button
                              variant="primary"
                              icon={PlayCircle}
                              onClick={() => setActiveAttendanceSession(activeSess)}
                            >
                              Open Projector
                            </Button>
                            <Button
                              variant="glass"
                              icon={Users}
                              onClick={() => setRosterAttendanceSession(activeSess)}
                            >
                              Live Roster
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => handleEndAttendanceSession(activeSess.id)}
                            >
                              End Session
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                  {/* SESSIONS HEADER & ACTION */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Attendance History</h3>
                      <p className="text-xs text-muted">
                        All recorded lecture attendance sessions for {selectedCourse?.code}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="glass"
                        size="sm"
                        icon={CloudUpload}
                        loading={isSyncingCloud}
                        onClick={handleSyncOfflineData}
                      >
                        Sync Offline to Cloud
                      </Button>
                      <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => {
                          setNewAttendanceTopic(`Lecture ${courseAttendanceSessions.length + 1}`);
                          setSelectedCourseForNewAttendance(selectedCourse?.id || "");
                          setIsCreateAttendanceModalOpen(true);
                        }}
                      >
                        Start New Attendance
                      </Button>
                    </div>
                  </div>

                  {/* SESSIONS LIST / EMPTY STATE */}
                  {courseAttendanceSessions.length === 0 ? (
                    <EmptyState
                      icon={CalendarCheck}
                      title="No attendance sessions yet"
                      description="Start a live attendance session to broadcast a dynamic rotating QR code on your projector for students to scan."
                      action={
                        <Button
                          variant="primary"
                          icon={QrCode}
                          onClick={() => {
                            setNewAttendanceTopic("Lecture 1");
                            setSelectedCourseForNewAttendance(selectedCourse?.id || "");
                            setIsCreateAttendanceModalOpen(true);
                          }}
                        >
                          Start First Session
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      {courseAttendanceSessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="glass flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-edge p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                              <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    sess.status === "active"
                                      ? "bg-success/15 text-success"
                                      : "bg-black/10 dark:bg-white/10 text-muted"
                                  }`}
                                >
                                  {sess.status === "active" ? "Active" : "Closed"}
                                </span>
                                <span className="font-mono text-xs text-muted">
                                  {new Date(sess.createdAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              <h4 className="font-bold text-sm text-foreground mt-0.5">{sess.title}</h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span className="font-mono text-xs font-semibold text-muted bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                              {sess.attendeeCount || 0} Students
                            </span>

                            {sess.status === "active" && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={PlayCircle}
                                onClick={() => setActiveAttendanceSession(sess)}
                              >
                                Projector
                              </Button>
                            )}

                            <Button
                              variant="subtle"
                              size="sm"
                              icon={Users}
                              onClick={() => setRosterAttendanceSession(sess)}
                            >
                              Roster
                            </Button>

                            <IconButton
                              icon={Trash2}
                              variant="subtle"
                              label={`Delete attendance session ${sess.title}`}
                              onClick={() => handleDeleteAttendanceSession(sess.id)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* MATERIALS MANAGER */}
                <div className="space-y-4">
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-muted-strong">
                      <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
                      Course Materials
                    </h3>
                    <Button
                      variant="subtle"
                      size="sm"
                      icon={UploadCloud}
                      onClick={() => {
                        setUploadError(null);
                        setIsUploadModalOpen(true);
                      }}
                    >
                      Upload PDF
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedCourse?.materials.length === 0 ? (
                      <EmptyState
                        icon={UploadCloud}
                        title="No materials uploaded"
                        description="Upload a PDF and it appears here for every student in this course."
                        action={
                          <Button
                            variant="subtle"
                            size="sm"
                            icon={UploadCloud}
                            onClick={() => {
                              setUploadError(null);
                              setIsUploadModalOpen(true);
                            }}
                          >
                            Upload PDF
                          </Button>
                        }
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {selectedCourse?.materials.map((note) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass flex items-center justify-between rounded-xl border border-edge p-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-muted dark:bg-white/5">
                                <FileText className="h-4 w-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-medium text-foreground">
                                  {note.title}
                                </h4>
                                <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                                  Uploaded {note.date} · {note.size}
                                </p>
                              </div>
                            </div>
                            <IconButton
                              icon={Trash2}
                              variant="subtle"
                              label={`Delete ${note.title}`}
                              onClick={() =>
                                selectedCourse &&
                                handleDeleteMaterial(selectedCourse.id, note.id)
                              }
                              className="ml-3"
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </div>

                {/* TEST MANAGER */}
                <div className="space-y-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-muted-strong">
                      <Settings className="h-5 w-5 text-accent" aria-hidden="true" />
                      Test Configuration
                    </h3>
                    <Button
                      variant="subtle"
                      size="sm"
                      icon={Download}
                      loading={isExporting}
                      onClick={() => handleExportCsv()}
                    >
                      Export All Results
                    </Button>
                  </div>

                  {!isConfiguringTest && (
                    <Button onClick={() => setIsConfiguringTest(true)} className="w-full mb-6">Create New Test</Button>
                  )}

                  {isConfiguringTest && (
                    <motion.div {...riseIn()} className="card-outer mb-8">
                      <div className="card-inner flex flex-col p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-lg font-bold text-foreground">Smart Test Parser</h4>
                          <Button variant="subtle" size="sm" onClick={() => setIsConfiguringTest(false)}>Cancel</Button>
                        </div>
                        
                        <div className="mb-6 grid grid-cols-2 gap-4">
                          <Field label="Test Title" value={testTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestTitle(e.target.value)} />
                          <Field
                            label="Duration (HH:MM:SS)"
                            type="time"
                            step="1"
                            value={testDuration}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              setTestDuration(e.target.value);
                              setHasUserEditedDuration(true);
                            }}
                          />
                          <Field label="Questions to Pool (empty for all)" value={testPoolSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestPoolSize(e.target.value)} />
                          <Field label="Cooldown (HH:MM:SS)" type="time" step="1" value={testCooldown} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestCooldown(e.target.value)} />
                          <Field label="Valid From (Date & Time, empty for immediately)" type="datetime-local" value={testValidFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestValidFrom(e.target.value)} />
              <Field label="Valid Until (Date & Time, empty for forever)" type="datetime-local" value={testValidity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestValidity(e.target.value)} />
                          <Field label="Max Takes (empty for unlimited)" type="number" min="1" value={testMaxTakes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestMaxTakes(e.target.value)} />
                        </div>
                        <label className="mb-6 flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-edge bg-background transition-colors hover:border-accent">
                          <input type="checkbox" checked={testIsPracticeMode} onChange={(e) => setTestIsPracticeMode(e.target.checked)} className="h-5 w-5 accent-accent" />
                          <div>
                            <span className="font-semibold text-foreground">Practice Mode</span>
                            <p className="text-xs text-muted">Students can take this test as many times as they want without being blocked, and scores will not be recorded.</p>
                          </div>
                        </label>

                        {parsedQuestions.length === 0 ? (
                          <div className="space-y-5">
                            {/* Generation Mode Switcher */}
                            <div className="flex rounded-xl border border-edge bg-black/5 p-1 dark:bg-white/5">
                              <button
                                type="button"
                                onClick={() => setQuestionMode("ai")}
                                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                  questionMode === "ai"
                                    ? "bg-accent text-white shadow-xs"
                                    : "text-muted hover:text-foreground"
                                }`}
                              >
                                <BookOpenCheck className="h-4 w-4" />
                                Question Bank Generator
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuestionMode("manual")}
                                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                  questionMode === "manual"
                                    ? "bg-accent text-white shadow-xs"
                                    : "text-muted hover:text-foreground"
                                }`}
                              >
                                <FileText className="h-4 w-4" />
                                Manual Paste / Text
                              </button>
                            </div>

                            {questionMode === "ai" ? (
                              /* QUESTION BANK GENERATOR PANEL */
                              <div className="space-y-5 rounded-2xl border border-accent/20 bg-accent-soft/5 p-5">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                    <BookOpenCheck className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h5 className="text-sm font-bold text-foreground">
                                      Question Bank Generator
                                    </h5>
                                    <p className="text-xs text-muted">
                                      Generate multiple choice questions with verified answer keys directly from course lecture notes.
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {/* Document Source */}
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                                      Source Lecture Document
                                    </label>
                                    <select
                                      value={aiMaterialId}
                                      onChange={(e) => setAiMaterialId(e.target.value)}
                                      className="h-10 w-full rounded-xl border border-edge bg-background px-3 text-xs text-foreground focus:border-accent focus:outline-none"
                                    >
                                      {selectedCourse?.materials && selectedCourse.materials.length > 0 ? (
                                        <>
                                          <option value="auto">
                                            Latest Course Document ({selectedCourse.materials[selectedCourse.materials.length - 1].title})
                                          </option>
                                          {selectedCourse.materials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                              {m.title} ({m.size})
                                            </option>
                                          ))}
                                        </>
                                      ) : (
                                        <option value="auto" disabled>
                                          No materials in this course yet
                                        </option>
                                      )}
                                      <option value="upload">+ Upload New Document (.pdf, .docx, .txt)</option>
                                      <option value="paste">Directly Paste Lecture Notes Text</option>
                                    </select>
                                  </div>

                                  {/* Difficulty Level */}
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                                      Difficulty Level
                                    </label>
                                    <div className="flex rounded-xl border border-edge bg-black/5 p-1 dark:bg-white/5">
                                      {(["easy", "medium", "hard", "mixed"] as const).map((lvl) => (
                                        <button
                                          key={lvl}
                                          type="button"
                                          onClick={() => setAiDifficulty(lvl)}
                                          className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all ${
                                            aiDifficulty === lvl
                                              ? "bg-accent text-white shadow-xs font-semibold"
                                              : "text-muted hover:text-foreground"
                                          }`}
                                        >
                                          {lvl}
                                        </button>
                                      ))}
                                    </div>
                                    <p className="text-[11px] text-muted">
                                      {aiDifficulty === "easy" && "Recall & direct definitions from text."}
                                      {aiDifficulty === "medium" && "Conceptual comprehension & application."}
                                      {aiDifficulty === "hard" && "Critical thinking & scenario analysis."}
                                      {aiDifficulty === "mixed" && "Balanced: 30% Easy, 50% Medium, 20% Hard."}
                                    </p>
                                  </div>
                                </div>

                                {/* Dynamic File Upload when "upload" is chosen */}
                                {aiMaterialId === "upload" && (
                                  <div className="p-3.5 rounded-xl border border-edge bg-background space-y-2">
                                    <label className="text-xs font-semibold text-muted">Select File from Computer</label>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="file"
                                        ref={aiFileInputRef}
                                        accept=".pdf,.docx,.txt"
                                        onChange={(e) => setAiUploadedFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                      />
                                      <Button
                                        type="button"
                                        variant="glass"
                                        size="sm"
                                        icon={UploadCloud}
                                        onClick={() => aiFileInputRef.current?.click()}
                                      >
                                        {aiUploadedFile ? aiUploadedFile.name : "Choose .pdf, .docx, or .txt"}
                                      </Button>
                                      {aiUploadedFile && (
                                        <span className="text-xs text-success font-medium">
                                          Ready ({(aiUploadedFile.size / 1024).toFixed(0)} KB)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Dynamic Textarea when "paste" is chosen */}
                                {aiMaterialId === "paste" && (
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted">Paste Lecture Notes Text</label>
                                    <textarea
                                      rows={5}
                                      value={rawQuestionsText}
                                      onChange={(e) => setRawQuestionsText(e.target.value)}
                                      placeholder="Paste chapter text or notes here..."
                                      className="w-full rounded-xl border border-edge bg-background p-3 text-xs text-foreground focus:border-accent focus:outline-none font-mono"
                                    />
                                  </div>
                                )}

                                {/* Question Count and Focus Topic */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                                      Number of Questions
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-1 rounded-xl border border-edge bg-black/5 p-1 dark:bg-white/5">
                                        {[10, 20, 30, 50].map((count) => (
                                          <button
                                            key={count}
                                            type="button"
                                            onClick={() => setAiQuestionCount(count)}
                                            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                                              aiQuestionCount === count
                                                ? "bg-accent text-white shadow-xs font-semibold"
                                                : "text-muted hover:text-foreground"
                                            }`}
                                          >
                                            {count}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="relative w-20 shrink-0">
                                        <input
                                          type="number"
                                          min={5}
                                          max={50}
                                          value={aiQuestionCount}
                                          onChange={(e) =>
                                            setAiQuestionCount(
                                              Math.max(5, Math.min(50, parseInt(e.target.value, 10) || 5))
                                            )
                                          }
                                          className="h-10 w-full rounded-xl border border-edge bg-black/5 dark:bg-white/5 px-2 text-center text-xs font-bold text-foreground focus:border-accent focus:bg-background focus:outline-none"
                                          placeholder="Qty"
                                          title="Custom question count"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                                      Specific Focus / Scope (Optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={aiFocusTopic}
                                      onChange={(e) => setAiFocusTopic(e.target.value)}
                                      placeholder="e.g. Chapter 2, Enzyme Kinetics, Clinical Scenarios"
                                      className="h-10 w-full rounded-xl border border-edge bg-background px-3 text-xs text-foreground focus:border-accent focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  variant="primary"
                                  icon={BookOpenCheck}
                                  loading={isGeneratingAi}
                                  onClick={handleGenerateAiQuestions}
                                  className="w-full h-11 text-sm font-semibold rounded-xl"
                                >
                                  {isGeneratingAi ? "Generating..." : "Generate"}
                                </Button>
                              </div>
                            ) : (
                              /* MANUAL PARSER PANEL */
                              <div className="space-y-4">
                                <textarea
                                  className="w-full rounded-xl border border-edge bg-background p-4 text-sm text-foreground focus:border-accent focus:outline-none"
                                  rows={8}
                                  placeholder="Paste questions here... e.g.&#10;1. What is 2+2?&#10;A) 3&#10;B) 4&#10;Answer: B"
                                  value={rawQuestionsText}
                                  onChange={(e) => setRawQuestionsText(e.target.value)}
                                />
                                <div className="flex gap-4">
                                  <input 
                                    type="file" 
                                    accept="application/pdf" 
                                    ref={pdfInputRef} 
                                    onChange={handlePdfParseUpload} 
                                    className="hidden" 
                                  />
                                  <Button 
                                    variant="subtle" 
                                    className="flex-1" 
                                    onClick={() => pdfInputRef.current?.click()}
                                    loading={isParsingPdf}
                                    disabled={isParsingPdf}
                                  >
                                    {isParsingPdf ? "Extracting..." : "Upload Questions PDF"}
                                  </Button>
                                  <Button className="flex-1" onClick={handleParseQuestions} disabled={!rawQuestionsText.trim()}>
                                    Parse Questions
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* QUESTIONS PREVIEW & EDIT LIST */
                          <div className="space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-edge flex-wrap gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-success" />
                                {parsedQuestions.length} Questions Ready in Bank
                              </span>
                              <span className="text-xs text-muted">
                                Randomizer will draw {testPoolSize ? testPoolSize : parsedQuestions.length} per student
                              </span>
                            </div>

                            <div className="max-h-80 overflow-y-auto space-y-3.5 rounded-xl border border-edge bg-background p-4">
                              {parsedQuestions.map((q, i) => (
                                <div key={q.id || i} className="border-b border-edge pb-3.5 last:border-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium text-foreground text-sm">
                                      <span className="text-accent font-bold mr-1">{i + 1}.</span> {q.text}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteParsedQuestion(i)}
                                      className="text-muted hover:text-danger p-1 rounded transition-colors shrink-0"
                                      title="Remove question"
                                      aria-label={`Remove question ${i + 1}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <ul className="mt-2 space-y-1 pl-4 text-xs">
                                    {q.options.map((opt, j) => {
                                      const isCorrect = opt === q.correct || opt.includes(q.correct);
                                      return (
                                        <li
                                          key={j}
                                          className={`flex items-center gap-2 p-1.5 rounded-lg ${
                                            isCorrect
                                              ? "font-semibold text-success bg-success/10 border border-success/20"
                                              : "text-muted"
                                          }`}
                                        >
                                          <span className="font-mono text-[10px] font-bold">
                                            {String.fromCharCode(65 + j)}.
                                          </span>
                                          <span>{opt}</span>
                                          {isCorrect && (
                                            <span className="ml-auto text-[9px] uppercase font-bold text-success">
                                              Correct
                                            </span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-3">
                              <Button variant="subtle" className="flex-1" onClick={() => setParsedQuestions([])}>
                                Discard / Regenerate
                              </Button>
                              <Button className="flex-1" onClick={handleSaveTest}>
                                Publish Test to Course
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-4">
                    {(!selectedCourse?.activeTests || selectedCourse.activeTests.length === 0) && !selectedCourse?.activeTest ? (
                      <motion.div {...riseIn()} className="glass border border-dashed border-accent/30 p-8">
                        <EmptyState
                          icon={PlayCircle}
                          title="No active tests"
                          description="You have no running tests for this course."
                          variant="dashed"
                        />
                      </motion.div>
                    ) : (
                      Array.from(new Map(
                        [...(selectedCourse?.activeTest ? [selectedCourse.activeTest] : []), ...(selectedCourse?.activeTests || [])].map(t => [t.id, t])
                      ).values()).map((test) => (
                        <motion.div key={test.id} {...riseIn()} className="card-outer">
                          <div className="card-inner flex flex-col p-6">
                            <div className="mb-6 flex items-start justify-between gap-4">
                              <div>
                                <div className="mb-1 flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 animate-pulse rounded-full bg-success"
                                    aria-hidden="true"
                                  />
                                  <span className="text-xs font-bold uppercase tracking-wide text-success">
                                    Live Now
                                  </span>
                                  {test.isPracticeMode && (
                                    <span className="ml-2 rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                                      Practice
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-lg font-bold text-foreground">
                                  {test.title}
                                </h4>
                                <p className="mt-1 text-sm font-medium text-accent">
                                  {test.questions} Questions · {test.duration}
                                </p>
                              </div>
                              <div className="rounded-lg bg-accent-soft p-2 text-accent">
                                <PlayCircle className="h-5 w-5" aria-hidden="true" />
                              </div>
                            </div>

                            <div className="mt-auto flex flex-col gap-3">
                              <Button
                                variant="subtle"
                                icon={Eye}
                                onClick={() => handleViewResults(test.title, test)}
                              >
                                View Results
                              </Button>
                              <Button
                                variant="subtle"
                                icon={AlertTriangle}
                                onClick={() => handleViewBlocks(test.title)}
                              >
                                Blocked Attempts
                              </Button>
                              <Button
                                variant="subtle"
                                icon={Download}
                                loading={isExporting}
                                onClick={() => handleExportCsv(test.title)}
                              >
                                Export Results CSV
                              </Button>
                              <Button
                                variant="subtle"
                                icon={Settings}
                                onClick={() => openEditTestModal(test)}
                              >
                                Edit Configuration
                              </Button>
                              <Button
                                variant="danger"
                                icon={Shield}
                                onClick={() =>
                                  selectedCourse && handleEndTest(selectedCourse.id, test.id)
                                }
                              >
                                End Test Early
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
          )}
        </AnimatePresence>

        {/* ADD COURSE MODAL */}
        <Modal
          open={isAddCourseModalOpen}
          onClose={closeAddCourseModal}
          title="Add New Course"
          dismissible={!isAddingCourse}
        >
          <form onSubmit={handleAddCourse} className="space-y-4">
            {courseFormError && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger"
              >
                {courseFormError}
              </p>
            )}
            <Field
              label="Course Code"
              required
              placeholder="e.g. CS101"
              value={newCourseCode}
              autoComplete="off"
              onChange={(e) => {
                setNewCourseCode(e.target.value.toUpperCase());
                setCourseFormError(null);
              }}
            />
            <Field
              label="Course Title"
              required
              placeholder="e.g. Introduction to Computer Science"
              value={newCourseTitle}
              autoComplete="off"
              onChange={(e) => {
                setNewCourseTitle(e.target.value);
                setCourseFormError(null);
              }}
            />
            <Button
              type="submit"
              size="lg"
              loading={isAddingCourse}
              disabled={isAddingCourse}
              className="w-full"
            >
              {isAddingCourse ? "Adding course..." : "Add Course"}
            </Button>
          </form>
        </Modal>

        {/* EDIT TEST CONFIG MODAL */}
        <Modal
          open={isEditTestModalOpen}
          onClose={() => setIsEditTestModalOpen(false)}
          title="Edit Test Configuration"
        >
          <form onSubmit={handleUpdateTest} className="space-y-4">
            <Field label="Test Title" value={testTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestTitle(e.target.value)} />
            <Field label="Duration (mins)" value={testDuration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestDuration(e.target.value)} />
            <Field label="Questions to Pool (empty for all)" value={testPoolSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestPoolSize(e.target.value)} />
            <Field label="Cooldown (HH:MM)" type="time" value={testCooldown} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestCooldown(e.target.value)} />
            <Field label="Valid From (Date & Time, empty for immediately)" type="datetime-local" value={testValidFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestValidFrom(e.target.value)} />
            <Field label="Valid Until (Date & Time, empty for forever)" type="datetime-local" value={testValidity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestValidity(e.target.value)} />
            <Field label="Max Takes (empty for unlimited)" type="number" min="1" value={testMaxTakes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestMaxTakes(e.target.value)} />
            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-edge bg-background transition-colors hover:border-accent">
              <input type="checkbox" checked={testIsPracticeMode} onChange={(e) => setTestIsPracticeMode(e.target.checked)} className="h-5 w-5 accent-accent" />
              <div>
                <span className="font-semibold text-foreground">Practice Mode</span>
                <p className="text-xs text-muted">Unlimited takes, scores not recorded.</p>
              </div>
            </label>
            <Button
              type="submit"
              className="w-full mt-4"
              icon={Settings}
            >
              Save Changes
            </Button>
          </form>
        </Modal>

        {/* UPLOAD PDF MODAL */}
        <Modal
          open={isUploadModalOpen}
          onClose={() => !isUploading && setIsUploadModalOpen(false)}
          title="Upload Material"
          dismissible={!isUploading}
        >
          {uploadError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger"
            >
              {uploadError.includes("unauthorized") || uploadError.includes("permission")
                ? "Permission denied. Check your Firebase Storage rules, then try again."
                : uploadError}
            </p>
          )}

          <form onSubmit={(e) => handleUploadPdf(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Course Code"
                value={selectedCourse?.code || ""}
                disabled
                readOnly
              />
              <Field
                label="Course Title"
                value={selectedCourse?.title || ""}
                disabled
                readOnly
              />
            </div>

            <Field
              label="Document Title"
              required
              placeholder="e.g. Chapter 1: Fundamentals"
              value={pdfTitle}
              disabled={isUploading}
              onChange={(e) => setPdfTitle(e.target.value)}
            />

            <Field
              label="PDF File"
              type="file"
              accept=".pdf"
              required
              disabled={isUploading}
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />

            {isUploading && (
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(uploadProgress)}
                aria-label="Upload progress"
              >
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              variant="subtle"
              disabled={isUploading}
              loading={isUploading}
              className="w-full"
            >
              {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : "Upload File"}
            </Button>
          </form>
        </Modal>

        {/* CONFIRM DELETE COURSE */}
        <Modal
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="Delete this course?"
        >
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">
              {selectedCourse?.code} — {selectedCourse?.title}
            </span>{" "}
            and all of its materials and tests will be permanently removed. This
            can&apos;t be undone.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="subtle" onClick={() => setIsConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon={Trash2} onClick={handleDeleteCourse}>
              Delete Course
            </Button>
          </div>
        </Modal>

        {/* RESULTS & ITEM ANALYSIS MODAL */}
        <Modal
          open={isResultsModalOpen}
          onClose={() => setIsResultsModalOpen(false)}
          title={`Results & Item Analysis: ${resultsTestTitle}`}
          size="2xl"
        >
          {isLoadingResults ? (
            <div className="py-12 text-center text-sm font-medium text-muted">
              Loading cohort results and calculating psychometrics...
            </div>
          ) : currentResults.length === 0 ? (
            <div className="py-12 text-center text-sm font-medium text-muted">
              No students have completed this test yet.
            </div>
          ) : (
            <div className="space-y-6">
              {/* COHORT SUMMARY STATS */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-edge bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cohort Average</span>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {cohortMetrics.avgScore}%
                  </p>
                  <p className="text-[11px] text-muted">{cohortMetrics.totalStudents} total submissions</p>
                </div>
                <div className="rounded-xl border border-edge bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Pass Rate (&ge;50%)</span>
                  <p className="mt-1 text-xl font-bold text-success">
                    {cohortMetrics.passRate}%
                  </p>
                  <p className="text-[11px] text-muted">Benchmark standard</p>
                </div>
                <div className="rounded-xl border border-edge bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Range (High / Low)</span>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {cohortMetrics.highScore}% <span className="text-sm font-normal text-muted">/ {cohortMetrics.lowScore}%</span>
                  </p>
                  <p className="text-[11px] text-muted">Score spread</p>
                </div>
                <div className="rounded-xl border border-edge bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Questions to Review</span>
                  <p className={`mt-1 text-xl font-bold ${cohortMetrics.flaggedCount > 0 ? "text-danger" : "text-success"}`}>
                    {cohortMetrics.flaggedCount} <span className="text-xs font-normal text-muted">items</span>
                  </p>
                  <p className="text-[11px] text-muted">Hard or distractor traps</p>
                </div>
              </div>

              {/* SEGMENTED TAB SWITCHER */}
              <div className="flex rounded-xl border border-edge bg-black/5 p-1 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setResultsTab("scores")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                    resultsTab === "scores"
                      ? "bg-accent text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Student Scores ({currentResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultsTab("analysis")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                    resultsTab === "analysis"
                      ? "bg-accent text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Item Analysis & Quality ({itemAnalysis.length})
                  {cohortMetrics.flaggedCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                      {cohortMetrics.flaggedCount}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: STUDENT SCORES */}
              {resultsTab === "scores" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                      <input
                        type="text"
                        placeholder="Search by student ID..."
                        value={resultsSearchQuery}
                        onChange={(e) => setResultsSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-edge bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                      />
                    </div>
                    <Button
                      variant="subtle"
                      icon={Download}
                      onClick={() => handleExportCsv(resultsTestTitle)}
                      loading={isExporting}
                    >
                      Export CSV
                    </Button>
                  </div>

                  <div className="max-h-[50vh] overflow-auto rounded-xl border border-edge bg-background">
                    <table className="w-full text-left text-sm text-foreground">
                      <thead className="sticky top-0 bg-accent/5 dark:bg-accent/10 shadow-sm backdrop-blur-md">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Student ID</th>
                          <th className="px-4 py-3 font-semibold text-right">Raw Score</th>
                          <th className="px-4 py-3 font-semibold text-right">Percentage</th>
                          <th className="px-4 py-3 font-semibold text-right">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-edge">
                        {filteredResults.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                              No student scores found matching &quot;{resultsSearchQuery}&quot;.
                            </td>
                          </tr>
                        ) : (
                          filteredResults.map((res, i) => {
                            const pct = Math.round((Number(res.score) / (Number(res.totalQuestions) || 1)) * 100);
                            return (
                              <tr key={i} className="hover:bg-accent/5 transition-colors">
                                <td className="px-4 py-3 font-mono font-medium">{res.studentId}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-muted-strong">
                                  {res.score} / {res.totalQuestions}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                                      pct >= 70
                                        ? "bg-success/10 text-success"
                                        : pct >= 50
                                        ? "bg-warning/10 text-warning"
                                        : "bg-danger/10 text-danger"
                                    }`}
                                  >
                                    {pct}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-xs text-muted tabular-nums">
                                  {res.completedAt?.seconds
                                    ? new Date(res.completedAt.seconds * 1000).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Recorded"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: ITEM ANALYSIS & QUALITY */}
              {resultsTab === "analysis" && (
                <div className="space-y-4">
                  {itemAnalysis.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-edge p-8 text-center">
                      <BarChart3 className="mx-auto h-8 w-8 text-muted" />
                      <h4 className="mt-2 text-sm font-semibold text-foreground">
                        Question data not linked
                      </h4>
                      <p className="mt-1 text-xs text-muted max-w-md mx-auto">
                        Individual questions could not be retrieved from this test. Ensure this test is configured in your course to inspect real-time psychometrics.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* FILTER PILLS & EXPORT BUTTON */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAnalysisFilter("all")}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              analysisFilter === "all"
                                ? "bg-foreground text-background"
                                : "bg-black/5 dark:bg-white/5 text-muted hover:text-foreground"
                            }`}
                          >
                            All ({itemAnalysis.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnalysisFilter("flagged")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              analysisFilter === "flagged"
                                ? "bg-danger text-white"
                                : "bg-danger/10 text-danger hover:bg-danger/20"
                            }`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Needs Review ({cohortMetrics.flaggedCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnalysisFilter("optimal")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              analysisFilter === "optimal"
                                ? "bg-success text-white"
                                : "bg-success/10 text-success hover:bg-success/20"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Optimal ({cohortMetrics.optimalCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnalysisFilter("mastery")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              analysisFilter === "mastery"
                                ? "bg-accent text-white"
                                : "bg-accent/10 text-accent hover:bg-accent/20"
                            }`}
                          >
                            <TrendingUp className="h-3 w-3" />
                            High Mastery ({cohortMetrics.masteryCount})
                          </button>
                        </div>

                        <Button
                          variant="subtle"
                          size="sm"
                          icon={Download}
                          onClick={handleExportItemAnalysisCsv}
                          loading={isExportingAnalysis}
                        >
                          Export Item Analysis CSV
                        </Button>
                      </div>

                      {/* QUESTIONS LIST */}
                      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                        {filteredItems.length === 0 ? (
                          <div className="rounded-xl border border-edge bg-background p-8 text-center text-sm text-muted">
                            No questions match the current filter.
                          </div>
                        ) : (
                          filteredItems.map((item) => {
                            const total = item.attemptsCount || 1;
                            return (
                              <div
                                key={item.id || item.index}
                                className={`rounded-xl border p-4 transition-all ${
                                  item.isFlagged
                                    ? "border-danger/30 bg-danger/[0.02]"
                                    : "border-edge bg-background"
                                }`}
                              >
                                {/* HEADER */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                                      Q{item.index}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                                        item.classification === "hard"
                                          ? "bg-danger/10 text-danger"
                                          : item.classification === "mastery"
                                          ? "bg-accent/10 text-accent"
                                          : "bg-success/10 text-success"
                                      }`}
                                    >
                                      {item.classification === "hard" ? (
                                        <AlertTriangle className="h-3 w-3" />
                                      ) : item.classification === "mastery" ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                      p = {item.pValue}% ·{" "}
                                      {item.classification === "hard"
                                        ? "Hard / Low Facility"
                                        : item.classification === "mastery"
                                        ? "High Mastery"
                                        : "Optimal Range"}
                                    </span>

                                    {item.distractorTrapOption && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                                        <AlertTriangle className="h-3 w-3" />
                                        Distractor Trap
                                      </span>
                                    )}
                                  </div>

                                  <span className="text-[11px] font-medium text-muted">
                                    {item.correctCount} / {item.attemptsCount} correct ({item.pValue}%)
                                  </span>
                                </div>

                                {/* QUESTION TEXT */}
                                <p className="text-sm font-semibold text-foreground mb-3 leading-relaxed">
                                  {item.text}
                                </p>

                                {/* OPTIONS BREAKDOWN */}
                                <div className="space-y-2">
                                  {item.options.map((opt, optIdx) => {
                                    const optCount = item.optionCounts[opt] || 0;
                                    const optPct = Math.round((optCount / total) * 100);
                                    const isCorrect = opt === item.correct;
                                    const isTrap = opt === item.distractorTrapOption;
                                    const letter = String.fromCharCode(65 + optIdx);

                                    return (
                                      <div
                                        key={optIdx}
                                        className={`rounded-lg border p-2.5 transition-colors ${
                                          isCorrect
                                            ? "border-success/40 bg-success/[0.04]"
                                            : isTrap
                                            ? "border-warning/40 bg-warning/[0.04]"
                                            : "border-edge/50 bg-black/[0.01] dark:bg-white/[0.01]"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                          <div className="flex items-center gap-2 min-w-0 pr-2">
                                            <span
                                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                                                isCorrect
                                                  ? "bg-success text-white"
                                                  : isTrap
                                                  ? "bg-warning text-black"
                                                  : "bg-muted/20 text-muted"
                                              }`}
                                            >
                                              {letter}
                                            </span>
                                            <span
                                              className={`truncate font-medium ${
                                                isCorrect
                                                  ? "font-bold text-success"
                                                  : isTrap
                                                  ? "font-semibold text-warning"
                                                  : "text-foreground"
                                              }`}
                                            >
                                              {opt}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-2 shrink-0">
                                            {isCorrect && (
                                              <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                                                Correct Key
                                              </span>
                                            )}
                                            {isTrap && (
                                              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                                                Misled {item.distractorTrapPct}%
                                              </span>
                                            )}
                                            <span className="tabular-nums font-semibold text-muted-strong">
                                              {optPct}% ({optCount})
                                            </span>
                                          </div>
                                        </div>

                                        {/* PROGRESS BAR */}
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                                          <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                              isCorrect
                                                ? "bg-success"
                                                : isTrap
                                                ? "bg-warning"
                                                : "bg-muted"
                                            }`}
                                            style={{ width: `${Math.max(optPct, 0)}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* PSYCHOMETRIC INSIGHT */}
                                {item.isFlagged && (
                                  <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning leading-relaxed flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold">Item Quality Alert: </span>
                                      {item.classification === "hard" && item.distractorTrapOption
                                        ? `Only ${item.pValue}% answered correctly. A large share of students (${item.distractorTrapPct}%) were trapped by distractor "${item.distractorTrapOption}". Review wording or revisit this concept in class.`
                                        : item.classification === "hard"
                                        ? `Low facility index (${item.pValue}%). This item proved significantly challenging for the cohort. Recommend topic remediation.`
                                        : `Distractor trap detected: "${item.distractorTrapOption}" was chosen by ${item.distractorTrapPct}% of students. Verify if this option is inadvertently ambiguous.`}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* BLOCKED ATTEMPTS MODAL */}
        <Modal
          open={isBlocksModalOpen}
          onClose={() => setIsBlocksModalOpen(false)}
          title={`Blocked Attempts: ${blocksTestTitle}`}
        >
          {isLoadingBlocks ? (
            <div className="py-8 text-center text-sm font-medium text-muted">
              Loading attempt logs...
            </div>
          ) : currentBlocks.length === 0 ? (
            <div className="py-8 text-center text-sm font-medium text-muted">
              No blocked attempts for this test yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-edge bg-background">
                <table className="w-full text-left text-sm text-foreground">
                  <thead className="sticky top-0 bg-accent/5 dark:bg-accent/10 shadow-sm backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student ID</th>
                      <th className="px-4 py-3 font-semibold">Reason</th>
                      <th className="px-4 py-3 font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {currentBlocks.map((block, i) => (
                      <tr key={i} className="hover:bg-accent/5">
                        <td className="px-4 py-3 font-mono text-danger">{block.studentId}</td>
                        <td className="px-4 py-3 capitalize">
                          {block.reason === "strict" ? "Retake Not Allowed" :
                           block.reason === "cooldown" ? "Cooldown Active" : block.reason}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {block.timestamp?.seconds
                            ? new Date(block.timestamp.seconds * 1000).toLocaleString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>

        {/* ATTENDANCE PROJECTOR FULLSCREEN MODAL */}
        {activeAttendanceSession && (
          <AttendanceProjectorModal
            session={activeAttendanceSession}
            isOpen={true}
            onClose={() => setActiveAttendanceSession(null)}
            onEndSession={handleEndAttendanceSession}
          />
        )}

        {/* ATTENDANCE ROSTER MODAL */}
        {rosterAttendanceSession && (
          <AttendanceRosterModal
            session={rosterAttendanceSession}
            isOpen={true}
            onClose={() => setRosterAttendanceSession(null)}
            onOpenProjector={() => {
              const sess = rosterAttendanceSession;
              setRosterAttendanceSession(null);
              setActiveAttendanceSession(sess);
            }}
          />
        )}

        {/* ALL-IN-ONE COURSE GRADEBOOK & ATTENDANCE MODAL */}
        {selectedCourse && (
          <CourseGradebookModal
            isOpen={isGradebookOpen}
            onClose={() => setIsGradebookOpen(false)}
            course={selectedCourse}
          />
        )}

        {/* CREATE ATTENDANCE SESSION MODAL */}
        <Modal
          open={isCreateAttendanceModalOpen}
          onClose={() => setIsCreateAttendanceModalOpen(false)}
          title="Start Live QR Attendance Session"
          dismissible={!isCreatingAttendance}
        >
          <form onSubmit={handleCreateAttendance} className="space-y-4">
            {!selectedCourse && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-strong">
                  Select Course
                </label>
                <select
                  className="field w-full"
                  value={selectedCourseForNewAttendance}
                  onChange={(e) => setSelectedCourseForNewAttendance(e.target.value)}
                  required
                >
                  <option value="">-- Choose Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Field
              label="Session Topic / Lecture Title"
              placeholder="e.g. Lecture 4: Gene Cloning and Expression"
              value={newAttendanceTopic}
              onChange={(e) => setNewAttendanceTopic(e.target.value)}
              required
              hint="This title appears on the live projector screen and in students' verified records."
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="subtle"
                onClick={() => setIsCreateAttendanceModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isCreatingAttendance}>
                Launch Projector &amp; QR
              </Button>
            </div>
          </form>
        </Modal>

        {/* ADMIN SETTINGS & SECURITY MODAL */}
        <Modal
          open={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          title="Admin Settings & Security"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Configure system privileges, research supervision quotas, and authentication credentials.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {/* SUPERVISION SETTINGS CARD */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4 transition-all hover:border-accent/30">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Supervision &amp; Project Students</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Manage assigned thesis students, review research topics, and set daily AI vetting quotas.
                    </p>
                  </div>
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    router.push("/admin/students");
                  }}
                  className="shrink-0"
                >
                  Manage Directory &rarr;
                </Button>
              </div>

              {/* AUTHENTICATOR 2FA CARD */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4 transition-all hover:border-accent/30">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Two-Factor Authenticator (2FA)</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Pair or reset Google Authenticator / Apple Passwords. Protected by Master Password (619000).
                    </p>
                  </div>
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    router.push("/admin/login");
                  }}
                  className="shrink-0"
                >
                  Configure 2FA &rarr;
                </Button>
              </div>

              {/* LOCK DASHBOARD CARD */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-danger/20 bg-danger/5 p-4 transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-danger">Lock Admin Console</h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Immediately terminate your administrative session and return to the main homepage.
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem("sciora_admin_auth");
                    setIsSettingsModalOpen(false);
                    router.push("/");
                  }}
                  className="shrink-0"
                >
                  Lock Dashboard
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}





