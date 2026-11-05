"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SPRING_DEFAULT } from "@/lib/motion";

export default function StudentLogin() {
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Validate format e.g., ABC/12A/3456 or MCB/12A/3456
  const validateId = (id: string) => /^[A-Z]+\/[A-Z0-9]+\/\d+$/.test(id);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateId(studentId)) {
      setError("");
      setIsSubmitting(true);
      localStorage.setItem("sciora_student_id", studentId);
      router.push("/notes");
    } else {
      setError("Enter a valid ID in the format ABC/12A/3456.");
    }
  };

  return (
    <main
      id="main-content"
      className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ ...SPRING_DEFAULT, duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Outer bezel */}
        <div className="card-outer">
          {/* Inner core */}
          <div className="card-inner p-8">
            {/* Header */}
            <div className="mb-8 flex flex-col items-center">
              <div className="relative mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent-soft">
                  <GraduationCap
                    className="h-7 w-7 text-accent"
                    aria-hidden="true"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-2xl bg-accent/20 blur-xl"
                />
              </div>

              <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Student Access
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Sign in to Sciora
              </h1>
              <p className="mt-2 text-center text-sm leading-relaxed text-muted">
                Enter your student ID to access lecture materials and tests.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              <Field
                id="studentId"
                label="Student ID"
                type="text"
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="ABC/12A/3456"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                required
                error={error || undefined}
                className="text-center"
                style={{
                  textAlign: "center",
                  fontFamily: "var(--font-geist-mono)",
                  letterSpacing: "0.1em",
                  fontSize: "1.125rem",
                }}
              />

              <AnimatePresence>
                {isSubmitting && (
                  <motion.p
                    key="pending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    role="status"
                    className="text-center text-sm text-muted"
                  >
                    Opening your classroom…
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                icon={ArrowRight}
                className="w-full"
              >
                Access Portal
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
