import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, getGeminiModel } from "@/lib/gemini";

export const maxDuration = 45;

export type StudentSummary = {
  studentId: string;
  studentName?: string;
  attendanceCount: number;
  totalSessions: number;
  attendancePct: number;
  testCount: number;
  grandTotalScore: number;
  grandTotalMax: number;
  grandTotalPct: number;
  testScoresSummary?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      courseCode,
      courseTitle,
      totalSessions = 0,
      threshold = 75,
      students = [],
    }: {
      courseCode: string;
      courseTitle: string;
      totalSessions: number;
      threshold: number;
      students: StudentSummary[];
    } = body;

    if (!students || students.length === 0) {
      return NextResponse.json(
        { error: "No student records available to analyze." },
        { status: 400 }
      );
    }

    // 1. Compute statistical baseline locally
    const totalStudents = students.length;
    const eligibleCount = students.filter((s) => s.attendancePct >= threshold).length;
    const belowThresholdCount = students.filter((s) => s.attendancePct < threshold).length;
    const zeroAttendanceCount = students.filter((s) => s.attendanceCount === 0).length;

    const avgAttendance = Math.round(
      students.reduce((acc, s) => acc + s.attendancePct, 0) / (totalStudents || 1)
    );
    const avgScore = Math.round(
      students.reduce((acc, s) => acc + s.grandTotalPct, 0) / (totalStudents || 1)
    );

    // Rule-based flags for guaranteed immediate insights
    const flaggedStudents: Array<{
      studentId: string;
      studentName?: string;
      flagType: "ghost_tester" | "discrepancy" | "at_risk" | "high_performer";
      reason: string;
    }> = [];

    students.forEach((s) => {
      // Ghost tester: Has test score but zero attendance in physical class
      if (s.attendanceCount === 0 && s.testCount > 0) {
        flaggedStudents.push({
          studentId: s.studentId,
          studentName: s.studentName,
          flagType: "ghost_tester",
          reason: `Zero attendance (0/${totalSessions} lectures) but recorded test submissions (${s.grandTotalPct}% score). Verify if student took test remotely or via proxy.`,
        });
      } else if (s.attendancePct < 50 && s.grandTotalPct >= 80) {
        // High score with very low attendance
        flaggedStudents.push({
          studentId: s.studentId,
          studentName: s.studentName,
          flagType: "discrepancy",
          reason: `High test score (${s.grandTotalPct}%) with low class presence (${s.attendancePct}%). Exceptional self-study or unverified attendance.`,
        });
      } else if (s.attendancePct < threshold && s.grandTotalPct < 50 && s.testCount > 0) {
        // At risk
        flaggedStudents.push({
          studentId: s.studentId,
          studentName: s.studentName,
          flagType: "at_risk",
          reason: `Critical at-risk student: attendance below threshold (${s.attendancePct}%) and failing grades (${s.grandTotalPct}%). Remedial intervention required.`,
        });
      } else if (s.attendancePct >= 90 && s.grandTotalPct >= 85) {
        flaggedStudents.push({
          studentId: s.studentId,
          studentName: s.studentName,
          flagType: "high_performer",
          reason: `Top performer: outstanding attendance (${s.attendancePct}%) and academic mastery (${s.grandTotalPct}%). Eligible for honors recognition.`,
        });
      }
    });

    const apiKey = getGeminiApiKey();

    // If Gemini key is available, generate deep generative synthesis
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const model = getGeminiModel();

        const studentDataSample = students.slice(0, 80).map((s) => ({
          id: s.studentId,
          name: s.studentName || "N/A",
          attPct: `${s.attendancePct}% (${s.attendanceCount}/${totalSessions})`,
          scorePct: `${s.grandTotalPct}% (${s.grandTotalScore}/${s.grandTotalMax})`,
          tests: s.testScoresSummary || "N/A",
        }));

        const prompt = `You are an expert academic evaluator and university registrar auditor analyzing student attendance and test performance for course "${courseCode} - ${courseTitle}".
Here is the aggregated cohort data:
- Total Enrolled/Assessed Students: ${totalStudents}
- Lecture Sessions Conducted: ${totalSessions}
- Attendance Threshold for Exam Eligibility: ${threshold}%
- Cohort Average Attendance: ${avgAttendance}%
- Cohort Average Test Score: ${avgScore}%
- Students Meeting Exam Attendance: ${eligibleCount}
- Students Below Threshold: ${belowThresholdCount}
- Students with 0% Attendance: ${zeroAttendanceCount}

Sample Student Records:
${JSON.stringify(studentDataSample, null, 2)}

Provide a concise, executive-level JSON evaluation adhering strictly to this JSON format:
{
  "correlationSummary": "2-3 sentences analyzing the statistical correlation between classroom lecture attendance and test scores for this cohort, highlighting overall trends.",
  "executiveInsight": "1-2 sentences summarizing overall cohort health and exam readiness.",
  "recommendations": [
    "Specific policy recommendation regarding students below the threshold",
    "Actionable step regarding unverified attendance or test anomalies",
    "Guidance for upcoming exam clearance"
  ]
}
Return ONLY valid JSON without markdown fences.`;

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const rawText = response.text || "";
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsedAi = JSON.parse(cleanJson);

        return NextResponse.json({
          success: true,
          aiGenerated: true,
          attendanceStats: {
            totalStudents,
            eligibleCount,
            belowThresholdCount,
            zeroAttendanceCount,
            averageAttendancePct: avgAttendance,
            averageScorePct: avgScore,
            threshold,
          },
          correlationSummary: parsedAi.correlationSummary || `Cohort average attendance is ${avgAttendance}%, with an average test score of ${avgScore}%.`,
          executiveInsight: parsedAi.executiveInsight || `${eligibleCount} of ${totalStudents} students meet the ${threshold}% attendance threshold for final examinations.`,
          recommendations: Array.isArray(parsedAi.recommendations) ? parsedAi.recommendations : [
            `Enforce the ${threshold}% attendance requirement for exam eligibility.`,
            `Review ${zeroAttendanceCount} students with test submissions who missed all lectures.`,
            `Schedule revision sessions for students struggling academically.`
          ],
          flaggedStudents,
        });
      } catch (geminiError) {
        console.warn("Gemini call failed or timed out, returning calculated statistical insights:", geminiError);
      }
    }

    // Fallback if no API key or if offline/error
    return NextResponse.json({
      success: true,
      aiGenerated: false,
      attendanceStats: {
        totalStudents,
        eligibleCount,
        belowThresholdCount,
        zeroAttendanceCount,
        averageAttendancePct: avgAttendance,
        averageScorePct: avgScore,
        threshold,
      },
      correlationSummary: `Analysis of ${totalStudents} students reveals a cohort average attendance of ${avgAttendance}% and an average cumulative score of ${avgScore}%. ${eligibleCount} students (${Math.round((eligibleCount / (totalStudents || 1)) * 100)}%) meet the ${threshold}% attendance qualification.`,
      executiveInsight: `${belowThresholdCount} students fall below the ${threshold}% threshold and ${zeroAttendanceCount} students have zero physical attendance records.`,
      recommendations: [
        `Strictly verify physical attendance for students with zero attendance before permitting exam entry.`,
        `Students with attendance ≥ ${threshold}% are cleared for final course assessments.`,
        `Provide an attendance makeup or assignment option for students between 60% and ${threshold}%.`,
      ],
      flaggedStudents,
    });
  } catch (error) {
    console.error("Course analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate course analytics" },
      { status: 500 }
    );
  }
}

