import type { Variants, Transition } from "framer-motion";

// ─── Apple-style Spring Presets ──────────────────────────────────────
// From Apple's WWDC 2018 "Designing Fluid Interfaces":
// - damping 1.0 = critically damped (no overshoot) — the default
// - damping <1.0 = underdamped (overshoots) — only for momentum gestures
// Framer Motion's `bounce` ≈ 1 − damping; `duration` ≈ Apple's "response"

/** Critically damped — the house default. Graceful, no overshoot. */
export const SPRING_DEFAULT: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.4,
};

/** For interactions released with momentum (flick, throw, drawer release). */
export const SPRING_BOUNCY: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.4,
};

/** Snappy sheet/drawer spring. Slightly bouncy, fast response. */
export const SPRING_SHEET: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.3,
};

/** Rotation spring — medium bounce. */
export const SPRING_ROTATION: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.4,
};

/** Quick micro-interaction (button press feedback, toggles). */
export const SPRING_MICRO: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.2,
};

// ─── Legacy curve exports (kept for non-gesture CSS transitions) ─────
/** @deprecated Prefer SPRING_DEFAULT for gesture-driven motion. */
export const EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** @deprecated Prefer SPRING_DEFAULT for gesture-driven motion. */
export const SPRING: [number, number, number, number] = [0.32, 0.72, 0, 1];

// ─── Momentum Projection ────────────────────────────────────────────
// Apple's exact projection function from the Designing Fluid Interfaces
// sample code. Uses exponential decay, NOT the physics-textbook v²/(2·a).

/**
 * Project where a value will come to rest given an initial velocity.
 * Use this to decide which snap-point a flick should land on.
 *
 * @param initialVelocity - Release velocity in px/s.
 * @param decelerationRate - 0.998 for scroll-like feel, 0.99 for snappier.
 * @returns Projected displacement in px.
 */
export function project(
  initialVelocity: number,
  decelerationRate = 0.998,
): number {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Given a release position and velocity, find the nearest snap point
 * by projecting momentum forward.
 */
export function nearestSnapPoint(
  currentPosition: number,
  releaseVelocity: number,
  snapPoints: number[],
  decelerationRate = 0.998,
): number {
  const projected = currentPosition + project(releaseVelocity, decelerationRate);
  return snapPoints.reduce((closest, point) =>
    Math.abs(point - projected) < Math.abs(closest - projected) ? point : closest,
  );
}

// ─── Variant Presets ─────────────────────────────────────────────────

/** Staggered parent for entrance sequences. */
export const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

/** Rise + de-blur child. Now spring-based for interruptibility. */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { ...SPRING_DEFAULT, duration: 0.7 },
  },
};

/** Enter/animate/exit set for AnimatePresence view swaps. Spring-based. */
export const viewMotion = {
  initial: { opacity: 0, filter: "blur(8px)", y: 20 },
  animate: { opacity: 1, filter: "blur(0px)", y: 0 },
  exit: { opacity: 0, filter: "blur(8px)", scale: 0.96 },
  transition: SPRING_DEFAULT,
} as const;

/** Lightweight list-item entrance. */
export const riseIn = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING_DEFAULT, delay, duration: 0.5 },
});

/** Page header entrance — matches every route. */
export const headerIn = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  transition: SPRING_DEFAULT,
};
