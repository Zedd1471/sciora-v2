"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  Search,
  Download,
  Trash2,
  UserPlus,
  CheckCircle2,
  Play,
  StopCircle,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button, IconButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import {
  exportAttendanceToCsv,
  normalizeStudentId,
  validateStudentIdFormat,
  type AttendanceSession,
  type AttendanceRecord,
} from "@/lib/attendance";

interface AttendanceRosterModalProps {
  session: AttendanceSession;
  isOpen: boolean;
  onClose: () => void;
  onOpenProjector?: () => void;
}

export function AttendanceRosterModal({
  session,
  isOpen,
  onClose,
  onOpenProjector,
}: AttendanceRosterModalProps) {
  const toast = useToast();
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentStatus, setCurrentStatus] = useState<"active" | "ended">(session.status);

  // Manual Add state
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualStudentName, setManualStudentName] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Subscribe to attendees
  useEffect(() => {
    if (!isOpen || !session.id) return;
    setCurrentStatus(session.status);

    const q = query(
      collection(db, "attendance_records"),
      where("sessionId", "==", session.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as AttendanceRecord[];
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAttendees(records);
      },
      (err) => console.error("Error reading attendance records:", err)
    );

    return () => unsubscribe();
  }, [isOpen, session.id, session.status]);

  const filteredAttendees = useMemo(() => {
    if (!searchQuery.trim()) return attendees;
    const q = searchQuery.toLowerCase().trim();
    return attendees.filter(
      (a) =>
        a.studentId.toLowerCase().includes(q) ||
        (a.studentName && a.studentName.toLowerCase().includes(q))
    );
  }, [attendees, searchQuery]);

  // Toggle Session status
  const toggleStatus = async () => {
    const nextStatus = currentStatus === "active" ? "ended" : "active";
    try {
      await updateDoc(doc(db, "attendance_sessions", session.id), {
        status: nextStatus,
        endedAt: nextStatus === "ended" ? new Date().toISOString() : null,
      });
      setCurrentStatus(nextStatus);
      toast({
        kind: "success",
        title: nextStatus === "active" ? "Session Resumed" : "Session Closed",
      });
    } catch (err) {
      console.error("Error changing session status:", err);
      toast({ kind: "error", title: "Failed to update session status" });
    }
  };

  // Remove attendee
  const handleDeleteAttendee = async (recordId: string, studentId: string) => {
    try {
      await deleteDoc(doc(db, "attendance_records", recordId));
      await updateDoc(doc(db, "attendance_sessions", session.id), {
        attendeeCount: increment(-1),
      });
      toast({ kind: "success", title: `Removed ${studentId}` });
    } catch (err) {
      console.error("Error removing attendee:", err);
      toast({ kind: "error", title: "Could not remove attendee" });
    }
  };

  // Manual Add
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeStudentId(manualStudentId);
    if (!validateStudentIdFormat(normalized)) {
      toast({ kind: "error", title: "Invalid Student ID format" });
      return;
    }

    setIsSavingManual(true);
    try {
      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          studentId: normalized,
          studentName: manualStudentName.trim() || undefined,
          method: "manual",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add student.");
      }

      if (data.record) {
        setAttendees((prev) => [data.record, ...prev.filter((r) => r.id !== data.record.id)]);
      }
      toast({ kind: "success", title: `Added ${normalized}` });
      setManualStudentId("");
      setManualStudentName("");
      setIsManualAddOpen(false);
    } catch (err) {
      console.error("Error adding student manually:", err);
      toast({ kind: "error", title: "Failed to add student" });
    } finally {
      setIsSavingManual(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="card-outer w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        <div className="card-inner flex flex-col p-6 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-edge/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase text-accent">
                  {session.courseCode}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    currentStatus === "active"
                      ? "bg-success/10 text-success border border-success/30"
                      : "bg-black/10 dark:bg-white/10 text-muted border border-edge"
                  }`}
                >
                  {currentStatus === "active" ? "Active" : "Closed"}
                </span>
                <span className="text-xs text-muted">
                  {new Date(session.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground mt-1">{session.title}</h2>
            </div>

            <div className="flex items-center gap-2">
              {currentStatus === "active" && onOpenProjector && (
                <Button variant="primary" size="sm" icon={Play} onClick={onOpenProjector}>
                  Open Projector
                </Button>
              )}
              <Button
                variant="glass"
                size="sm"
                icon={Download}
                onClick={() => exportAttendanceToCsv(session, attendees)}
              >
                Export CSV
              </Button>
              <IconButton icon={X} variant="subtle" label="Close roster" onClick={onClose} />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field w-full pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-accent bg-accent-soft px-3 py-1.5 rounded-xl">
                {attendees.length} Present
              </span>

              <Button
                variant="subtle"
                size="sm"
                icon={UserPlus}
                onClick={() => setIsManualAddOpen(true)}
              >
                Manual Add
              </Button>

              <Button
                variant="subtle"
                size="sm"
                icon={currentStatus === "active" ? StopCircle : Play}
                onClick={toggleStatus}
              >
                {currentStatus === "active" ? "Close Session" : "Reopen"}
              </Button>
            </div>
          </div>

          {/* Attendees Table / List */}
          <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-edge bg-background">
            {filteredAttendees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
                <Users className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {searchQuery ? "No matching students" : "No attendance recorded yet"}
                </p>
                <p className="text-xs text-muted max-w-xs mt-1">
                  Students who scan the QR code will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-accent/5 dark:bg-accent/10 shadow-sm backdrop-blur-md text-xs font-semibold uppercase text-muted-strong border-b border-edge">
                  <tr>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filteredAttendees.map((attendee) => (
                    <tr key={attendee.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {attendee.studentId}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {attendee.studentName || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted tabular-nums">
                        {new Date(attendee.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-black/5 dark:bg-white/10 px-2 py-0.5 text-xs text-muted">
                          {attendee.method === "short_code"
                            ? "6-Digit Code"
                            : attendee.method === "manual"
                            ? "Manual"
                            : "QR Scan"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <IconButton
                          icon={Trash2}
                          variant="subtle"
                          label={`Remove ${attendee.studentId}`}
                          onClick={() => handleDeleteAttendee(attendee.id, attendee.studentId)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 flex justify-end">
            <Button variant="subtle" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Manual Add Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-outer w-full max-w-md"
          >
            <div className="card-inner p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Add Student Manually</h3>
                <IconButton
                  icon={X}
                  variant="subtle"
                  label="Close manual add modal"
                  onClick={() => setIsManualAddOpen(false)}
                />
              </div>

              <form onSubmit={handleManualAdd} className="space-y-4">
                <Field
                  label="Student ID"
                  placeholder="e.g. BTH/19/0421"
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  style={{ textTransform: "uppercase", fontFamily: "monospace" }}
                  hint="Format: Faculty/Year/Number (e.g. BTH/19/0421)"
                  required
                />
                <Field
                  label="Student Name (Optional)"
                  placeholder="e.g. Jordan Smith"
                  value={manualStudentName}
                  onChange={(e) => setManualStudentName(e.target.value)}
                />

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="subtle"
                    onClick={() => setIsManualAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={isSavingManual}>
                    Record Attendance
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
