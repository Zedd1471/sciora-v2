"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { SPRING_DEFAULT, SPRING_SHEET } from "@/lib/motion";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog with Apple-style spring physics.
 *
 * Apple Design principles applied:
 * §3 Interruptibility — Springs, not keyframes. Grabbing the backdrop during
 *    enter/exit re-targets the spring and never locks out input.
 * §4 Behaviour over animation — spring type with no fixed duration.
 * §7 Spatial consistency — enters and exits along the same axis (scale + Y).
 *    transform-origin defaults to center (modal is centered) so the scale
 *    feels anchored.
 */
export function Modal({
  open,
  isOpen,
  onClose,
  title,
  children,
  dismissible = true,
  className = "",
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  const isVisible = open ?? isOpen ?? false;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  // Store latest props without triggering focus effect
  const latestProps = React.useRef({ onClose, dismissible });
  React.useEffect(() => {
    latestProps.current = { onClose, dismissible };
  }, [onClose, dismissible]);

  // Keep focus inside the dialog while it is open.
  React.useEffect(() => {
    if (!isVisible) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      const { onClose: currentOnClose, dismissible: currentDismissible } = latestProps.current;
      if (e.key === "Escape" && currentDismissible) {
        e.stopPropagation();
        currentOnClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      returnFocusRef.current?.focus();
    };
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — fast fade, no spring needed */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismissible ? onClose : undefined}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel — spring-driven, interruptible, same axis in/out (§7) */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={SPRING_SHEET}
            className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-edge bg-background p-6 shadow-lift ${className}`}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3
                id={titleId}
                className="text-xl font-bold tracking-tight text-foreground"
              >
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Close dialog"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-muted transition-[transform,background-color] duration-200 ease-[var(--ease-spring)] hover:bg-black/10 active:scale-90 disabled:pointer-events-none disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
