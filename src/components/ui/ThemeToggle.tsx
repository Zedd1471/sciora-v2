"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/useMounted";
import "./CurtainToggle.css";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const [isShutterActive, setIsShutterActive] = React.useState(false);
  const [shutterTheme, setShutterTheme] = React.useState<"dark" | "light">("dark");
  const transitionTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  if (!mounted) return null;

  const isDark =
    resolvedTheme === "dark" ||
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextIsDark = e.target.checked;
    const targetTheme = nextIsDark ? "dark" : "light";

    setShutterTheme(targetTheme);
    setIsShutterActive(true);

    // Update theme
    setTheme(targetTheme);

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    // Complete shutter transition: 24 * 10ms = 240ms delay + 300ms transition = 540ms
    transitionTimerRef.current = window.setTimeout(() => {
      setIsShutterActive(false);
    }, 600);
  };

  return (
    <>
      {/* 25 Shutter rows for cascading theme transition mask */}
      <div
        className={`theme-mask ${isShutterActive ? "active" : ""} ${
          shutterTheme === "dark" ? "theme-mask-dark" : "theme-mask-light"
        }`}
        aria-hidden="true"
      >
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <input
          id="theme"
          className="sr-only"
          type="checkbox"
          checked={isDark}
          onChange={handleToggle}
          aria-label={isDark ? "Dark theme active, click to switch to light" : "Light theme active, click to switch to dark"}
        />
        <label
          htmlFor="theme"
          className="theme-toggle"
          aria-label={isDark ? "Dark mode" : "Light mode"}
        >
          {/* Sun icon (visible in light mode) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>

          {/* Moon icon (visible in dark mode) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </label>
      </div>
    </>
  );
}
