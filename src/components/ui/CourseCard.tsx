"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { riseIn, SPRING_MICRO } from "@/lib/motion";

export type Course = {
  id: string;
  code: string;
  title: string;
  materials: { id: string; title: string; date: string; size: string; url?: string }[];
  activeTest: { id: string; title: string; duration: string; questions: number; testData?: Record<string, unknown>[]; poolSize?: string; cooldown?: string; expiresAt?: number | null; validFrom?: number | null; maxTakes?: number | null; isPracticeMode?: boolean } | null;
  activeTests?: { id: string; title: string; duration: string; questions: number; testData?: Record<string, unknown>[]; poolSize?: string; cooldown?: string; expiresAt?: number | null; validFrom?: number | null; maxTakes?: number | null; isPracticeMode?: boolean }[];
};

/**
 * The one course card. Clickable, so it carries role=button, tabIndex and
 * Enter/Space handling — a div with onClick is not a control.
 *
 * Apple Design principles applied:
 * §1 Response — whileTap uses a spring (not a fixed-duration tween) so the
 *    press responds instantly and can be interrupted.
 * §4 Springs — the tap feedback spring (SPRING_MICRO) is critically damped
 *    for a clean, non-bouncy press.
 * §3 Interruptibility — whileHover and whileTap are Framer Motion gesture
 *    variants; they animate from the current value and can be interrupted
 *    at any time without waiting for completion.
 */
export function CourseCard({
  course,
  index = 0,
  onSelect,
  badges,
  action,
  height = 180,
}: {
  course: Course;
  index?: number;
  onSelect: () => void;
  badges?: React.ReactNode;
  action?: React.ReactNode;
  height?: number;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <motion.div
      {...riseIn(index * 0.1)}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_MICRO}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open ${course.code} — ${course.title}`}
      style={{ height }}
      className="glass lift group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl p-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-accent/0 via-transparent to-accent/0 transition-all duration-500"
      />

      <div className="relative z-10">
        <span className="mb-3 inline-block rounded-full border border-edge bg-black/5 px-3 py-1 text-xs font-semibold tracking-wider text-muted-strong dark:bg-white/10">
          {course.code}
        </span>
        <h3 className="text-xl font-bold leading-tight text-foreground transition-colors duration-300">
          {course.title}
        </h3>
      </div>

      <div className="relative z-10 mt-4">
        <div className="flex flex-wrap gap-2">{badges}</div>
        {action && (
          <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-accent opacity-0 transition-all duration-300">
            {action}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Small stat pill used on course cards. */
export function CourseBadge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success";
  dot?: boolean;
}) {
  const tones = {
    neutral: "bg-black/5 text-muted-strong dark:bg-white/10",
    accent: "bg-white/95 text-accent border border-accent/25 shadow-2xs dark:bg-accent/15 dark:border-accent/30 dark:text-accent dark:shadow-none",
    success: "bg-white/95 text-success border border-success/25 shadow-2xs dark:bg-success/15 dark:border-success/30 dark:text-success dark:shadow-none",
  };
  return (
    <span
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  );
}
