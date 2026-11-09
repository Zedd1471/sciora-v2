"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { containerVariants, itemVariants, SPRING_MICRO } from "@/lib/motion";

export default function Home() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // If accessed over local hotspot IP (e.g. 192.168.100.175), immediately route students to the attendance form
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
        (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) && host !== "127.0.0.1")
      ) {
        window.location.replace("/attendance" + window.location.search);
      }
    }
  }, []);

  const handleEnterClassroom = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    window.dispatchEvent(new CustomEvent("cursor-transition"));
    window.setTimeout(() => router.push("/notes"), 600);
  };

  return (
    <main
      id="main-content"
      className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-3xl text-center"
      >
        <motion.h1
          variants={itemVariants}
          className="wordmark text-balance mb-10 text-6xl font-bold tracking-tight md:text-8xl"
        >
          Sciora
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            size="lg"
            onClick={handleEnterClassroom}
            disabled={isNavigating}
            loading={isNavigating}
            aria-label="Enter classroom and view notes"
            className="group rounded-full px-8"
          >
            {!isNavigating && <BookOpen className="h-5 w-5" aria-hidden="true" />}
            Enter Classroom
            {!isNavigating && (
              <span
                aria-hidden="true"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              >
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </main>
  );
}
