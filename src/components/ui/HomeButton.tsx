"use client";

import * as React from "react";
import { Home, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMounted } from "@/lib/useMounted";
import { SPRING_DEFAULT, SPRING_MICRO } from "@/lib/motion";

/**
 * Floating home button. Appears on all pages except /.
 *
 * Apple Design principles applied:
 * §7 Spatial consistency — enters from the left (x: -12) and exits the
 *    same way (x: -12). It "lives" off the left edge.
 * §1 Response — whileTap gives instant press feedback via spring.
 * §4 Springs — entrance/exit uses SPRING_DEFAULT (critically damped).
 */
export function HomeButton() {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [prevPath, setPrevPath] = React.useState(pathname);

  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setIsNavigating(false);
  }

  if (!mounted || pathname === "/") return null;

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isNavigating) return;
    setIsNavigating(true);
    setTimeout(() => {
      router.push("/");
    }, 400);
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={SPRING_DEFAULT}
      whileTap={{ scale: 0.93 }}
      onClick={handleHomeClick}
      type="button"
      aria-busy={isNavigating || undefined}
      className="fixed bottom-6 left-6 z-50 flex items-center bg-black dark:bg-white rounded-full overflow-hidden transition-[background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] text-white dark:text-black shadow-float min-h-[48px]"
      aria-label="Go to home page"
    >
      <span className="w-12 h-12 flex items-center justify-center shrink-0">
        {isNavigating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Home className="w-5 h-5" />
        )}
      </span>
    </motion.button>
  );
}
