"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Play,
  GraduationCap,
  LogOut,
  BookOpen,
  LayoutGrid,
  User,
  CheckCircle2,
  FolderOpen,
  Clock,
  ArrowRight,
  CalendarCheck,
  Radio,
} from "lucide-react";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type AttendanceSession } from "@/lib/attendance";

import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader, BackButton } from "@/components/ui/PageHeader";
import { CourseCard, CourseBadge, type Course } from "@/components/ui/CourseCard";
import { CourseSkeleton, SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { EXPO, viewMotion } from "@/lib/motion";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { ThesisLabWorkspace, type QuotaData } from "@/components/thesislab/ThesisLabWorkspace";

type Material = { id: string; title: string; date: string; size: string; url?: string };

function TestStartCountdown({ validFrom, children }: { validFrom: number, children: React.ReactNode }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    setTimeLeft(validFrom - Date.now());
    const interval = setInterval(() => {
      setTimeLeft(validFrom - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [validFrom]);

  if (timeLeft === null) return null;
  if (timeLeft <= 0) return <>{children}</>;

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = String(Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
  const seconds = String(Math.floor((timeLeft % (1000 * 60)) / 1000)).padStart(2, "0");

  return (
    <div className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-edge bg-black/5 font-semibold text-muted dark:bg-white/10">
      <Clock className="h-4 w-4" aria-hidden="true" />
      Starts in: {days > 0 ? days + "d " : ""}{hours > 0 ? hours + "h " : ""}{minutes}m {seconds}s
    </div>
  );
}

function TestExpiryCountdown({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    setTimeLeft(expiresAt - Date.now());
    const interval = setInterval(() => {
      setTimeLeft(expiresAt - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft === null) return null;
  if (timeLeft <= 0) return <span className="text-danger text-xs font-bold">Expired</span>;

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = String(Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
  const seconds = String(Math.floor((timeLeft % (1000 * 60)) / 1000)).padStart(2, "0");

  return (
    <span className="flex items-center gap-1 font-mono text-xs text-danger font-medium">
      <Clock className="w-3 h-3" />
      Ends in: {hours > 0 ? `${hours}h ` : ""}{minutes}m {seconds}s
    </span>
  );
}

export default function NotesViewer() {
  const studentId = useLocalStorage("sciora_student_id");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [projectStudent, setProjectStudent] = useState<QuotaData | null>(null);
  const [activeTab, setActiveTab] = useState<"courses" | "thesislab">("courses");
  const [activeAttendanceSessions, setActiveAttendanceSessions] = useState<AttendanceSession[]>([]);

  const [isNavigatingProfile, setIsNavigatingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const router = useRouter();
  const toast = useToast();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isMounted && !studentId) {
      router.push("/login");
    }
  }, [isMounted, studentId, router]);

  // Check if logged-in student is one of the supervisor's assigned project students
  useEffect(() => {
    if (!studentId) return;

    let isSubscribed = true;
    const checkProjectStudentStatus = async () => {
      try {
        const res = await fetch(
          `/api/vet-project/quota?studentId=${encodeURIComponent(studentId.trim().toUpperCase())}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed && data.valid && data.isActive !== false) {
            setProjectStudent(data);
            if (typeof window !== "undefined" && window.location.search.includes("tab=thesislab")) {
              setActiveTab("thesislab");
            }
          }
        } else {
          if (isSubscribed) setProjectStudent(null);
        }
      } catch {
        if (isSubscribed) setProjectStudent(null);
      }
    };

    checkProjectStudentStatus();
    return () => {
      isSubscribed = false;
    };
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;

    const unsubscribeCourses = onSnapshot(
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
        setLoadError("We couldn't load your courses.");
        setLoading(false);
      },
    );

    const q = query(collection(db, "grades"), where("studentId", "==", studentId));
    const unsubscribeGrades = onSnapshot(
      q,
      (snapshot) => {
        const completed = new Set<string>();
        snapshot.docs.forEach((d) => {
          const g = d.data();
          completed.add(`${g.courseId}_${g.testTitle}`);
        });
        setCompletedTests(completed);
      },
      () => {
        // Non-fatal: the page still works without progress badges.
        toast({
          kind: "error",
          title: "Progress unavailable",
          description: "Test completion badges couldn't be loaded.",
        });
      },
    );

    const qAttendance = query(
      collection(db, "attendance_sessions"),
      where("status", "==", "active")
    );
    const unsubscribeAttendance = onSnapshot(
      qAttendance,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AttendanceSession[];
        setActiveAttendanceSessions(list);
      },
      () => {}
    );

    return () => {
      unsubscribeCourses();
      unsubscribeGrades();
      unsubscribeAttendance();
    };
  }, [studentId, retryKey, toast]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    window.setTimeout(() => {
      localStorage.removeItem("sciora_student_id");
      router.push("/");
    }, 400);
  };

  const handleProfileClick = () => {
    setIsNavigatingProfile(true);
    window.setTimeout(() => router.push("/profile"), 400);
  };

  const handleDownload = async (note: Material) => {
    if (downloadingId) return;

    if (!note.url) {
      toast({
        kind: "info",
        title: "No file uploaded yet",
        description: `"${note.title}" has no document attached. Ask your lecturer to upload it.`,
      });
      return;
    }

    setDownloadingId(note.id);
    const safeUrl = note.url.replace("/fl_attachment", "");
    try {
      const res = await fetch(safeUrl);
      if (!res.ok) throw new Error("Failed to fetch PDF");
      const arrayBuffer = await res.arrayBuffer();

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();

        page.drawText("Sciora", {
          x: width / 2 - 200,
          y: height / 2 - 50,
          size: 100,
          color: rgb(0.8, 0.8, 0.8),
          rotate: degrees(45),
          opacity: 0.5,
        });

        page.drawText(`Downloaded from Sciora by ${studentId} | ${new Date().toLocaleDateString()}`, {
          x: 40,
          y: 20,
          size: 10,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes).buffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = note.title.endsWith(".pdf") ? note.title : `${note.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Watermarking failed, falling back to direct open:", error);
      window.open(safeUrl, "_blank", "noopener,noreferrer");
      toast({
        kind: "info",
        title: "Opened the original file",
        description: "Watermarking wasn't available, so the source PDF opened in a new tab.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Show nothing while redirecting (no flash)
  if (!studentId) return null;

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const studentDisplayName = projectStudent?.name || projectStudent?.studentName;

  return (
    <div className="relative z-10 min-h-[100dvh] p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          icon={BookOpen}
          eyebrow="Student Portal"
          title="Classroom"
          description={
            projectStudent ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <GraduationCap className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
                {studentDisplayName ? (
                  <>
                    <span className="font-semibold text-foreground">{studentDisplayName}</span>
                    <span className="text-muted font-mono text-xs">({studentId})</span>
                  </>
                ) : (
                  <>
                    <span>Logged in as </span>
                    <span className="font-mono tabular-nums text-accent">{studentId}</span>
                  </>
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-accent/25 text-accent shadow-2xs dark:bg-accent/15 dark:border-accent/30 dark:text-accent">
                  Project Student
                </span>
              </span>
            ) : (
              <>
                <GraduationCap className="mr-1 inline h-4 w-4" aria-hidden="true" />
                Logged in as{" "}
                <span className="font-mono tabular-nums text-accent">{studentId}</span>
              </>
            )
          }
          actions={
            <>
              <Button
                variant="glass"
                icon={CalendarCheck}
                onClick={() => router.push("/attendance")}
                aria-label="Attendance check-in"
              >
                Check In
                {activeAttendanceSessions.length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-success animate-ping ml-1" />
                )}
              </Button>
              <Button
                variant="glass"
                icon={User}
                onClick={handleProfileClick}
                disabled={isNavigatingProfile || isLoggingOut}
                aria-label="View profile"
              >
                Profile
              </Button>
              <Button
                variant="glass"
                icon={LogOut}
                onClick={handleLogout}
                disabled={isNavigatingProfile || isLoggingOut}
                loading={isLoggingOut}
                aria-label="Log out of student portal"
                className="text-muted"
              >
                Logout
              </Button>
            </>
          }
        />

        {/* Tab Navigation for Authorized Project Students */}
        {projectStudent && !selectedCourseId && (
          <div className="flex items-center gap-2 border-b border-edge mb-6 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("courses")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === "courses"
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Courses & Tests
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("thesislab")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === "thesislab"
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <FileText className="w-4 h-4" />
              ThesisLab (Vetting Desk)
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {projectStudent && activeTab === "thesislab" && !selectedCourseId ? (
            /* THESISLAB WORKSPACE FOR AUTHORIZED PROJECT STUDENTS */
            <motion.div key="thesislab-workspace" {...viewMotion} className="pt-2">
              <ThesisLabWorkspace
                initialStudentId={studentId}
                isEmbeddedInClassroom={true}
                onBackToClassroom={() => setActiveTab("courses")}
              />
            </motion.div>
          ) : !selectedCourseId ? (
            /* COURSE SELECTION GRID */
            <motion.div key="course-grid" {...viewMotion} className="space-y-6">
              {/* Featured Project Vetting Banner for Supervisor's Students */}
              {projectStudent && (
                <div className="card-outer border-accent/30 bg-accent-soft/10">
                  <div className="card-inner p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-accent/25 text-accent shadow-2xs dark:bg-accent/15 dark:border-accent/30 dark:text-accent">
                          Project Student
                        </span>
                        {studentDisplayName && (
                          <span className="text-xs font-bold text-foreground">
                            {studentDisplayName}
                          </span>
                        )}
                        <span className="text-xs text-muted font-mono">({studentId})</span>
                        <span className="text-xs text-muted">&middot; Cohort {projectStudent.academicYear}</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        Sciora ThesisLab: Automated Manuscript Vetting
                      </h3>
                      <p className="text-xs sm:text-sm text-muted">
                        {projectStudent.projectTopic ? (
                          <>
                            Assigned Topic:{" "}
                            <strong className="text-foreground">{projectStudent.projectTopic}</strong>
                          </>
                        ) : (
                          "Access automated departmental chapter audits, Golden Thread verification & supervisor critiques."
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[11px] uppercase tracking-wider text-muted font-semibold block">
                          Daily Quota
                        </span>
                        <span className="text-xs font-bold text-accent">
                          {projectStudent.remaining} of {projectStudent.limit} attempts left
                        </span>
                      </div>
                      <Button
                        variant="primary"
                        icon={ArrowRight}
                        onClick={() => setActiveTab("thesislab")}
                      >
                        Open ThesisLab
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVE ATTENDANCE BANNER */}
              {activeAttendanceSessions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border-2 border-accent/40 bg-accent-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-soft">
                      <Radio className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.2 text-[11px] font-bold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
                          Live Attendance Open
                        </span>
                        <span className="font-mono text-xs font-bold text-accent">
                          {activeAttendanceSessions.map((s) => s.courseCode).join(", ")}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {activeAttendanceSessions[0].title}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={ArrowRight}
                    onClick={() => router.push(`/attendance?session=${activeAttendanceSessions[0].id}`)}
                  >
                    Check In Now
                  </Button>
                </motion.div>
              )}

              <div className="flex items-center gap-2 text-muted-strong">
                <LayoutGrid className="h-5 w-5 text-accent" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Select a Course</h2>
              </div>

              {loadError ? (
                <ErrorState
                  description={loadError}
                  onRetry={() => {
                    setLoading(true);
                    setLoadError(null);
                    setRetryKey((k) => k + 1);
                  }}
                />
              ) : loading ? (
                <SkeletonList count={3}>
                  <CourseSkeleton />
                </SkeletonList>
              ) : courses.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No courses yet"
                  description="Your lecturer hasn't published any courses. Check back after your next class."
                />
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course, idx) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      index={idx}
                      onSelect={() => setSelectedCourseId(course.id)}
                      badges={
                        <>
                          <CourseBadge tone="accent">
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            {course.materials.length}{" "}
                            {course.materials.length === 1 ? "Material" : "Materials"}
                          </CourseBadge>
                          {(course.activeTests && course.activeTests.length > 0) ? (
                            <CourseBadge tone="success" dot>
                              {course.activeTests.length} Test{course.activeTests.length > 1 ? "s" : ""} available
                            </CourseBadge>
                          ) : (course.activeTest && (
                            <CourseBadge tone="success" dot>
                              Test available
                            </CourseBadge>
                          ))}
                          {activeAttendanceSessions.some((s) => s.courseId === course.id) && (
                            <CourseBadge tone="accent" dot>
                              Attendance Live
                            </CourseBadge>
                          )}
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            /* COURSE DETAILS VIEW */
            <motion.div key="course-details" {...viewMotion} className="space-y-8">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
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
              </div>

              {/* COURSE SPECIFIC ATTENDANCE BANNER */}
              {activeAttendanceSessions
                .filter((s) => s.courseId === selectedCourse?.id)
                .map((sess) => (
                  <motion.div
                    key={sess.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border-2 border-accent/40 bg-accent-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-soft">
                        <Radio className="h-5 w-5 animate-pulse" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-bold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
                          Live Lecture Attendance
                        </span>
                        <h3 className="text-base font-bold text-foreground mt-0.5">{sess.title}</h3>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={ArrowRight}
                      onClick={() => router.push(`/attendance?session=${sess.id}`)}
                    >
                      Check In Now
                    </Button>
                  </motion.div>
                ))}

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Notes Section */}
                <div className="space-y-4 lg:col-span-2">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-muted-strong">
                    <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
                    Lecture Materials
                  </h3>
                  <div className="space-y-3">
                    {selectedCourse?.materials.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No materials uploaded"
                        description="Documents for this course will appear here as soon as they're published."
                      />
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {selectedCourse?.materials.map((note, idx) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ delay: idx * 0.08, duration: 0.5, ease: EXPO }}
                            className="glass flex items-center justify-between rounded-2xl p-5"
                          >
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                                <FileText className="h-5 w-5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="truncate font-medium text-foreground">
                                  {note.title}
                                </h4>
                                <p className="mt-0.5 text-xs tabular-nums text-muted">
                                  Added {note.date} · {note.size}
                                </p>
                              </div>
                            </div>
                            <IconButton
                              icon={Download}
                              variant="subtle"
                              label={`Download ${note.title}`}
                              loading={downloadingId === note.id}
                              onClick={() => handleDownload(note)}
                              className="ml-3"
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </div>

                {/* Active Tests Section */}
                <div className="space-y-4">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-muted-strong">
                    <Play className="h-5 w-5 text-accent" aria-hidden="true" />
                    Active Tests
                  </h3>
                  {(() => {
                    const validTests = Array.from(new Map(
                      [...(selectedCourse?.activeTest ? [selectedCourse.activeTest] : []), ...(selectedCourse?.activeTests || [])].map(t => [t.id, t])
                    ).values()).filter((test: Record<string, unknown>) => !test.expiresAt || Date.now() < (test.expiresAt as number));
                    
                    if (validTests.length === 0) {
                      return (
                        <EmptyState
                          icon={CheckCircle2}
                          title="No active test"
                          description="You're all caught up. New assessments show up here."
                        />
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {validTests.map((test: Record<string, any>) => (
                          <motion.div
                            key={test.id}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.5, ease: EXPO }}
                            className="card-outer"
                          >
                            <div className="card-inner bg-accent/5 p-5 dark:bg-accent/10">
                              <div className="mb-3 flex items-start gap-2">
                                <span
                                  className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-success"
                                  aria-hidden="true"
                                />
                                <h4 className="text-base font-semibold leading-snug text-foreground">
                                  {test.title}
                                </h4>
                              </div>
                              <div className="mb-5 flex gap-3 text-xs font-medium tabular-nums text-muted-strong items-center flex-wrap">
                                <span>
                                  {test.questions} Questions
                                </span>
                                <span aria-hidden="true">&middot;</span>
                                <span>{test.duration}</span>
                                {test.isPracticeMode && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                                      Practice Mode
                                    </span>
                                  </>
                                )}
                                {test.expiresAt && (
                                  <>
                                    <span aria-hidden="true">&middot;</span>
                                    <TestExpiryCountdown expiresAt={test.expiresAt} />
                                  </>
                                )}
                              </div>
                              
                              {selectedCourse && completedTests.has(`${selectedCourse.id}_${test.title}`) ? (
                                <div className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-edge bg-black/5 font-semibold text-muted dark:bg-white/10">
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  Test Completed
                                </div>
                              ) : test.validFrom && Date.now() < (test.validFrom as number) ? (
                                <TestStartCountdown validFrom={test.validFrom as number}>
                                  <Button
                                    icon={Play}
                                    onClick={() =>
                                      selectedCourse && router.push(
                                        `/test?courseId=${selectedCourse.id}&testId=${test.id}&testTitle=${encodeURIComponent(
                                          test.title,
                                        )}`,
                                      )
                                    }
                                    aria-label={`Start test: ${test.title}`}
                                    className="w-full"
                                  >
                                    Start Test
                                  </Button>
                                </TestStartCountdown>
                              ) : (
                                <Button
                                  icon={Play}
                                  onClick={() =>
                                    selectedCourse && router.push(
                                      `/test?courseId=${selectedCourse.id}&testId=${test.id}&testTitle=${encodeURIComponent(
                                        test.title,
                                      )}`,
                                    )
                                  }
                                  aria-label={`Start test: ${test.title}`}
                                  className="w-full"
                                >
                                  Start Test
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}




