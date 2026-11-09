"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Maximize2,
  Minimize2,
  Users,
  Search,
  Download,
  Trash2,
  UserPlus,
  Radio,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Wifi,
  Globe,
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

interface AttendanceProjectorModalProps {
  session: AttendanceSession;
  isOpen: boolean;
  onClose: () => void;
  onEndSession?: (sessionId: string) => Promise<void> | void;
}

export function AttendanceProjectorModal({
  session,
  isOpen,
  onClose,
  onEndSession,
}: AttendanceProjectorModalProps) {
  const toast = useToast();
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  // Manual Add Student Modal state
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualStudentName, setManualStudentName] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Origin for QR URL
  const [baseUrl, setBaseUrl] = useState("");
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // Detect local laptop Wi-Fi hotspot IP
  useEffect(() => {
    const detectNetwork = async () => {
      try {
        const res = await fetch("/api/attendance/offline/network");
        if (res.ok) {
          const data = await res.json();
          const ips = (data.interfaces || []).map((i: any) => i.address);
          setNetworkIps(ips);
          if (data.recommendedIp) {
            setSelectedIp(data.recommendedIp);
          }
        }
      } catch {
        // fallback
      }
    };
    detectNetwork();
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (modalContainerRef.current?.requestFullscreen) {
          await modalContainerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
  }, []);


  // Subscribe to live attendee records from Firestore
  useEffect(() => {
    if (!isOpen || !session.id) return;

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
      (error) => {
        console.error("Error subscribing to attendance records:", error);
      }
    );

    return () => unsubscribe();
  }, [isOpen, session.id]);

  // Filtered attendees for search
  const filteredAttendees = useMemo(() => {
    if (!searchQuery.trim()) return attendees;
    const q = searchQuery.toLowerCase().trim();
    return attendees.filter(
      (a) =>
        a.studentId.toLowerCase().includes(q) ||
        (a.studentName && a.studentName.toLowerCase().includes(q))
    );
  }, [attendees, searchQuery]);

  // Poll local offline records every 2s so board updates in real time without internet
  useEffect(() => {
    if (!isOpen || !session.id) return;

    let isMounted = true;
    const fetchLocalRecords = async () => {
      try {
        const res = await fetch(
          `/api/attendance/offline/records?sessionId=${encodeURIComponent(session.id)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.records) && data.records.length > 0) {
            setAttendees((prev) => {
              const map = new Map<string, AttendanceRecord>();
              prev.forEach((r) => map.set(r.id, r));
              data.records.forEach((r: AttendanceRecord) => map.set(r.id, r));
              const merged = Array.from(map.values());
              merged.sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              return merged;
            });
          }
        }
      } catch {
        // non-fatal
      }
    };

    fetchLocalRecords();
    const pollTimer = setInterval(fetchLocalRecords, 2000);
    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, [isOpen, session.id]);

  // QR Value: Stable URL for instant, reliable mobile scanning on the classroom hotspot
  const qrUrl = useMemo(() => {
    if (selectedIp && selectedIp !== "127.0.0.1" && selectedIp !== "localhost") {
      return `http://${selectedIp}:3000/attendance?session=${session.id}`;
    }
    if (!baseUrl) return "";
    return `${baseUrl}/attendance?session=${session.id}`;
  }, [baseUrl, session.id, selectedIp]);

  // Handle End Session
  const handleEnd = async () => {
    setIsEnding(true);
    try {
      if (onEndSession) {
        await onEndSession(session.id);
      } else {
        await updateDoc(doc(db, "attendance_sessions", session.id), {
          status: "ended",
          endedAt: new Date().toISOString(),
        });
      }
      toast({ kind: "success", title: "Attendance Session Ended" });
      onClose();
    } catch (err) {
      console.error("Error ending session:", err);
      toast({ kind: "error", title: "Failed to end session" });
    } finally {
      setIsEnding(false);
    }
  };

  // Handle Delete Attendee
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

  // Handle Manual Add Attendee
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

      toast({ kind: "success", title: `Checked in ${normalized}` });
      setManualStudentId("");
      setManualStudentName("");
      setIsManualAddOpen(false);
      if (data.record) {
        setAttendees((prev) => [data.record, ...prev.filter((r) => r.id !== data.record.id)]);
      }
    } catch (err) {
      console.error("Error adding student manually:", err);
      toast({ kind: "error", title: "Failed to manually add student" });
    } finally {
      setIsSavingManual(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl transition-all ${isFullscreen ? "p-4 md:p-8" : "p-3 md:p-6"
        }`}
    >
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-edge/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Radio className="h-5 w-5 animate-pulse text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                {session.courseCode}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
                Live Broadcast
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {session.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            icon={Download}
            onClick={() => exportAttendanceToCsv(session, attendees)}
            aria-label="Export Attendance to CSV"
          >
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          <Button
            variant="glass"
            icon={isFullscreen ? Minimize2 : Maximize2}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Projector Fullscreen"}
          >
            <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </Button>

          <Button
            variant="danger"
            onClick={handleEnd}
            loading={isEnding}
            aria-label="End Session"
          >
            End Session
          </Button>

          <IconButton
            icon={X}
            variant="subtle"
            label="Close broadcast modal"
            onClick={onClose}
          />
        </div>
      </header>

      {/* Main Grid: Left = Big QR + Dynamic Code, Right = Live Roster */}
      <div className="mt-4 grid flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-12">
        {/* Left: Projector Presentation Area (7 cols on desktop) */}
        <div className="flex flex-col items-center justify-center rounded-3xl border border-edge bg-card-bg/60 p-6 text-center shadow-soft backdrop-blur-md lg:col-span-7">
          {/* OFFLINE HOTSPOT BANNER & NETWORK SELECTOR */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-accent">
              <Wifi className="h-4 w-4" />
              Offline Hotspot Mode:
            </span>
            <span className="text-foreground">
              Students connect to Wi-Fi &rarr; Open:
            </span>
            {networkIps.length > 1 ? (
              <select
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                className="rounded-lg border border-edge bg-background px-2 py-1 font-mono text-xs font-bold text-accent cursor-pointer"
              >
                {networkIps.map((ip) => (
                  <option key={ip} value={ip}>
                    http://{ip}:3000 {ip === "192.168.137.1" ? "(Windows Hotspot)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-lg border border-edge bg-background px-2.5 py-1 font-mono font-bold text-accent">
                http://{selectedIp || "192.168.137.1"}:3000
              </span>
            )}
          </div>

          <div className="relative mb-6 flex flex-col items-center">
            {/* Ambient Glow */}
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 rounded-full bg-accent/20 blur-3xl opacity-75"
            />

            {/* QR Card */}
            <div className="rounded-3xl border-2 border-white/20 bg-white p-5 shadow-lift">
              {qrUrl ? (
                <QRCodeSVG
                  value={qrUrl}
                  size={isFullscreen ? 360 : 280}
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-muted">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Active Status Badge */}
            <div className="mt-4 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Attendance Session • Protected</span>
            </div>
          </div>

          {/* Connection Card for Students */}
          <div className="w-full max-w-md rounded-2xl border border-edge bg-black/5 dark:bg-white/5 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Scan with Phone Camera or Visit:
            </p>
            <div className="my-2.5 flex items-center justify-center gap-2">
              <span className="font-mono text-xl sm:text-2xl font-bold text-accent select-all">
                http://{selectedIp || "192.168.137.1"}:3000
              </span>
            </div>
            <p className="text-xs text-muted">
              Connect to the lecturer&apos;s Wi-Fi hotspot to record attendance.
            </p>
          </div>
        </div>

        {/* Right: Live Roster & Attendance Feed (5 cols on desktop) */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-edge bg-card-bg/40 p-5 backdrop-blur-md lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Live Check-ins</h2>
                <p className="text-xs font-medium text-muted">Real-time attendee list</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 font-mono text-sm font-bold text-accent">
                {attendees.length} Present
              </span>
              <Button
                variant="subtle"
                size="sm"
                icon={UserPlus}
                onClick={() => setIsManualAddOpen(true)}
                aria-label="Add Student Manually"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search student ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field w-full pl-9 text-xs"
            />
          </div>

          {/* Attendee Scroll List */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-edge/60 bg-black/5 dark:bg-white/[0.02] p-2 space-y-1.5">
            {filteredAttendees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-8 w-8 text-muted mb-2 animate-pulse" />
                <p className="text-sm font-medium text-foreground">
                  {searchQuery ? "No matches found" : "Waiting for students to scan..."}
                </p>
                <p className="text-xs text-muted max-w-xs mt-1">
                  Students will appear here instantly as soon as they scan the QR code.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredAttendees.map((attendee) => (
                  <motion.div
                    key={attendee.id}
                    layout
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center justify-between rounded-lg border border-edge/60 bg-white/40 dark:bg-white/5 px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="font-mono font-bold text-foreground">
                          {attendee.studentId}
                        </span>
                        {attendee.method === "short_code" && (
                          <span className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.2 text-[10px] text-muted">
                            Code
                          </span>
                        )}
                        {attendee.method === "manual" && (
                          <span className="rounded bg-accent/15 px-1 py-0.2 text-[10px] text-accent">
                            Manual
                          </span>
                        )}
                      </div>
                      {attendee.studentName && (
                        <p className="truncate text-xs text-muted">{attendee.studentName}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted tabular-nums">
                        {new Date(attendee.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <IconButton
                        icon={Trash2}
                        variant="subtle"
                        label={`Remove ${attendee.studentId}`}
                        onClick={() => handleDeleteAttendee(attendee.id, attendee.studentId)}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Manual Add Student Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
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
                  placeholder="e.g. Alex Johnson"
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
