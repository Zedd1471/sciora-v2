"use client";

import { useEffect } from "react";

/**
 * Restores the system pointer once the user starts driving with the keyboard —
 * the custom cursor is a pointer-device effect, not a focus affordance.
 */
export function KeyboardNavDetector() {
  useEffect(() => {
    let armed = true;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!armed) return;
      if (e.key !== "Tab") return;
      document.body.classList.add("keyboard-nav");
      armed = false;
    };
    const onPointer = () => {
      if (!armed) return;
      document.body.classList.remove("keyboard-nav");
      armed = true;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return null;
}
