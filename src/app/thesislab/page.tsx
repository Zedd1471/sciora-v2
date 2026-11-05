"use client";

import React, { Suspense } from "react";
import { ThesisLabWorkspace } from "@/components/thesislab/ThesisLabWorkspace";
import { useLocalStorage } from "@/lib/useLocalStorage";

export default function ThesisLabPage() {
  const thesisLabStudentId = useLocalStorage("sciora_thesislab_student_id");
  const regularStudentId = useLocalStorage("sciora_student_id");
  const studentId = thesisLabStudentId || regularStudentId;

  return (
    <main className="relative min-h-screen bg-background text-foreground pb-20 pt-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={<div className="py-12 text-center text-sm text-muted">Loading ThesisLab workspace...</div>}>
          <ThesisLabWorkspace initialStudentId={studentId || undefined} />
        </Suspense>
      </div>
    </main>
  );
}
