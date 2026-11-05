"use client";

import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";

type Variant = "primary" | "glass" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg shadow-card hover:bg-accent-hover hover:shadow-float",
  glass: "glass text-muted-strong hover:bg-white/40 dark:hover:bg-white/10 hover:text-foreground",
  danger: "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20 hover:text-danger",
  subtle:
    "bg-black/5 dark:bg-white/5 text-muted-strong border border-edge hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[40px] px-4 text-sm",
  md: "min-h-[44px] px-5 text-sm",
  lg: "min-h-[52px] px-7 py-4 text-base",
};

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold " +
  "transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-spring)] " +
  "hover:-translate-y-[1px] " +
  "disabled:pointer-events-none disabled:opacity-60";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  /** Square icon-only control. `aria-label` becomes mandatory in review. */
  iconOnly?: boolean;
};

/**
 * Apple-style button with pointer-down feedback.
 *
 * Key Apple Design principles applied:
 * - Responds on pointer-down (not release) — kills latency, feels direct.
 * - Scale animates via spring (CSS variable), not a fixed keyframe.
 * - Transform inherits the current value so interrupts are seamless.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconOnly = false,
  className = "",
  children,
  disabled,
  type = "button",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  const [pressed, setPressed] = React.useState(false);

  // §1 Response: respond on pointer-down, not on release
  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(true);
      onPointerDown?.(e);
    },
    [onPointerDown],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(false);
      onPointerUp?.(e);
    },
    [onPointerUp],
  );

  const handlePointerLeave = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(false);
      onPointerLeave?.(e);
    },
    [onPointerLeave],
  );

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={`${BASE} ${VARIANTS[variant]} ${
        iconOnly ? "min-w-[44px] min-h-[44px] px-0 rounded-full" : SIZES[size]
      } ${className}`}
      style={{
        // Spring-driven transform: responds instantly on press, settles on release.
        // CSS transition handles the spring curve (--ease-spring).
        transform: pressed
          ? "translateY(0px) scale(0.97)"
          : "translateY(-1px) scale(1)",
        transitionProperty: "transform, background-color, color, box-shadow",
        transitionDuration: pressed ? "100ms" : "350ms",
        transitionTimingFunction: pressed
          ? "ease-out"
          : "var(--ease-spring)",
      }}
      {...rest}
    >
      {loading ? (
        <Loader2 className={`${iconSize} animate-spin`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={iconSize} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

/** Round glass control used for back/close/navigation. */
export function IconButton({
  icon: Icon,
  label,
  variant = "glass",
  className = "",
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  ...rest
}: Omit<ButtonProps, "children" | "iconOnly" | "size"> & {
  icon: LucideIcon;
  label: string;
  variant?: Variant;
}) {
  const [pressed, setPressed] = React.useState(false);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(true);
      onPointerDown?.(e);
    },
    [onPointerDown],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(false);
      onPointerUp?.(e);
    },
    [onPointerUp],
  );

  const handlePointerLeave = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(false);
      onPointerLeave?.(e);
    },
    [onPointerLeave],
  );

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={`${BASE} ${VARIANTS[variant]} w-10 h-10 shrink-0 rounded-full p-0 ${className}`}
      style={{
        transform: pressed ? "scale(0.9)" : "scale(1)",
        transitionProperty: "transform, background-color, color, box-shadow",
        transitionDuration: pressed ? "80ms" : "300ms",
        transitionTimingFunction: pressed
          ? "ease-out"
          : "var(--ease-spring)",
      }}
      {...rest}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
