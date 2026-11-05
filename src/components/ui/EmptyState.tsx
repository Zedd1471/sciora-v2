import * as React from "react";
import { type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "plain",
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "plain" | "dashed";
  className?: string;
}) {
  return (
    <div
      className={`glass flex flex-col items-center rounded-2xl p-8 text-center ${
        variant === "dashed" ? "border border-dashed border-edge" : ""
      } ${className}`}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </span>
      <h4 className="font-semibold text-foreground">{title}</h4>
      {description && (
        <p className="mt-2 max-w-[320px] text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Inline failure with a recovery action — never a bare console.error. */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
  className = "",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`glass rounded-2xl border border-danger/25 p-8 text-center ${className}`}
    >
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-[44px] rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
