"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { IconButton } from "./Button";
import { headerIn } from "@/lib/motion";

/** Round glass back control — the only back button in the app. */
export function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <IconButton
      icon={ChevronLeft}
      label={label}
      onClick={onClick}
      className="transition-transform"
    />
  );
}

/**
 * One header shape for every route: icon + eyebrow, h1, optional
 * description, right-aligned actions.
 */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  leading,
  className = "",
}: {
  icon: LucideIcon;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional node before the title block (e.g. BackButton). */
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.header
      {...headerIn}
      className={`mb-10 flex flex-col justify-between gap-4 border-b border-edge pb-6 md:flex-row md:items-center ${className}`}
    >
      <div className="flex items-center gap-4">
        {leading}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </motion.header>
  );
}
