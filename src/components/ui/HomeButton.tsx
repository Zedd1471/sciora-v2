"use client";

import * as React from "react";
import { Home, KeyRound, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMounted } from "@/lib/useMounted";
import { SPRING_DEFAULT } from "@/lib/motion";

/**
 * Floating Navigation Control.
 * In Admin & Desktop App: Always leads to Dashboard Passkey Login (/admin/login).
 * In Public Web: Leads to /.
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

  // Hide on /, /attendance, or /admin/login
  if (!mounted || pathname === "/" || pathname?.startsWith("/attendance") || pathname === "/admin/login") {
    return null;
  }

  const isDesktop = typeof window !== "undefined" && Boolean((window as any).scioraDesktop?.isDesktop);
  const isAdminRoute = pathname?.startsWith("/admin");
  const isDashboardApp = isDesktop || isAdminRoute;

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isNavigating) return;
    setIsNavigating(true);

    setTimeout(() => {
      if (isDashboardApp) {
        localStorage.removeItem("sciora_admin_auth");
        router.push("/admin/login");
      } else {
        router.push("/");
      }
    }, 300);
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
      className="fixed bottom-6 left-6 z-50 flex items-center bg-black dark:bg-white rounded-full overflow-hidden transition-[background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] text-white dark:text-black shadow-float min-h-[48px] cursor-pointer"
      aria-label={isDashboardApp ? "Return to Dashboard Passkey Login" : "Go to home page"}
      title={isDashboardApp ? "Dashboard Passkey Login" : "Home"}
    >
      <span className="w-12 h-12 flex items-center justify-center shrink-0">
        {isNavigating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isDashboardApp ? (
          <KeyRound className="w-5 h-5" />
        ) : (
          <Home className="w-5 h-5" />
        )}
      </span>
    </motion.button>
  );
}
