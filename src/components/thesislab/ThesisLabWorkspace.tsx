"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  Layers,
  FileCode,
  Clock,
  History,
  FileDown,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { SPRING_DEFAULT } from "@/lib/motion";
import { exportAuditToDocx, exportAuditToPdf } from "@/lib/vetting/export";
import type { VettingReviewRecord } from "@/lib/vetting/db";

export interface QuotaData {
  valid: boolean;
  studentId: string;
  name?: string;
  studentName?: string;
  academicYear: string;
  projectTopic?: string;
  isActive: boolean;
  usedToday: number;
  remaining: number;
  limit: number;
}

export interface VettingResult {
  id?: string;
  review: string;
  verdict: string;
  remaining: number;
  usedToday: number;
  fileName: string;
  projectTitle: string;
  studentName?: string;
  createdAt?: string;
  trialNumber?: number;
}

const PROGRESS_STEPS = [
  "Uploading and extracting document...",
  "Auditing document mode (Proposal vs. Completed Project)...",
  "Checking Golden Thread alignment across chapters...",
  "Scanning tense violations & departmental typography...",
  "Cross-referencing living ledger of peculiar student flaws...",
  "Synthesizing supervisor critique & feedback memo...",
];

export interface ThesisLabWorkspaceProps {
  initialStudentId?: string;
  onBackToClassroom?: () => void;
  isEmbeddedInClassroom?: boolean;
}

export function ThesisLabWorkspace({
  initialStudentId,
  onBackToClassroom,
  isEmbeddedInClassroom = false,
}: ThesisLabWorkspaceProps) {
  const toast = useToast();

  // Authentication & Quota
  const [studentIdInput, setStudentIdInput] = useState(initialStudentId || "");
  const [verifiedStudent, setVerifiedStudent] = useState<QuotaData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form State
  const [projectTitle, setProjectTitle] = useState("");
  const [documentMode, setDocumentMode] = useState<"auto" | "proposal" | "completed">("auto");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [useTextInput, setUseTextInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission State
  const [isVetting, setIsVetting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [vettingResult, setVettingResult] = useState<VettingResult | null>(null);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Review Trials History State
  const [trialHistory, setTrialHistory] = useState<VettingReviewRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [showHistorySection, setShowHistorySection] = useState(true);

  // Export State
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Check saved session on mount or use initialStudentId
  useEffect(() => {
    const candidateId =
      initialStudentId ||
      localStorage.getItem("sciora_thesislab_student_id") ||
      localStorage.getItem("sciora_student_id");

    if (candidateId) {
      verifyStudent(candidateId);
    }
  }, [initialStudentId]);

  // Step progress animation timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVetting) {
      setCurrentStepIndex(0);
      interval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isVetting]);

  const fetchReviewHistory = async (id: string, autoSelectLatest = false) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/vet-project/history?studentId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok && data.reviews) {
        setTrialHistory(data.reviews);
        if (autoSelectLatest && data.reviews.length > 0) {
          const latest = data.reviews[0];
          setSelectedTrialId(latest.id || null);
          setVettingResult({
            id: latest.id,
            review: latest.review_markdown,
            verdict: latest.verdict || "Review Completed",
            remaining: 3, // Overridden by quota state
            usedToday: 0,
            fileName: latest.file_name || "Document Draft",
            projectTitle: latest.project_title || projectTitle,
            createdAt: latest.created_at as string,
            trialNumber: data.reviews.length,
          });
        }
      }
    } catch (err) {
      console.error("Error loading review history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const verifyStudent = async (idToVerify: string) => {
    const cleanId = idToVerify.trim().toUpperCase();
    if (!cleanId) return;

    setIsVerifying(true);
    setAuthError(null);

    try {
      const res = await fetch(`/api/vet-project/quota?studentId=${encodeURIComponent(cleanId)}`);
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Failed to authenticate student ID.");
        setVerifiedStudent(null);
        if (!isEmbeddedInClassroom) {
          localStorage.removeItem("sciora_thesislab_student_id");
        }
        return;
      }

      setVerifiedStudent(data);
      localStorage.setItem("sciora_thesislab_student_id", cleanId);
      setStudentIdInput(cleanId);

      // Pre-fill topic if assigned by supervisor
      if (data.projectTopic) {
        setProjectTitle(data.projectTopic);
      }

      // Load previous trial history
      fetchReviewHistory(cleanId, true);
    } catch {
      setAuthError("Network error while connecting to quota server.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyStudent(studentIdInput);
  };

  const handleLogout = () => {
    localStorage.removeItem("sciora_thesislab_student_id");
    setVerifiedStudent(null);
    setStudentIdInput("");
    setProjectTitle("");
    setVettingResult(null);
    setTrialHistory([]);
    setSelectedTrialId(null);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase();
    if (!ext.endsWith(".docx") && !ext.endsWith(".pdf") && !ext.endsWith(".txt")) {
      toast({
        kind: "danger",
        title: "Unsupported File",
        description: "Please upload a .docx or .pdf document.",
      });
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmitVetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStudent) return;

    if (!projectTitle.trim()) {
      toast({
        kind: "danger",
        title: "Missing Project Title",
        description: "Please enter your research project topic/title.",
      });
      return;
    }

    if (!useTextInput && !file) {
      toast({
        kind: "danger",
        title: "No Document Uploaded",
        description: "Please upload your .docx or .pdf draft before submitting.",
      });
      return;
    }

    if (useTextInput && pastedText.trim().length < 50) {
      toast({
        kind: "danger",
        title: "Text Too Short",
        description: "Please provide substantive chapter content to audit.",
      });
      return;
    }

    setIsVetting(true);
    setVettingResult(null);

    const formData = new FormData();
    formData.append("studentId", verifiedStudent.studentId);
    formData.append("projectTitle", projectTitle.trim());
    formData.append("documentMode", documentMode);
    if (file) {
      formData.append("file", file);
    }
    if (useTextInput && pastedText) {
      formData.append("pastedText", pastedText);
    }

    try {
      const res = await fetch("/api/vet-project", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          toast({
            kind: "danger",
            title: "Quota Exceeded (429)",
            description: data.error || "Daily limit of 3 submissions reached.",
          });
          setVerifiedStudent((prev) => (prev ? { ...prev, remaining: 0, usedToday: 3 } : null));
        } else {
          const isApiKeyMissing = data.error?.includes("GEMINI_API_KEY");
          toast({
            kind: "danger",
            title: isApiKeyMissing ? "Gemini API Key Required" : "Audit Failed",
            description: data.error || "An error occurred during project vetting.",
          });
        }
        return;
      }

      const newTrialNum = trialHistory.length + 1;
      const newResult: VettingResult = {
        id: data.reviewId,
        review: data.review,
        verdict: data.verdict,
        remaining: data.remaining,
        usedToday: data.usedToday,
        fileName: data.fileName || file?.name || "Text Draft",
        projectTitle: data.projectTitle || projectTitle,
        createdAt: data.createdAt || new Date().toISOString(),
        trialNumber: newTrialNum,
      };

      setVettingResult(newResult);
      setSelectedTrialId(data.reviewId || null);

      setVerifiedStudent((prev) =>
        prev
          ? {
              ...prev,
              remaining: data.remaining,
              usedToday: data.usedToday,
            }
          : null
      );

      // Refresh trial history to include the new one
      fetchReviewHistory(verifiedStudent.studentId, false);

      toast({
        kind: "success",
        title: "Vetting Completed",
        description: `Trial #${newTrialNum} supervisor review generated. ${data.remaining} attempt(s) remaining today.`,
      });

      // Scroll to report
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      toast({
        kind: "danger",
        title: "Connection Error",
        description: "Failed to communicate with the vetting engine. Please try again.",
      });
    } finally {
      setIsVetting(false);
    }
  };

  const handleSelectTrial = (review: VettingReviewRecord, trialNum: number) => {
    setSelectedTrialId(review.id || null);
    setVettingResult({
      id: review.id,
      review: review.review_markdown,
      verdict: review.verdict || "Review Completed",
      remaining: verifiedStudent?.remaining ?? 0,
      usedToday: verifiedStudent?.usedToday ?? 0,
      fileName: review.file_name || "Document Draft",
      projectTitle: review.project_title || projectTitle,
      createdAt: review.created_at as string,
      trialNumber: trialNum,
    });
    setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleDownloadDocx = async (targetReview?: VettingReviewRecord, trialNum?: number) => {
    if (!verifiedStudent) return;
    setIsExportingDocx(true);
    try {
      const isTarget = !!targetReview;
      const reviewText = isTarget ? targetReview.review_markdown : vettingResult?.review;
      const verdict = isTarget
        ? targetReview.verdict || "Review Completed"
        : vettingResult?.verdict || "Review Completed";
      const title = isTarget
        ? targetReview.project_title || projectTitle
        : vettingResult?.projectTitle || projectTitle;
      const fileName = isTarget ? targetReview.file_name : vettingResult?.fileName;
      const date = isTarget
        ? (targetReview.created_at as string)
        : vettingResult?.createdAt || new Date().toISOString();
      const num = trialNum ?? (vettingResult?.trialNumber || 1);

      if (!reviewText) return;

      await exportAuditToDocx({
        studentId: verifiedStudent.studentId,
        studentName: verifiedStudent.name || verifiedStudent.studentName,
        projectTitle: title,
        verdict,
        reviewMarkdown: reviewText,
        createdAt: date,
        trialNumber: num,
        fileName,
        documentMode,
      });

      toast({
        kind: "success",
        title: "Word Document Downloaded",
        description: `Downloaded Trial #${num} audit report (.docx).`,
      });
    } catch (err) {
      console.error("Docx export error:", err);
      toast({
        kind: "danger",
        title: "Download Failed",
        description: "Could not generate Word document.",
      });
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadPdf = async (targetReview?: VettingReviewRecord, trialNum?: number) => {
    if (!verifiedStudent) return;
    setIsExportingPdf(true);
    try {
      const isTarget = !!targetReview;
      const reviewText = isTarget ? targetReview.review_markdown : vettingResult?.review;
      const verdict = isTarget
        ? targetReview.verdict || "Review Completed"
        : vettingResult?.verdict || "Review Completed";
      const title = isTarget
        ? targetReview.project_title || projectTitle
        : vettingResult?.projectTitle || projectTitle;
      const fileName = isTarget ? targetReview.file_name : vettingResult?.fileName;
      const date = isTarget
        ? (targetReview.created_at as string)
        : vettingResult?.createdAt || new Date().toISOString();
      const num = trialNum ?? (vettingResult?.trialNumber || 1);

      if (!reviewText) return;

      await exportAuditToPdf({
        studentId: verifiedStudent.studentId,
        studentName: verifiedStudent.name || verifiedStudent.studentName,
        projectTitle: title,
        verdict,
        reviewMarkdown: reviewText,
        createdAt: date,
        trialNumber: num,
        fileName,
        documentMode,
      });

      toast({
        kind: "success",
        title: "PDF Document Downloaded",
        description: `Downloaded Trial #${num} audit report (.pdf).`,
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({
        kind: "danger",
        title: "Download Failed",
        description: "Could not generate PDF document.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const copyMemoToClipboard = () => {
    if (!vettingResult) return;
    const memoMatch = vettingResult.review.match(
      /### 5\. SUPERVISOR EXECUTIVE MEMO[\s\S]*?> ([\s\S]*?)(?=\n\n|$)/
    );
    const memoText = memoMatch ? memoMatch[1] : vettingResult.review;

    navigator.clipboard.writeText(memoText);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
    toast({
      kind: "success",
      title: "Supervisor Memo Copied",
      description: "Directive memo copied to clipboard.",
    });
  };

  const copyFullReport = () => {
    if (!vettingResult) return;
    navigator.clipboard.writeText(vettingResult.review);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
    toast({
      kind: "success",
      title: "Full Report Copied",
      description: "Entire critique markdown copied to clipboard.",
    });
  };

  return (
    <div className="space-y-8">
      {/* Workspace Sub-Header / Navigation */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-edge pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-accent/25 text-accent shadow-2xs dark:bg-accent/15 dark:border-accent/30 dark:text-accent">
              Sciora ThesisLab
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Academic Project Vetting Assistant
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Strict NUC CCMAS compliance, tense audits, Golden Thread verification & departmental formatting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isEmbeddedInClassroom && onBackToClassroom && (
            <Button
              variant="subtle"
              size="sm"
              icon={ArrowLeft}
              onClick={onBackToClassroom}
              className="text-muted-strong"
            >
              Back to Courses
            </Button>
          )}

          {!isEmbeddedInClassroom && (
            <Link href="/notes">
              <Button variant="subtle" size="sm" icon={BookOpen}>
                Classroom
              </Button>
            </Link>
          )}

          {!isEmbeddedInClassroom && verifiedStudent && (
            <Button variant="glass" size="sm" icon={LogOut} onClick={handleLogout}>
              Exit
            </Button>
          )}
        </div>
      </header>

      {/* STEP 1: Student Verification Screen if not logged in */}
      {!verifiedStudent ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_DEFAULT}
          className="card-outer max-w-lg mx-auto"
        >
          <div className="card-inner p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mx-auto border border-accent/25">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Authorized Project Student Access</h2>
              <p className="text-xs text-muted">
                Enter your matriculation / student ID to access the automated supervisor vetting desk.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <Field
                id="thesislab-student-id"
                label="Student ID (Matric No.)"
                placeholder="e.g. MCB/12A/3456"
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value.toUpperCase())}
                error={authError || undefined}
                hint="Access is restricted to active project students in registered cohorts."
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={isVerifying}
                icon={ArrowRight}
              >
                Verify ID & Open Workspace
              </Button>
            </form>

            <div className="rounded-xl p-3.5 bg-black/5 dark:bg-white/5 border border-edge text-xs space-y-1.5 text-muted">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="w-4 h-4 text-accent" />
                Fair Usage & Quota Policy
              </div>
              <p>
                Submissions are strictly capped at <strong>3 reviews per day</strong> per student to
                encourage deep revisions instead of repetitive automated prompting.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        /* STEP 2: Main ThesisLab Workspace */
        <div className="space-y-6">
          {/* Student ID & Daily Quota Card */}
          <div className="card-outer">
            <div className="card-inner p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-bold text-sm">
                  {verifiedStudent.studentId.substring(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm sm:text-base text-foreground">
                      {verifiedStudent.studentId}
                    </span>
                    {(verifiedStudent.name || verifiedStudent.studentName) && (
                      <span className="text-sm font-semibold text-foreground">
                        — {verifiedStudent.name || verifiedStudent.studentName}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/95 text-success border border-success/25 shadow-2xs dark:bg-success/15 dark:border-success/30 dark:text-success">
                      Cohort {verifiedStudent.academicYear}
                    </span>
                  </div>
                  {verifiedStudent.projectTopic ? (
                    <div className="text-xs text-accent font-medium line-clamp-1 mt-0.5">
                      Topic: {verifiedStudent.projectTopic}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Authorized 400-Level Project Student</p>
                  )}
                </div>
              </div>

              {/* Quota Indicator */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Daily Quota
                  </div>
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <span
                      className={`tabular-nums ${
                        verifiedStudent.remaining === 0
                          ? "text-danger"
                          : verifiedStudent.remaining === 1
                          ? "text-warning"
                          : "text-accent"
                      }`}
                    >
                      {verifiedStudent.remaining} of {verifiedStudent.limit} attempts left today
                    </span>
                  </div>
                </div>

                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => verifyStudent(verifiedStudent.studentId)}
                  title="Refresh Quota"
                  iconOnly
                  icon={RefreshCw}
                  aria-label="Refresh quota"
                />
              </div>
            </div>
          </div>

          {/* Quota Exhausted Banner */}
          {verifiedStudent.remaining === 0 && (
            <div className="rounded-2xl p-4 bg-danger/10 border border-danger/25 text-danger flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold">Daily Submissions Limit Reached (3 of 3 used)</h3>
                <p className="text-xs mt-1 text-danger/90">
                  You have used all 3 allowed project critiques for today. Carefully implement your
                  supervisor&apos;s feedback in your manuscript. Your quota will automatically refresh at midnight.
                </p>
              </div>
            </div>
          )}

          {/* Student Previous Trials History */}
          {trialHistory.length > 0 && (
            <div className="card-outer border-accent/25">
              <div className="card-inner p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold flex items-center gap-2">
                        Audit Trials History
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/25 font-semibold">
                          {trialHistory.length} {trialHistory.length === 1 ? "Trial" : "Trials"} Recorded
                        </span>
                      </h3>
                      <p className="text-xs text-muted">
                        Select any previous trial to view its full critique, or download reports as Word (.docx) and PDF.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => setShowHistorySection(!showHistorySection)}
                  >
                    {showHistorySection ? "Hide Trials" : `Show Trials (${trialHistory.length})`}
                  </Button>
                </div>

                {showHistorySection && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {trialHistory.map((trial, idx) => {
                      const trialNum = trialHistory.length - idx;
                      const isSelected =
                        selectedTrialId === trial.id ||
                        (!selectedTrialId && idx === 0 && !!vettingResult);
                      const dateStr = trial.created_at
                        ? new Date(trial.created_at as string).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A";

                      return (
                        <div
                          key={trial.id || idx}
                          onClick={() => handleSelectTrial(trial, trialNum)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                            isSelected
                              ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent/30"
                              : "border-edge bg-black/5 dark:bg-white/5 hover:border-accent/40"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-strong flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-accent" />
                                Trial #{trialNum}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  trial.verdict === "Ready for Submission"
                                    ? "bg-success/20 text-success border border-success/30"
                                    : trial.verdict === "Minor Revisions"
                                    ? "bg-accent-soft text-accent border border-accent/30"
                                    : trial.verdict === "Major Revisions"
                                    ? "bg-warning/20 text-warning border border-warning/30"
                                    : "bg-danger/20 text-danger border border-danger/30"
                                }`}
                              >
                                {trial.verdict || "Completed"}
                              </span>
                            </div>

                            <p
                              className="text-xs font-semibold text-foreground line-clamp-1"
                              title={trial.file_name}
                            >
                              {trial.file_name || "Manuscript Draft"}
                            </p>

                            <p className="text-[11px] text-muted flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted" />
                              {dateStr}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-edge/60 flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] font-semibold ${
                                isSelected ? "text-accent" : "text-muted hover:text-foreground"
                              }`}
                            >
                              {isSelected ? "Currently Viewing" : "Click to View"}
                            </span>

                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                title="Download Word (.docx)"
                                aria-label={`Download Word report for Trial ${trialNum}`}
                                onClick={() => handleDownloadDocx(trial, trialNum)}
                                className="p-1.5 rounded-lg border border-edge bg-white/40 dark:bg-black/20 hover:bg-accent/15 hover:border-accent/40 text-foreground transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5 text-accent" />
                              </button>
                              <button
                                type="button"
                                title="Download PDF (.pdf)"
                                aria-label={`Download PDF report for Trial ${trialNum}`}
                                onClick={() => handleDownloadPdf(trial, trialNum)}
                                className="p-1.5 rounded-lg border border-edge bg-white/40 dark:bg-black/20 hover:bg-accent/15 hover:border-accent/40 text-foreground transition-colors"
                              >
                                <FileDown className="w-3.5 h-3.5 text-danger" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submission Form */}
          <form onSubmit={handleSubmitVetting} className="card-outer">
            <div className="card-inner p-5 sm:p-7 space-y-6">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-accent" />
                  Submit Project Draft for Audit
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Upload your research proposal or final thesis draft. The system performs full document mode detection, tense auditing, and Golden Thread alignment.
                </p>
              </div>

              {/* Project Title Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="project-title-input"
                    className="block text-xs font-semibold uppercase tracking-wide text-muted-strong"
                  >
                    Project Topic / Title
                  </label>
                  {verifiedStudent.projectTopic && (
                    <span className="text-[11px] text-success font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Supervisor Assigned Topic
                    </span>
                  )}
                </div>
                <input
                  id="project-title-input"
                  type="text"
                  required
                  placeholder="e.g., Phytochemical and Antibacterial Profiling of Vernonia amygdalina on Multi-Drug Resistant Strains"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full rounded-xl bg-black/5 dark:bg-white/5 border border-edge px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-[11px] text-muted mt-1">
                  Rule: Departmental project titles must not exceed 20–22 words and must accurately reflect the overarching aim.
                </p>
              </div>

              {/* Document Mode Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-strong">
                  Document Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDocumentMode("auto")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      documentMode === "auto"
                        ? "bg-accent/15 border-accent text-foreground shadow-sm"
                        : "bg-black/5 dark:bg-white/5 border-edge text-muted hover:border-edge-strong"
                    }`}
                  >
                    <div className="font-semibold text-xs">Auto-Detect (Recommended)</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Automatically infers proposal vs. completed project.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocumentMode("proposal")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      documentMode === "proposal"
                        ? "bg-accent/15 border-accent text-foreground shadow-sm"
                        : "bg-black/5 dark:bg-white/5 border-edge text-muted hover:border-edge-strong"
                    }`}
                  >
                    <div className="font-semibold text-xs">Mode A: Research Proposal</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Chapters 1–3 strictly in Future Tense, Passive Voice.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocumentMode("completed")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      documentMode === "completed"
                        ? "bg-accent/15 border-accent text-foreground shadow-sm"
                        : "bg-black/5 dark:bg-white/5 border-edge text-muted hover:border-edge-strong"
                    }`}
                  >
                    <div className="font-semibold text-xs">Mode B: Completed Project</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Chapters 1–5 in Past Tense, flags leftover proposal verbs.
                    </div>
                  </button>
                </div>
              </div>

              {/* File Upload vs Text Toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
                    {useTextInput ? "Paste Manuscript Text" : "Upload Manuscript (.docx or .pdf)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseTextInput(!useTextInput)}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    {useTextInput ? "Switch to File Upload" : "Or paste raw text directly"}
                  </button>
                </div>

                {!useTextInput ? (
                  <div>
                    <input
                      type="file"
                      id="manuscript-file-input"
                      aria-label="Upload manuscript draft document (.docx, .pdf, .txt)"
                      ref={fileInputRef}
                      onChange={(e) =>
                        e.target.files?.[0] && handleFileSelection(e.target.files[0])
                      }
                      accept=".docx,.pdf,.txt"
                      className="hidden"
                    />

                    {!file ? (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                          isDragging
                            ? "border-accent bg-accent/10"
                            : "border-edge hover:border-accent/50 bg-black/5 dark:bg-white/5"
                        }`}
                      >
                        <UploadCloud className="w-10 h-10 text-muted mx-auto mb-2" />
                        <div className="text-sm font-semibold">
                          Drag & drop your draft here, or <span className="text-accent">browse file</span>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          Supports Microsoft Word (.docx) and PDF (.pdf). Maximum 25MB.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-accent-soft/40 border border-accent/25">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-8 h-8 text-accent shrink-0" />
                          <div className="truncate">
                            <div className="font-semibold text-sm truncate">{file.name}</div>
                            <div className="text-xs text-muted">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      id="manuscript-text-input"
                      aria-label="Paste chapter or full draft text"
                      rows={8}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your Chapter 1, Chapter 3, or full proposal/project text here..."
                      className="w-full rounded-xl bg-black/5 dark:bg-white/5 border border-edge p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <p className="text-[11px] text-muted mt-1">
                      Include chapter headings and section titles so the AI can verify organizational structure.
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-edge">
                <div className="text-xs text-muted">
                  Consumes <strong>1 of {verifiedStudent.remaining}</strong> available submission attempts for today.
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={verifiedStudent.remaining === 0 || isVetting}
                  loading={isVetting}
                  className="w-full sm:w-auto"
                >
                  {isVetting ? "Vetting..." : "Execute"}
                </Button>
              </div>
            </div>
          </form>

          {/* In-Progress Animated Stepper */}
          <AnimatePresence>
            {isVetting && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="card-outer"
              >
                <div className="card-inner p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm">Supervisor Evaluation in Progress</h4>
                      <p className="text-xs text-muted">
                        Running thorough academic cross-checks against departmental standards...
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    {PROGRESS_STEPS.map((step, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2.5 text-xs transition-colors ${
                          idx === currentStepIndex
                            ? "text-accent font-semibold"
                            : idx < currentStepIndex
                            ? "text-success opacity-90"
                            : "text-muted opacity-40"
                        }`}
                      >
                        {idx < currentStepIndex ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : idx === currentStepIndex ? (
                          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-muted/40" />
                        )}
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Presentation */}
          {vettingResult && (
            <motion.div
              ref={reportRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING_DEFAULT}
              className="space-y-6"
            >
              {/* Verdict Header Card */}
              <div className="card-outer border-accent/30">
                <div className="card-inner p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-muted">
                          Official Review Verdict
                        </span>
                        {vettingResult.trialNumber && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-soft text-accent border border-accent/25">
                            <Clock className="w-3 h-3" />
                            Trial #{vettingResult.trialNumber}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-lg text-sm font-bold ${
                            vettingResult.verdict === "Ready for Submission"
                              ? "bg-success/20 text-success border border-success/30"
                              : vettingResult.verdict === "Minor Revisions"
                              ? "bg-accent-soft text-accent border border-accent/30"
                              : vettingResult.verdict === "Major Revisions"
                              ? "bg-warning/20 text-warning border border-warning/30"
                              : "bg-danger/20 text-danger border border-danger/30"
                          }`}
                        >
                          {vettingResult.verdict}
                        </span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={FileText}
                        loading={isExportingDocx}
                        disabled={isExportingDocx || isExportingPdf}
                        onClick={() => handleDownloadDocx()}
                      >
                        Download Word (.docx)
                      </Button>
                      <Button
                        variant="glass"
                        size="sm"
                        icon={FileDown}
                        loading={isExportingPdf}
                        disabled={isExportingDocx || isExportingPdf}
                        onClick={() => handleDownloadPdf()}
                      >
                        Download PDF (.pdf)
                      </Button>
                      <Button
                        variant="glass"
                        size="sm"
                        icon={copiedMemo ? Check : Copy}
                        onClick={copyMemoToClipboard}
                      >
                        {copiedMemo ? "Memo Copied" : "Copy Supervisor Memo"}
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        icon={copiedFull ? Check : FileCode}
                        onClick={copyFullReport}
                      >
                        {copiedFull ? "Report Copied" : "Copy Full Report"}
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted flex flex-wrap gap-x-6 gap-y-1 pt-2 border-t border-edge">
                    <span>
                      <strong>Document:</strong> {vettingResult.fileName}
                    </span>
                    <span>
                      <strong>Topic:</strong> {vettingResult.projectTitle}
                    </span>
                    <span>
                      <strong>Attempts Remaining Today:</strong> {vettingResult.remaining} of 3
                    </span>
                  </div>
                </div>
              </div>

              {/* Formatted Markdown Content */}
              <div className="card-outer">
                <div className="card-inner p-6 sm:p-8">
                  <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 whitespace-pre-wrap leading-relaxed text-foreground font-sans">
                    {vettingResult.review}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
