"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPath = pathname === "/admin/login";
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    return isLoginPath || localStorage.getItem("sciora_admin_auth") === "true";
  });

  useEffect(() => {
    if (isLoginPath) {
      setIsAuthenticated(true);
      return;
    }
    const hasAuth = localStorage.getItem("sciora_admin_auth") === "true";
    if (!hasAuth) {
      setIsAuthenticated(false);
      router.push("/admin/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [isLoginPath, router]);

  if (!isLoginPath && !isAuthenticated) {
    return (
      <div
        role="status"
        className="min-h-screen flex flex-col items-center justify-center gap-4"
      >
        <Loader2 className="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-muted">
          Verifying access
        </p>
        <span className="sr-only">Checking admin credentials</span>
      </div>
    );
  }

  return <>{children}</>;
}
