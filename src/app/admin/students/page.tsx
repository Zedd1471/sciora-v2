"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Edit3,
  BookOpen,
  User,
  UploadCloud,
  Check,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Student {
  student_id: string;
  academic_year: string;
  is_active: boolean;
  project_topic?: string;
  created_at?: string;
  name?: string;
}

interface Metrics {
  totalStudents: number;
  activeStudents: number;
  cohorts: string[];
  todaySubmissions: number;
}

export default function AdminStudentsPage() {
  const toast = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalStudents: 0,
    activeStudents: 0,
    cohorts: [],
    todaySubmissions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add / Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [importAcademicYear, setImportAcademicYear] = useState("2026/2027");

  // Single Add Form
  const [singleStudentId, setSingleStudentId] = useState("");
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentTopic, setSingleStudentTopic] = useState("");

  // Bulk Import Form
  const [importIdsText, setImportIdsText] = useState("");
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  // Student Edit Modal (Name & Topic)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [editTopicInput, setEditTopicInput] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirm Modal
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/students");
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
        setMetrics(data.metrics || { totalStudents: 0, activeStudents: 0, cohorts: [], todaySubmissions: 0 });
      } else {
        toast({
          kind: "danger",
          title: "Failed to load students",
          description: data.error || "Could not retrieve student list.",
        });
      }
    } catch {
      toast({
        kind: "danger",
        title: "Network error",
        description: "Failed to connect to the database.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleStudentAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentId.trim() || !importAcademicYear.trim()) {
      toast({
        kind: "danger",
        title: "Required Fields Missing",
        description: "Please specify both the Student ID and Academic Year.",
      });
      return;
    }

    setIsSubmittingStudent(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: importAcademicYear.trim(),
          students: [
            {
              studentId: singleStudentId.trim(),
              name: singleStudentName.trim() || undefined,
              topic: singleStudentTopic.trim() || undefined,
            },
          ],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          kind: "success",
          title: "Student Added",
          description: data.message || `Successfully registered ${singleStudentId.trim()}.`,
        });
        setIsImportModalOpen(false);
        setSingleStudentId("");
        setSingleStudentName("");
        setSingleStudentTopic("");
        fetchStudents();
      } else {
        toast({
          kind: "danger",
          title: "Failed to Add Student",
          description: data.error || "Could not save student.",
        });
      }
    } catch {
      toast({
        kind: "danger",
        title: "Network Error",
        description: "Request failed while adding student.",
      });
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importIdsText.trim() || !importAcademicYear.trim()) {
      toast({
        kind: "danger",
        title: "Required Fields Missing",
        description: "Please specify an academic year and student entries.",
      });
      return;
    }

    setIsSubmittingStudent(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: importIdsText,
          academicYear: importAcademicYear.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          kind: "success",
          title: "Import Successful",
          description: data.message,
        });
        setIsImportModalOpen(false);
        setImportIdsText("");
        fetchStudents();
      } else {
        toast({
          kind: "danger",
          title: "Import Failed",
          description: data.error || "Could not save students.",
        });
      }
    } catch {
      toast({
        kind: "danger",
        title: "Network Error",
        description: "Request failed during bulk import.",
      });
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setEditNameInput(student.name || "");
    setEditTopicInput(student.project_topic || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: editingStudent.student_id,
          name: editNameInput.trim(),
          topic: editTopicInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          kind: "success",
          title: "Student Details Saved",
          description: `Updated details for ${editingStudent.student_id}.`,
        });
        setEditingStudent(null);
        fetchStudents();
      } else {
        toast({
          kind: "danger",
          title: "Save Failed",
          description: data.error || "Could not save student details.",
        });
      }
    } catch {
      toast({
        kind: "danger",
        title: "Network Error",
        description: "Failed to update student details.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleStudent = async (studentId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, is_active: newStatus } : s))
    );

    try {
      const res = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          isActive: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.student_id === studentId ? { ...s, is_active: currentStatus } : s))
        );
        toast({
          kind: "danger",
          title: "Update Failed",
          description: data.error || "Failed to update student status.",
        });
      } else {
        toast({
          kind: "success",
          title: "Status Updated",
          description: `${studentId} is now ${newStatus ? "Active" : "Inactive"}.`,
        });
        fetchStudents();
      }
    } catch {
      setStudents((prev) =>
        prev.map((s) => (s.student_id === studentId ? { ...s, is_active: currentStatus } : s))
      );
    }
  };

  const handleToggleCohort = async (academicYear: string, targetActive: boolean) => {
    try {
      const res = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear,
          isActive: targetActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          kind: "success",
          title: "Cohort Updated",
          description: data.message,
        });
        fetchStudents();
      } else {
        toast({
          kind: "danger",
          title: "Cohort Update Failed",
          description: data.error,
        });
      }
    } catch {
      toast({
        kind: "danger",
        title: "Network Error",
        description: "Could not update cohort.",
      });
    }
  };

  const handleDeleteStudent = async () => {
    if (!deletingStudentId) return;

    try {
      const res = await fetch(
        `/api/admin/students?studentId=${encodeURIComponent(deletingStudentId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        toast({
          kind: "success",
          title: "Student Deleted",
          description: data.message,
        });
        setDeletingStudentId(null);
        fetchStudents();
      } else {
        toast({
          kind: "danger",
          title: "Delete Failed",
          description: data.error,
        });
      }
    } catch {
      toast({
        kind: "danger",
        title: "Network Error",
        description: "Could not remove student.",
      });
    }
  };

  // Filter students by ID, name, or topic
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      s.student_id.toLowerCase().includes(q) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.project_topic && s.project_topic.toLowerCase().includes(q));
    const matchesCohort = cohortFilter === "all" || s.academic_year === cohortFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && s.is_active) ||
      (statusFilter === "inactive" && !s.is_active);
    return matchesSearch && matchesCohort && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-edge pb-6">
          <div className="space-y-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to Admin Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-white/95 shadow-sm border border-black/5 dark:border-white/10 p-1.5 flex items-center justify-center shrink-0">
                <Image
                  src="/ThesisLab.png"
                  alt="ThesisLab Icon"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                ThesisLab Directory
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="glass"
              size="sm"
              icon={UploadCloud}
              onClick={() => {
                setAddMode("bulk");
                setIsImportModalOpen(true);
              }}
            >
              Bulk Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={() => {
                setAddMode("single");
                setIsImportModalOpen(true);
              }}
            >
              Add Student
            </Button>
          </div>
        </header>

        {/* Audit Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card-outer">
            <div className="card-inner p-4 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Total Students
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {metrics.totalStudents}
              </div>
              <div className="text-[11px] text-muted">Registered in directory</div>
            </div>
          </div>

          <div className="card-outer">
            <div className="card-inner p-4 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Active Students
              </div>
              <div className="text-2xl font-bold font-mono text-success">
                {metrics.activeStudents}
              </div>
              <div className="text-[11px] text-muted">Permitted to submit drafts</div>
            </div>
          </div>

          <div className="card-outer">
            <div className="card-inner p-4 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Assigned Topics
              </div>
              <div className="text-2xl font-bold font-mono text-accent">
                {students.filter((s) => s.project_topic).length}
              </div>
              <div className="text-[11px] text-muted">Approved research titles</div>
            </div>
          </div>

          <div className="card-outer">
            <div className="card-inner p-4 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Today&apos;s Audits
              </div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {metrics.todaySubmissions}
              </div>
              <div className="text-[11px] text-muted">Reviews conducted today</div>
            </div>
          </div>
        </div>

        {/* Cohort Quick Action Card */}
        {metrics.cohorts.length > 0 && (
          <div className="card-outer">
            <div className="card-inner p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  Cohort Batch Controls
                </h3>
                <p className="text-xs text-muted">
                  Instantly toggle all students in an academic year to deactivate past graduating classes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {metrics.cohorts.map((cohort) => {
                  const cohortStudents = students.filter((s) => s.academic_year === cohort);
                  const activeInCohort = cohortStudents.filter((s) => s.is_active).length;
                  const allActive = activeInCohort === cohortStudents.length && cohortStudents.length > 0;

                  return (
                    <div
                      key={cohort}
                      className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-edge flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-sm">{cohort}</div>
                        <div className="text-xs text-muted">
                          {activeInCohort} of {cohortStudents.length} active
                        </div>
                      </div>

                      <Button
                        variant={allActive ? "danger" : "subtle"}
                        size="sm"
                        onClick={() => handleToggleCohort(cohort, !allActive)}
                      >
                        {allActive ? "Deactivate All" : "Activate All"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by ID, Student Name, or Topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-edge text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="rounded-xl bg-black/5 dark:bg-white/5 border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Cohorts</option>
              {metrics.cohorts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl bg-black/5 dark:bg-white/5 border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <Button
              variant="glass"
              size="sm"
              icon={RefreshCw}
              iconOnly
              onClick={fetchStudents}
              aria-label="Refresh list"
            />
          </div>
        </div>

        {/* Students Table */}
        <div className="card-outer overflow-hidden">
          <div className="card-inner overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center text-sm text-muted">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading student records from Firestore...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Users className="w-10 h-10 text-muted mx-auto" />
                <div className="text-sm font-semibold">No Students Found</div>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {students.length === 0
                    ? "Your directory is currently empty. Click 'Add Student' or 'Bulk Import' to populate your student list."
                    : "No students matched your search criteria."}
                </p>
                {students.length === 0 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={UserPlus}
                      onClick={() => {
                        setAddMode("single");
                        setIsImportModalOpen(true);
                      }}
                    >
                      Add Student
                    </Button>
                    <Button
                      variant="glass"
                      size="sm"
                      icon={UploadCloud}
                      onClick={() => {
                        setAddMode("bulk");
                        setIsImportModalOpen(true);
                      }}
                    >
                      Bulk Import List
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-edge text-xs font-semibold uppercase tracking-wider text-muted bg-black/5 dark:bg-white/5">
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Approved Research Topic</th>
                    <th className="py-3 px-4">Access Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.student_id}
                      className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                        {student.student_id}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {student.name ? (
                          <div
                            onClick={() => handleOpenEdit(student)}
                            className="cursor-pointer group flex items-center gap-1.5"
                            title="Click to edit name"
                          >
                            <span className="font-semibold text-foreground group-hover:text-accent transition-colors">
                              {student.name}
                            </span>
                            <Edit3 className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(student)}
                            className="text-xs text-muted hover:text-accent flex items-center gap-1 font-medium transition-colors"
                          >
                            <User className="w-3 h-3" />
                            + Add Name
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted whitespace-nowrap">
                        {student.academic_year}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        {student.project_topic ? (
                          <div
                            onClick={() => handleOpenEdit(student)}
                            className="cursor-pointer group flex items-start gap-1.5"
                            title="Click to edit topic"
                          >
                            <span className="text-foreground group-hover:text-accent transition-colors line-clamp-2">
                              {student.project_topic}
                            </span>
                            <Edit3 className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(student)}
                            className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
                          >
                            <BookOpen className="w-3 h-3" />
                            + Assign Topic
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStudent(student.student_id, student.is_active)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                            student.is_active
                              ? "bg-success/15 text-success border border-success/30 hover:bg-success/25"
                              : "bg-black/10 dark:bg-white/10 text-muted border border-edge hover:bg-black/15"
                          }`}
                        >
                          {student.is_active ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Active (Allowed)
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              Deactivated
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="glass"
                            size="sm"
                            iconOnly
                            icon={Edit3}
                            onClick={() => handleOpenEdit(student)}
                            aria-label={`Edit details for ${student.student_id}`}
                            title="Edit Name & Research Topic"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            iconOnly
                            icon={Trash2}
                            onClick={() => setDeletingStudentId(student.student_id)}
                            aria-label={`Delete ${student.student_id}`}
                            title="Delete Student"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add / Import Modal */}
      <Modal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={addMode === "single" ? "Add Project Student" : "Bulk Import Student Directory"}
      >
        <div className="space-y-4">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-edge">
            <button
              type="button"
              onClick={() => setAddMode("single")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                addMode === "single"
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Quick Add Student
            </button>
            <button
              type="button"
              onClick={() => setAddMode("bulk")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                addMode === "bulk"
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Bulk Import List
            </button>
          </div>

          {addMode === "single" ? (
            /* Single Student Form */
            <form onSubmit={handleSingleStudentAdd} className="space-y-4">
              <Field
                label="Academic Year Cohort"
                placeholder="e.g. 2026/2027"
                value={importAcademicYear}
                onChange={(e) => setImportAcademicYear(e.target.value)}
                hint="Graduating session cohort."
                required
              />

              <Field
                label="Student ID (Matriculation No.)"
                placeholder="e.g. BTH/22U/1234 or MCB/2022/1001"
                value={singleStudentId}
                onChange={(e) => setSingleStudentId(e.target.value.toUpperCase())}
                hint="Unique institutional matriculation number."
                required
              />

              <Field
                label="Student Full Name (Optional)"
                placeholder="e.g. Amara Okafor"
                value={singleStudentName}
                onChange={(e) => setSingleStudentName(e.target.value)}
                hint="Optional: Included in student workspace and exported DOCX/PDF reports."
              />

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-strong">
                  Approved Research Project Topic (Optional)
                </label>
                <textarea
                  rows={3}
                  value={singleStudentTopic}
                  onChange={(e) => setSingleStudentTopic(e.target.value)}
                  placeholder="e.g. Comparative In Vitro Evaluation of Antibacterial Potency of Moringa oleifera Extracts..."
                  className="w-full rounded-xl bg-black/5 dark:bg-white/5 border border-edge p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-[11px] text-muted mt-1">
                  Pre-fills the student&apos;s vetting submission and aligns departmental critique.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge">
                <Button variant="glass" size="sm" onClick={() => setIsImportModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSubmittingStudent}
                  icon={UserPlus}
                >
                  Save Student
                </Button>
              </div>
            </form>
          ) : (
            /* Bulk Import Form */
            <form onSubmit={handleBulkImport} className="space-y-4">
              <Field
                label="Academic Year Cohort"
                placeholder="e.g. 2026/2027"
                value={importAcademicYear}
                onChange={(e) => setImportAcademicYear(e.target.value)}
                hint="Tag all imported students with their academic graduating session."
                required
              />

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-strong">
                  Student Entries (One per line)
                </label>
                <textarea
                  rows={8}
                  required
                  value={importIdsText}
                  onChange={(e) => setImportIdsText(e.target.value)}
                  placeholder={`BTH/22U/1001 - Amara Okafor - Phytochemical analysis of Vernonia amygdalina\nBTH/22U/1002 - Chidi Eze - Antibacterial evaluation of Ocimum gratissimum\nBTH/22U/1003 - Isolation of Biosurfactant-Producing Bacteria\nBTH/22U/1004`}
                  className="w-full rounded-xl bg-black/5 dark:bg-white/5 border border-edge p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="text-[11px] text-muted space-y-1 mt-2 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-edge">
                  <p className="font-semibold text-foreground">Flexible input formats per line:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted">
                    <li>
                      <code>ID - Name - Topic</code> (e.g. <code>BTH/22U/1001 - Amara Okafor - Phytochemical analysis...</code>)
                    </li>
                    <li>
                      <strong>Direct Excel / Sheets paste:</strong> Copy columns directly (<code>ID [Tab] Name [Tab] Topic</code>)
                    </li>
                    <li>
                      <code>ID - Topic</code> or <code>ID</code> alone (name and topic can be updated anytime)
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge">
                <Button variant="glass" size="sm" onClick={() => setIsImportModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSubmittingStudent}
                  icon={Check}
                >
                  Confirm Bulk Import
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Edit Student Modal (Name & Topic) */}
      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={`Edit Student: ${editingStudent?.student_id}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Field
            label="Student Full Name"
            placeholder="e.g. Amara Okafor"
            value={editNameInput}
            onChange={(e) => setEditNameInput(e.target.value)}
            hint="Display name for project vetting and exported audit reports."
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-strong">
              Approved Research Project Topic
            </label>
            <textarea
              rows={4}
              value={editTopicInput}
              onChange={(e) => setEditTopicInput(e.target.value)}
              placeholder="e.g. Comparative In Vitro Evaluation of Antibacterial Potency of Moringa oleifera Extracts..."
              className="w-full rounded-xl bg-black/5 dark:bg-white/5 border border-edge p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-[11px] text-muted mt-1">
              This topic will be visible in the ThesisLab student directory and automatically pre-fills the student&apos;s vetting submission.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge">
            <Button variant="glass" size="sm" onClick={() => setEditingStudent(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSavingEdit}
              icon={BookOpen}
            >
              Save Details
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingStudentId}
        onClose={() => setDeletingStudentId(null)}
        title="Remove Student Authorization?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-danger/10 border border-danger/25 text-danger text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Confirm Removal</p>
              <p className="text-xs text-danger/90 mt-0.5">
                Are you sure you want to delete student{" "}
                <strong className="font-mono">{deletingStudentId}</strong>? They will no longer be able to submit project drafts to ThesisLab.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="glass" size="sm" onClick={() => setDeletingStudentId(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteStudent}>
              Delete Student
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
