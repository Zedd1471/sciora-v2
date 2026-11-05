"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lightbulb,
  XCircle,
  BookOpen,
} from "lucide-react";
import { addDoc, collection, serverTimestamp, doc, getDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/Button";
import { EXPO } from "@/lib/motion";
import { useToast } from "@/components/ui/Toast";
import { useLocalStorage } from "@/lib/useLocalStorage";

type Question = { id: string | number; text: string; options: string[]; correct: string };

// Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function TestLoading() {
  return (
    <div
      className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6"
      role="status"
    >
      <div className="glass flex items-center gap-3 rounded-2xl px-6 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
        <span className="text-sm font-medium text-muted">Loading your test…</span>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={<TestLoading />}>
      <TestEngine />
    </Suspense>
  );
}

function TestEngine() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId") || "unknown";
  const testId = searchParams.get("testId");
  const testTitle = searchParams.get("testTitle") || "Mid-Term Assessment";
  const studentId = useLocalStorage("sciora_student_id") ?? "";

  // Test State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string | number, string>>({});
  const [timeLeft, setTimeLeft] = useState(60 * 15); // 15 mins
  const [rawQuestions, setRawQuestions] = useState<Question[]>([]);
  const [isFetchingTest, setIsFetchingTest] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [targetTest, setTargetTest] = useState<any>(null);

  // Fetch test data from Firebase
  useEffect(() => {
    if (courseId === "unknown") {
      setFetchError("Invalid course ID.");
      setIsFetchingTest(false);
      return;
    }
    
    getDoc(doc(db, "courses", courseId))
      .then(async (docSnap) => {
        if (docSnap.exists()) {
          const courseData = docSnap.data();
          const fetchedTargetTest = (courseData.activeTests || []).find((t: any) => t.id === testId) || courseData.activeTest;
          setTargetTest(fetchedTargetTest);

          if (fetchedTargetTest && fetchedTargetTest.testData) {
            if (fetchedTargetTest.maxTakes && !fetchedTargetTest.isPracticeMode) {
              const gradesQ = query(
                collection(db, "grades"),
                where("courseId", "==", courseId),
                where("testTitle", "==", fetchedTargetTest.title)
              );
              const gradesSnap = await getDocs(gradesQ);
              if (gradesSnap.size >= fetchedTargetTest.maxTakes) {
                setFetchError("This test has reached the maximum number of submissions and is no longer available.");
                setIsFetchingTest(false);
                return;
              }
            }

            setRawQuestions(fetchedTargetTest.testData);
            if (fetchedTargetTest.duration) {
              if (String(fetchedTargetTest.duration).includes(':')) {
                const parts = String(fetchedTargetTest.duration).split(':');
                if (parts.length === 2) {
                  const hours = parseInt(parts[0], 10) || 0;
                  const minutes = parseInt(parts[1], 10) || 0;
                  setTimeLeft(hours * 3600 + minutes * 60);
                } else if (parts.length === 3) {
                  const hours = parseInt(parts[0], 10) || 0;
                  const minutes = parseInt(parts[1], 10) || 0;
                  const seconds = parseInt(parts[2], 10) || 0;
                  setTimeLeft(hours * 3600 + minutes * 60 + seconds);
                }
              } else {
                const durationMatch = String(fetchedTargetTest.duration).match(/[\d\.]+/);
                if (durationMatch) {
                  const minutes = parseFloat(durationMatch[0]);
                  if (!isNaN(minutes)) setTimeLeft(Math.floor(minutes * 60));
                }
              }
            }
            
            if (fetchedTargetTest.poolSize) {
              const ps = parseInt(fetchedTargetTest.poolSize, 10);
              if (!isNaN(ps)) setPoolSize(ps);
            }

            if (fetchedTargetTest.expiresAt && Date.now() > fetchedTargetTest.expiresAt) {
              setFetchError("This test has expired and is no longer available.");
              return;
            }
            if (fetchedTargetTest.validFrom && Date.now() < fetchedTargetTest.validFrom) {
              setFetchError("This test is not yet available.");
              return;
            }

          } else {
            setFetchError("Test not found for this course.");
          }
        } else {
          setFetchError("Course not found.");
        }
      })
      .catch((err) => {
        console.error("Error fetching test:", err);
        setFetchError("Failed to fetch test data.");
      })
      .finally(() => setIsFetchingTest(false));
  }, [courseId]);

  // App State
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [violation, setViolation] = useState(false);
  const [lockout, setLockout] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const submitLock = useRef(false);

  // Practice Mode AI Explanations State
  const [explanations, setExplanations] = useState<
    Record<
      string | number,
      {
        explanation: string;
        misconception?: string | null;
        takeaway?: string | null;
        provider?: string;
      }
    >
  >({});
  const [loadingExplanationId, setLoadingExplanationId] = useState<string | number | null>(null);
  const [revealedPracticeAnswers, setRevealedPracticeAnswers] = useState<Record<string | number, boolean>>({});
  const [practiceFilter, setPracticeFilter] = useState<"all" | "incorrect">("all");

  const handleFetchExplanation = async (q: Question) => {
    if (explanations[q.id] || loadingExplanationId === q.id) return;
    setLoadingExplanationId(q.id);
    try {
      const res = await fetch("/api/explain-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: q.text,
          options: q.options,
          correctAnswer: q.correct,
          studentAnswer: answers[q.id] || "",
          courseCode: courseId,
          courseTitle: testTitle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExplanations((prev) => ({ ...prev, [q.id]: data }));
      } else {
        toast({
          kind: "error",
          title: "Explanation unavailable",
          description: "Could not load AI explanation at this time.",
        });
      }
    } catch (err) {
      console.error("Failed to fetch explanation:", err);
    } finally {
      setLoadingExplanationId(null);
    }
  };

  // Guard: no student session → send back to login
  useEffect(() => {
    if (studentId !== null && !studentId) router.push("/login");
  }, [studentId, router]);

  // Tab lockout & Database retake check
  useEffect(() => {
    if (!testId || !courseId || !studentId || !targetTest) return;

    if (targetTest.isPracticeMode) return; // Bypass retake check for practice mode


    // 1. Multiple tabs lock
    const tabLockKey = `sciora_tab_lock_${testId}`;
    if (localStorage.getItem(tabLockKey) === "locked") {
      setFetchError("This test is already open in another tab. Close the other tab to continue.");
      return;
    }
    localStorage.setItem(tabLockKey, "locked");

    const cleanupLock = () => localStorage.removeItem(tabLockKey);
    window.addEventListener("beforeunload", cleanupLock);

    // 2. Database Retake check (Strict No Retakes)
    const checkRetake = async () => {
      try {
        const q = query(
          collection(db, "grades"),
          where("studentId", "==", studentId),
          where("courseId", "==", courseId),
          where("testTitle", "==", testTitle)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Find the most recent completion
          const attempts = snap.docs.map(d => d.data().completedAt?.toMillis() || 0);
          const lastAttempt = Math.max(...attempts);
          
          let isBlocked = false;
          let blockReason = "";

          if (targetTest.cooldown) {
            // Parse HH:MM
            const parts = String(targetTest.cooldown).split(':');
            let cooldownMs = 0;
            if (parts.length === 2) {
              const hours = parseInt(parts[0], 10) || 0;
              const minutes = parseInt(parts[1], 10) || 0;
              cooldownMs = (hours * 60 * 60 + minutes * 60) * 1000;
            } else if (parts.length === 3) {
              const hours = parseInt(parts[0], 10) || 0;
              const minutes = parseInt(parts[1], 10) || 0;
              const seconds = parseInt(parts[2], 10) || 0;
              cooldownMs = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
            } else {
              // Fallback for old numeric minute cooldowns
              cooldownMs = (parseFloat(targetTest.cooldown) || 0) * 60 * 1000;
            }

            if (Date.now() - lastAttempt < cooldownMs) {
              isBlocked = true;
              blockReason = "cooldown";
              setFetchError("You must wait before retaking this test.");
            }
          } else {
            // If no cooldown is specified, strict no retakes
            isBlocked = true;
            blockReason = "strict";
            setFetchError("You have already taken this test. Retakes are not allowed.");
          }

          if (isBlocked) {
            setLockout(true);
            // Log the blocked attempt
            try {
              await addDoc(collection(db, "test_blocks"), {
                studentId,
                courseId,
                testTitle,
                reason: blockReason,
                timestamp: serverTimestamp()
              });
            } catch (e) {
              console.error("Failed to log test block", e);
            }
          }
        }
      } catch (err) {
        console.error("Error checking retakes:", err);
      }
    };
    
    checkRetake();

    return () => {
      cleanupLock();
      window.removeEventListener("beforeunload", cleanupLock);
    };
  }, [testId, courseId, studentId, testTitle, targetTest]);

  const startTest = () => {
    if (rawQuestions.length === 0) return;
    const count = poolSize ? Math.min(poolSize, rawQuestions.length) : rawQuestions.length;
    const randomizedQuestions = shuffleArray(rawQuestions).slice(0, count).map((q) => ({
      ...q,
      options: shuffleArray(q.options),
    }));
    setQuestions(randomizedQuestions);
    setCurrentQuestionIndex(0);
    setHasStarted(true);
  };

  const submitTest = useCallback(() => {
    if (isFinished || submitLock.current) return;
    submitLock.current = true;

    let calculatedScore = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct) calculatedScore++;
    });
    setScore(calculatedScore);
    setIsFinished(true);

    if (targetTest?.isPracticeMode) {
      setSaveState("saved"); // don't actually save
      return;
    }

    if (studentId) {
      setSaveState("saving");
      
      const expireDate = new Date();
      expireDate.setMonth(expireDate.getMonth() + 3);

      addDoc(collection(db, "grades"), {
        studentId,
        courseId,
        testTitle,
        score: calculatedScore,
        totalQuestions: questions.length,
        responses: answers,
        completedAt: serverTimestamp(),
        expiresAt: expireDate,
      })
        .then(() => setSaveState("saved"))
        .catch((err) => {
          console.error("Error saving grade:", err);
          setSaveState("failed");
          toast({
            kind: "error",
            title: "Score not saved",
            description: "Your result is shown below but wasn't recorded. Check your connection and contact your lecturer.",
          });
        });
    }
  }, [isFinished, questions, answers, studentId, courseId, testTitle, toast, targetTest]);

  // Timer logic
  useEffect(() => {
    if (hasStarted && !isFinished && timeLeft > 0) {
      const timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            submitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => window.clearInterval(timer);
    }
  }, [hasStarted, isFinished, timeLeft, submitTest]);

  // Anti-cheat (Blur / Visibility)
  useEffect(() => {
    if (!hasStarted || isFinished) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolation(true);
        submitTest();
      }
    };

    const handleBlur = () => {
      setViolation(true);
      submitTest();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [hasStarted, isFinished, submitTest]);

  const handleOptionSelect = (questionId: string | number, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  if (lockout) {
    return (
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div className="glass w-full max-w-md rounded-3xl p-8">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-danger" aria-hidden="true" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">Retake Blocked</h2>
          <p className="text-muted">
            {fetchError || "You have already submitted this test. Retakes are strictly prohibited or you are on cooldown."}
          </p>
          <Button variant="subtle" onClick={() => router.push("/notes")} className="mt-6 w-full">
            Return to Classroom
          </Button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EXPO }}
          className={`glass w-full rounded-3xl p-8 ${targetTest?.isPracticeMode ? "max-w-2xl" : "max-w-md"}`}
          role="status"
        >
          {violation ? (
            <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-danger" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-success" aria-hidden="true" />
          )}

          <h2 className="mb-2 text-3xl font-bold text-foreground">
            {violation ? "Test Terminated" : "Test Completed"}
          </h2>

          {violation && (
            <p className="mb-6 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              Your test was automatically submitted because you left the browser tab.
            </p>
          )}

          <div className="mb-8 rounded-xl border border-edge bg-black/5 p-6 dark:bg-white/5">
            <p className="mb-1 text-sm uppercase tracking-wider text-muted">Your Score</p>
            <p className="text-5xl font-black text-foreground tabular-nums">
              {score}{" "}
              <span className="text-2xl font-bold text-muted">/ {questions.length}</span>
            </p>
            <p className="mt-3 text-sm text-muted" role="status">
              {targetTest?.isPracticeMode ? (
                "Practice score - not recorded."
              ) : (
                <>
                  {saveState === "saving" && "Saving your result…"}
                  {saveState === "saved" && "Result saved to your profile."}
                  {saveState === "failed" && "Couldn't save your result."}
                </>
              )}
            </p>
          </div>

          {targetTest?.isPracticeMode && (
            <div className="mb-8 text-left space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-edge pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-accent" />
                  <h3 className="text-lg font-bold text-foreground">
                    Practice Review & AI Explanations
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-edge text-xs">
                  <button
                    type="button"
                    onClick={() => setPracticeFilter("all")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      practiceFilter === "all"
                        ? "bg-accent text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPracticeFilter("incorrect")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      practiceFilter === "incorrect"
                        ? "bg-accent text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Incorrect ({questions.filter((q) => answers[q.id] !== q.correct).length})
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
                {(practiceFilter === "incorrect"
                  ? questions.filter((q) => answers[q.id] !== q.correct)
                  : questions
                ).map((q, idx) => {
                  const isCorrect = answers[q.id] === q.correct;
                  const explanation = explanations[q.id];
                  const isLoadingThis = loadingExplanationId === q.id;

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl border border-edge bg-black/5 dark:bg-white/5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          <span className="text-accent mr-1.5">
                            {questions.indexOf(q) + 1}.
                          </span>
                          {q.text}
                        </p>
                        <span
                          className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            isCorrect
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-danger/15 text-danger border border-danger/30"
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Correct
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" /> Incorrect
                            </>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isCorrect
                              ? "bg-success/5 border-success/30 text-success"
                              : "bg-danger/5 border-danger/30 text-danger"
                          }`}
                        >
                          <span className="font-bold block mb-0.5 uppercase tracking-wider text-[10px] opacity-75">
                            Your Selection
                          </span>
                          {answers[q.id] || "No Answer"}
                        </div>

                        {!isCorrect && (
                          <div className="p-2.5 rounded-xl border bg-success/5 border-success/30 text-success">
                            <span className="font-bold block mb-0.5 uppercase tracking-wider text-[10px] opacity-75">
                              Correct Key
                            </span>
                            {q.correct}
                          </div>
                        )}
                      </div>

                      {/* AI Explanation Area */}
                      {explanation ? (
                        <div className="mt-3 p-3.5 rounded-xl border border-accent/25 bg-accent-soft/10 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-accent font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Lightbulb className="h-4 w-4" />
                              Pedagogical Explanation
                            </span>
                            <span className="text-[10px] text-muted">
                              AI Tutor
                            </span>
                          </div>

                          <p className="text-foreground leading-relaxed">
                            {explanation.explanation}
                          </p>

                          {explanation.misconception && (
                            <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-edge text-muted-strong">
                              <strong className="text-foreground block mb-0.5">
                                Misconception:
                              </strong>
                              {explanation.misconception}
                            </div>
                          )}

                          {explanation.takeaway && (
                            <div className="text-[11px] font-medium text-accent">
                              <strong>Key Takeaway:</strong> {explanation.takeaway}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleFetchExplanation(q)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                          >
                            {isLoadingThis ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Generating AI explanation…
                              </>
                            ) : (
                              <>
                                <Lightbulb className="h-3.5 w-3.5" />
                                Explain Why with AI
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button variant="subtle" onClick={() => router.push("/notes")} className="w-full max-w-sm mx-auto">
            Return to Classroom
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!hasStarted) {
    if (isFetchingTest) {
      return <TestLoading />;
    }
    
    if (fetchError) {
      return (
        <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6 text-center">
          <div className="glass w-full max-w-lg rounded-3xl p-8">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-danger" aria-hidden="true" />
            <h2 className="mb-2 text-xl font-bold text-foreground">Test Unavailable</h2>
            <p className="text-muted">{fetchError}</p>
            <Button variant="subtle" onClick={() => router.push("/notes")} className="mt-6 w-full">
              Return to Classroom
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: EXPO }}
          className="glass w-full max-w-lg rounded-3xl p-8"
        >
          {targetTest?.isPracticeMode && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-warning">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Practice Mode
            </div>
          )}
          <h1 className="mb-4 text-3xl font-bold text-foreground">{testTitle}</h1>
          <ul className="mb-8 space-y-3 rounded-xl border border-edge bg-black/5 p-6 text-left text-sm text-muted-strong dark:bg-white/5">
            <li className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent" aria-hidden="true" /> {Math.floor(timeLeft / 60) > 0 ? `${Math.floor(timeLeft / 60)} min` : ''} {timeLeft % 60 > 0 ? `${timeLeft % 60} sec` : ''}
            </li>
            <li className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" /> Leaving the
              tab auto-submits your answers
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" /> Questions
              and options are randomized
            </li>
          </ul>
          <Button size="lg" onClick={startTest} className="w-full" disabled={rawQuestions.length === 0}>
            Begin Test
          </Button>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="relative z-10 flex min-h-[100dvh] flex-col p-4 md:p-6">
      {/* Top Bar */}
      <header className="glass sticky top-2 z-50 mx-auto flex w-full max-w-3xl items-center justify-between rounded-2xl p-3 md:p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 truncate font-mono text-sm text-accent">{studentId}</div>
          {targetTest?.isPracticeMode && (
            <div className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
              Practice
            </div>
          )}
        </div>
        <div
          className="flex items-center gap-3 font-mono text-xl text-foreground tabular-nums"
          aria-label={`Time remaining: ${formatTime(timeLeft)}`}
        >
          <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="mx-auto mt-4 w-full max-w-3xl">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
          <span>
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span>
            {answeredCount} of {questions.length} answered
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
          aria-label="Test progress"
        >
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{
              width: `${(answeredCount / questions.length) * 100}%`,
            }}
            transition={{ duration: 0.4, ease: EXPO }}
          />
        </div>
      </div>

      {/* Single Question View */}
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-grow flex-col justify-center py-4"
      >
        {currentQuestion && (
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: EXPO }}
            className="glass rounded-3xl p-5 md:p-6"
          >
            <fieldset>
              <legend className="mb-4 w-full text-lg md:text-xl leading-relaxed text-foreground">
                <span className="mr-3 font-bold text-accent" aria-hidden="true">
                  {currentQuestionIndex + 1}.
                </span>
                <span className="sr-only">Question {currentQuestionIndex + 1}: </span>
                {currentQuestion.text}
              </legend>

              <div className="space-y-2 md:space-y-3" role="radiogroup">
                {currentQuestion.options.map((opt: string, optIndex: number) => {
                  const qId = currentQuestion.id;
                  const isSelected = answers[qId] === opt;

                  return (
                    <label
                      key={optIndex}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 md:p-4 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                        isSelected
                          ? "scale-[1.02] border-accent bg-accent/10"
                          : "border-edge bg-black/5 transition-all dark:bg-white/5"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${qId}`}
                        value={opt}
                        checked={isSelected}
                        onChange={() => handleOptionSelect(qId, opt)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected ? "border-accent" : "border-muted"
                        }`}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId={`dot-${qId}`}
                            className="h-2.5 w-2.5 rounded-full bg-accent"
                          />
                        )}
                      </span>
                      <span
                        className={`text-base ${
                          isSelected ? "font-medium text-foreground" : "text-muted-strong"
                        }`}
                      >
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Practice Mode Instant Explanation Accordion */}
            {targetTest?.isPracticeMode && (
              <div className="mt-6 pt-4 border-t border-edge space-y-3">
                {!revealedPracticeAnswers[currentQuestion.id] ? (
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    icon={Lightbulb}
                    disabled={!answers[currentQuestion.id]}
                    onClick={() => {
                      setRevealedPracticeAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: true,
                      }));
                      handleFetchExplanation(currentQuestion);
                    }}
                  >
                    Check & Explain Answer
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-accent/25 bg-accent-soft/10 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          answers[currentQuestion.id] === currentQuestion.correct
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-danger/15 text-danger border border-danger/30"
                        }`}
                      >
                        {answers[currentQuestion.id] === currentQuestion.correct ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Correct!
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" /> Incorrect — Key: {currentQuestion.correct}
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                        Practice Feedback
                      </span>
                    </div>

                    {explanations[currentQuestion.id] ? (
                      <div className="space-y-2 pt-1 text-xs">
                        <p className="text-foreground leading-relaxed">
                          {explanations[currentQuestion.id].explanation}
                        </p>
                        {explanations[currentQuestion.id].misconception && (
                          <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-edge text-muted-strong">
                            <strong className="text-foreground block mb-0.5">Misconception:</strong>
                            {explanations[currentQuestion.id].misconception}
                          </div>
                        )}
                        {explanations[currentQuestion.id].takeaway && (
                          <div className="text-[11px] font-medium text-accent">
                            <strong>Key Takeaway:</strong> {explanations[currentQuestion.id].takeaway}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                        <span>Generating AI explanation…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button
                variant="subtle"
                icon={ChevronLeft}
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>

              {isLastQuestion ? (
                <Button icon={CheckCircle2} onClick={submitTest}>
                  Submit Test
                </Button>
              ) : (
                <Button
                  icon={ChevronRight}
                  onClick={() =>
                    setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))
                  }
                >
                  Next
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
