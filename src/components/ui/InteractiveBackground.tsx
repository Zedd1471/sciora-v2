"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/useMounted";

// Safe useLayoutEffect for SSR
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function InteractiveBackground() {
  const pathname = usePathname();
  if (pathname?.startsWith("/attendance")) return null;
  if (
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname))
  ) {
    return null;
  }
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Capture window size on mount to avoid the 1920×1080 default flash
  useIsomorphicLayoutEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition, { passive: true });
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  const { theme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted
    ? theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    : true;

  const parallaxX =
    windowSize.width > 0
      ? (mousePosition.x - windowSize.width / 2) * -0.008
      : 0;
  const parallaxY =
    windowSize.height > 0
      ? (mousePosition.y - windowSize.height / 2) * -0.008
      : 0;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden"
      aria-hidden="true"
    >
      {/* Dark Theme Background Image */}
      <div
        className="absolute inset-[-5%] bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('/bg.jpg')`,
          opacity: isDark ? 0.45 : 0,
          transform: `translate(${parallaxX}px, ${parallaxY}px)`,
          willChange: "transform, opacity",
        }}
      />

      {/* Light Theme Background Image */}
      <div
        className="absolute inset-[-5%] bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: `url('/bg-light.jpg')`,
          opacity: !isDark ? 0.60 : 0,
          transform: `translate(${parallaxX}px, ${parallaxY}px)`,
          willChange: "transform, opacity",
        }}
      />



      {/* Reactive indigo/violet orb — follows cursor */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full pointer-events-none hidden md:block"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)"
            : "radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(124,58,237,0.04) 50%, transparent 70%)",
          transform: `translate(${mousePosition.x - 350}px, ${mousePosition.y - 350}px)`,
          transition: "transform 350ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "transform",
        }}
      />

      {/* Second slower orb for depth — offset from cursor */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none hidden md:block"
        style={{
          background: isDark
            ? "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 60%)"
            : "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 60%)",
          transform: `translate(${mousePosition.x - 200}px, ${mousePosition.y - 200}px)`,
          transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      />

      {/* Subtle radial dot grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          opacity: isDark ? 0.06 : 0.1,
        }}
      />

      {/* Bottom vignette for content readability */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background: isDark
            ? "linear-gradient(to top, rgba(20,21,25,0.7) 0%, transparent 100%)"
            : "linear-gradient(to top, rgba(243,242,238,0.7) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
