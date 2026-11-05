"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { SPRING_DEFAULT, SPRING_BOUNCY } from "@/lib/motion";

type ToastKind = "success" | "error" | "danger" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
};

type ToastFn = (input: {
  kind?: ToastKind;
  title: string;
  description?: string;
}) => void;

const ToastContext = React.createContext<ToastFn | null>(null);

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
};

const ACCENT: Record<ToastKind, string> = {
  success: "text-success",
  error: "text-danger",
  danger: "text-danger",
  info: "text-accent",
};

/**
 * The single feedback channel. Replaces every alert()/window.confirm and the
 * silent console.error paths. Failures stay until dismissed; successes
 * auto-dismiss.
 *
 * Apple Design principles applied:
 * §4 Springs — layout animations use springs so toasts reflow smoothly when
 *    one is dismissed mid-stack. No fixed durations to fight.
 * §7 Spatial consistency — toasts enter from the top (y: -16) and exit to
 *    the top (y: -12), same axis both ways.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback<ToastFn>(
    ({ kind = "info", title, description }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, kind, title, description }]);
      if (kind !== "error" && kind !== "danger") {
        window.setTimeout(() => dismiss(id), 4000);
      }
    },
    [dismiss],
  );

  const value = React.useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-4 left-1/2 z-[300] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        <div aria-live="polite" aria-atomic="false" className="contents">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => {
              const Icon = ICONS[toast.kind];
              return (
                <motion.div
                  key={toast.id}
                  layout
                  layoutId={`toast-${toast.id}`}
                  initial={{ opacity: 0, y: -16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.95 }}
                  transition={SPRING_BOUNCY}
                  role={toast.kind === "error" ? "alert" : "status"}
                  className="glass pointer-events-auto flex items-start gap-3 rounded-2xl p-4 shadow-float touch-none"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragEnd={(e, { offset, velocity }) => {
                    const swipeThreshold = 100;
                    const velocityThreshold = 500;
                    if (
                      Math.abs(offset.x) > swipeThreshold ||
                      Math.abs(velocity.x) > velocityThreshold
                    ) {
                      dismiss(toast.id);
                    }
                  }}
                >
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${ACCENT[toast.kind]}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {toast.title}
                    </p>
                    {toast.description && (
                      <p className="mt-0.5 text-sm text-muted">
                        {toast.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Dismiss notification"
                    className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-[transform,background-color] duration-200 ease-[var(--ease-spring)] hover:bg-black/5 active:scale-90 dark:hover:bg-white/5"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
