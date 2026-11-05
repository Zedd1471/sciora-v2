"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Award,
  FileText,
  Calendar,
  Percent,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/Button";
import { PageHeader, BackButton } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { EXPO } from "@/lib/motion";
import { useLocalStorage } from "@/lib/useLocalStorage";

type Grade = {
  id: string;
  courseId: string;
  testTitle: string;
  score: number;
  totalQuestions: number;
  completedAt: { seconds: number; nanoseconds: number } | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const studentId = useLocalStorage("sciora_student_id");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [courseMap, setCourseMap] = useState<Record<string, string>>({});
  const [projectStudent, setProjectStudent] = useState<{
    name?: string;
    studentName?: string;
    academicYear?: string;
    projectTopic?: string;
    usedToday?: number;
    remaining?: number;
    limit?: number;
  } | null>(null);

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

  useEffect(() => {
    if (!studentId) return;

    let isSubscribed = true;
    fetch(`/api/vet-project/quota?studentId=${encodeURIComponent(studentId.trim().toUpperCase())}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed && data.valid && data.isActive !== false) {
            setProjectStudent(data);
          }
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;

    const q = query(collection(db, "grades"), where("studentId", "==", studentId));
    const unsubscribeGrades = onSnapshot(
      q,
      (snapshot) => {
        const gradesData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Grade),
        );
        gradesData.sort((a, b) => {
          if (!a.completedAt) return 1;
          if (!b.completedAt) return -1;
          return b.completedAt.seconds - a.completedAt.seconds;
        });
        setGrades(gradesData);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      },
    );

    const unsubscribeCourses = onSnapshot(collection(db, "courses"), (snapshot) => {
      const map: Record<string, string> = {};
      snapshot.forEach(doc => {
        map[doc.id] = doc.data().code || doc.id;
      });
      setCourseMap(map);
    });

    return () => {
      unsubscribeGrades();
      unsubscribeCourses();
    };
  }, [studentId, retryKey]);

  if (!studentId) return null;

  const totalTests = grades.length;
  const totalScore = grades.reduce((acc, g) => acc + g.score, 0);
  const totalQuestions = grades.reduce((acc, g) => acc + g.totalQuestions, 0);
  const averagePercentage =
    totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  const displayName = projectStudent?.name || projectStudent?.studentName;

  return (
    <div className="relative z-10 min-h-[100dvh] p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          icon={User}
          eyebrow="Student Profile"
          title={
            projectStudent ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-bold text-foreground">
                  {displayName || studentId}
                </span>
                {displayName && (
                  <span className="font-mono text-base font-normal text-muted tabular-nums">
                    ({studentId})
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-white border border-accent/25 text-accent shadow-2xs dark:bg-accent/15 dark:border-accent/30 dark:text-accent">
                  Project Student
                </span>
              </div>
            ) : (
              studentId
            )
          }
          leading={<BackButton label="Back to Classroom" onClick={() => router.push("/notes")} />}
          actions={
            <div className="flex items-center gap-3">
              {projectStudent?.academicYear && (
                <span className="hidden sm:inline-flex items-center rounded-full border border-edge bg-black/5 px-3 py-1 text-xs font-medium text-muted dark:bg-white/5">
                  Cohort: {projectStudent.academicYear}
                </span>
              )}
              <span className="text-sm text-muted">{totalTests} tests recorded</span>
            </div>
          }
        />

        {/* Project Student Spotlight Card */}
        {projectStudent && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EXPO }}
            className="mb-8 overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 via-background to-accent/5 p-6 md:p-8 backdrop-blur-md relative"
          >
            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-accent text-xs font-bold uppercase tracking-wider text-white shadow-xs">
                    Authorized ThesisLab Student
                  </span>
                  <span className="rounded-full border border-edge bg-black/5 px-2.5 py-0.5 text-xs font-semibold text-muted dark:bg-white/10">
                    Session {projectStudent.academicYear}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Assigned Research Topic
                  </h3>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    &ldquo;{projectStudent.projectTopic || "Topic Assigned by Supervisor"}&rdquo;
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    <span>Daily Vetting Quota:</span>
                    <span className="font-bold text-foreground">
                      {projectStudent.remaining ?? 3} / {projectStudent.limit ?? 3} left today
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-accent" />
                    <span>Reviews Today:</span>
                    <span className="font-bold text-foreground">{projectStudent.usedToday ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <Button
                  variant="primary"
                  icon={ArrowRight}
                  onClick={() => router.push("/notes?tab=thesislab")}
                  className="font-semibold shadow-card hover:shadow-float"
                >
                  ThesisLab Vetting Desk
                </Button>
              </div>
            </div>

            {/* Background watermark */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -right-10 opacity-10"
            >
              <GraduationCap className="h-44 w-44 text-accent" />
            </div>
          </motion.div>
        )}

        {/* Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EXPO }}
          className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div className="glass relative flex items-center gap-5 overflow-hidden rounded-3xl p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Award className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-muted">Overall Average</p>
              <h2 className="text-3xl font-bold text-foreground">
                {loading ? "—" : `${averagePercentage}%`}
              </h2>
            </div>
            <div
              aria-hidden="true"
              className="absolute -bottom-5 -right-5 opacity-5"
            >
              <Percent className="h-32 w-32 text-accent" />
            </div>
          </div>

          <div className="glass flex items-center gap-5 rounded-3xl p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
              <FileText className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-muted">Tests Completed</p>
              <h2 className="text-3xl font-bold text-foreground">
                {loading ? "—" : totalTests}
              </h2>
            </div>
          </div>
        </motion.div>

        {/* Historical Grades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: EXPO }}
        >
          <h2 className="mb-6 text-xl font-bold text-foreground">
            Historical Grades
          </h2>

          {loading ? (
            <SkeletonList count={3}>
              <div className="glass flex items-center gap-4 rounded-2xl p-5">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            </SkeletonList>
          ) : loadError ? (
            <ErrorState
              title="Grades couldn't be loaded"
              onRetry={() => {
                setLoading(true);
                setLoadError(false);
                setRetryKey((k) => k + 1);
              }}
            />
          ) : grades.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No tests completed yet"
              description="Once you complete an active test, your score and date show up here."
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {grades.map((grade, idx) => {
                  const percentage = Math.round(
                    (grade.score / grade.totalQuestions) * 100,
                  );
                  const isPassing = percentage >= 60;

                  return (
                    <motion.div
                      key={grade.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05, duration: 0.4, ease: EXPO }}
                      className="glass flex flex-col justify-between gap-4 rounded-2xl p-5 transition-colors md:flex-row md:items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                            isPassing
                              ? "bg-success/10 text-success"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          <span className="font-bold tabular-nums">{percentage}%</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-foreground">
                            {grade.testTitle}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-medium text-muted">
                            <span className="rounded-md bg-black/5 px-2 py-0.5 uppercase tracking-wider dark:bg-white/10">
                              {courseMap[grade.courseId] || grade.courseId}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                              {grade.completedAt
                                ? new Date(
                                    grade.completedAt.seconds * 1000,
                                  ).toLocaleDateString()
                                : "Just now"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-edge bg-black/5 px-4 py-2 text-sm font-medium dark:bg-white/5">
                        <span className="text-muted-strong">Score:</span>
                        <span className="text-base text-foreground">
                          {grade.score}{" "}
                          <span className="text-sm text-muted">
                            / {grade.totalQuestions}
                          </span>
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
