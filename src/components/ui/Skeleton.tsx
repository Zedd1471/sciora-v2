import * as React from "react";

/** A single shimmering block. Shape must mirror the content it replaces. */
export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-black/8 dark:bg-white/10 ${className}`}
    />
  );
}

/** Mirrors a material / file row. */
export function RowSkeleton() {
  return (
    <div className="glass flex items-center justify-between rounded-2xl p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  );
}

/** Mirrors a course card. */
export function CourseSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div
      className="glass flex flex-col justify-between rounded-3xl p-6"
      style={{ height }}
    >
      <div className="space-y-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Container that announces itself while replacing known layout. */
export function SkeletonList({
  count = 3,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>{children}</React.Fragment>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
