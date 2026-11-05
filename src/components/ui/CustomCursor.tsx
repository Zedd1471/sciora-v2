"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useMotionValue, useMotionTemplate } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/useMounted";
import { BookOpen, ArrowRight } from "lucide-react";

const LENS_RADIUS = 135;
const LENS_DIAMETER = LENS_RADIUS * 2;

export default function CustomCursor() {
  const [isMobile, setIsMobile] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);

  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted ? resolvedTheme === "dark" : true;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia("(pointer: coarse)").matches);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setIsTransitioning(false);
  }

  // Critically damped spring for ultra-smooth, fluid glide without twitching or snapping
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springConfig = { stiffness: 220, damping: 28, mass: 0.6 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  // Optical circular mask for the magnifying lens
  const maskImage = useMotionTemplate`radial-gradient(circle ${LENS_RADIUS}px at ${springX}px ${springY}px, black 98.5%, transparent 100%)`;
  const transformOrigin = useMotionTemplate`${springX}px ${springY}px`;

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isTransitioning) {
        x.set(e.clientX);
        y.set(e.clientY);
        setMousePosition({ x: e.clientX, y: e.clientY });
        if (!isVisible) setIsVisible(true);
      }
    };
    const handleEnter = () => setIsVisible(true);
    const handleLeave = () => setIsVisible(false);
    const handleTransition = () => setIsTransitioning(true);

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseenter", handleEnter);
    document.addEventListener("mouseleave", handleLeave);
    window.addEventListener("cursor-transition", handleTransition);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseenter", handleEnter);
      document.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("cursor-transition", handleTransition);
    };
  }, [isTransitioning, isVisible, x, y]);

  useEffect(() => {
    if (pathname === "/" && !isMobile) {
      document.body.classList.add("hide-cursor");
    } else {
      document.body.classList.remove("hide-cursor");
    }
    return () => document.body.classList.remove("hide-cursor");
  }, [pathname, isMobile]);

  if (isMobile) return null;
  if (pathname !== "/") return null;

  const parallaxX =
    windowSize.width > 0
      ? (mousePosition.x - windowSize.width / 2) * -0.008
      : 0;
  const parallaxY =
    windowSize.height > 0
      ? (mousePosition.y - windowSize.height / 2) * -0.008
      : 0;

  return (
    <>
      {/* MAGNIFYING LENS THEME-REVEAL LAYER */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-[150] hidden md:block overflow-hidden"
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
        }}
        animate={{ opacity: isTransitioning || !isVisible ? 0 : 1 }}
        transition={{ duration: 0.25 }}
      >
        {/* Optical glass slight magnification (1.04x) anchored at lens center */}
        <motion.div
          className="relative w-full h-full"
          style={{
            transformOrigin,
            scale: 1.04,
          }}
        >
          {/* Revealed Opposite Theme Background Surface */}
          <div
            className="absolute inset-0 transition-colors duration-500"
            style={{
              backgroundColor: isDark ? "#f3f2ee" : "#141519",
            }}
          />

          {/* Revealed Opposite Theme Background Image */}
          <div
            className="absolute inset-[-5%] bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: isDark ? "url('/bg-light.jpg')" : "url('/bg.jpg')",
              opacity: isDark ? 0.70 : 0.55,
              transform: `translate(${parallaxX}px, ${parallaxY}px)`,
            }}
          />

          {/* Revealed Opposite Theme Radial Dot Grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: isDark
                ? "radial-gradient(circle at center, rgba(0,0,0,0.25) 1px, transparent 1px)"
                : "radial-gradient(circle at center, rgba(255,255,255,0.35) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              opacity: isDark ? 0.12 : 0.08,
            }}
          />

          {/* Revealed Opposite Theme Bottom Vignette */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: isDark
                ? "linear-gradient(to top, rgba(243,242,238,0.7) 0%, transparent 100%)"
                : "linear-gradient(to top, rgba(20,21,25,0.7) 0%, transparent 100%)",
            }}
          />

          {/* Revealed Opposite Theme Landing Page Content */}
          <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6">
            <div className="w-full max-w-3xl text-center">
              <h1
                className="text-balance mb-10 text-6xl font-bold tracking-tight md:text-8xl"
                style={{
                  backgroundImage: isDark
                    ? "linear-gradient(135deg, #0f0f23 0%, #4f46e5 45%, #7c3aed 80%, #c4b5fd 100%)"
                    : "linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 40%, #818cf8 80%, #c4b5fd 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.04em",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Sciora
              </h1>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold shadow-lg ${
                    isDark
                      ? "bg-[#4338ca] text-white shadow-[0_8px_32px_rgba(67,56,202,0.25)]"
                      : "bg-[#818cf8] text-[#0f0f18] shadow-[0_8px_32px_rgba(129,140,248,0.3)]"
                  }`}
                >
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                  Enter Classroom
                  <span
                    className={`ml-1 flex h-7 w-7 items-center justify-center rounded-full ${
                      isDark ? "bg-white/20 text-white" : "bg-black/15 text-[#0f0f18]"
                    }`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* MAGNIFYING LENS FRAME / LOUPE RIM */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[190] hidden md:block"
        style={{
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          width: LENS_DIAMETER,
          height: LENS_DIAMETER,
        }}
        animate={{
          opacity: isTransitioning || !isVisible ? 0 : 1,
          scale: isTransitioning ? 25 : 1,
        }}
        transition={{
          opacity: { duration: 0.2 },
          scale: {
            duration: isTransitioning ? 0.6 : 0.15,
            ease: isTransitioning ? "easeInOut" : [0.16, 1, 0.3, 1],
          },
        }}
      >
        {/* Outer Beveled Lens Ring */}
        <div
          className={`w-full h-full rounded-full transition-colors duration-300 relative ${
            isDark
              ? "border-[2.5px] border-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.15),inset_0_0_20px_rgba(0,0,0,0.3),0_16px_48px_rgba(0,0,0,0.5)]"
              : "border-[2.5px] border-black/30 shadow-[0_0_0_1px_rgba(0,0,0,0.1),inset_0_0_20px_rgba(0,0,0,0.15),0_16px_48px_rgba(0,0,0,0.25)]"
          }`}
        >
          {/* Specular Glare Arc on Optical Glass */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 30%, transparent 45%, rgba(255,255,255,0.06) 100%)",
            }}
          />

          {/* Subtle Chromatic / Edge Refraction Ring */}
          <div
            className="absolute inset-[1px] rounded-full"
            style={{
              boxShadow: isDark
                ? "inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4)"
                : "inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -2px 4px rgba(0,0,0,0.2)",
            }}
          />

          {/* Central Precision Focus Reticle Dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                isDark
                  ? "bg-white/80 ring-2 ring-black/40 shadow-xs"
                  : "bg-black/80 ring-2 ring-white/60 shadow-xs"
              }`}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}
