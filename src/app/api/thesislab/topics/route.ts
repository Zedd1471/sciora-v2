import { NextResponse } from "next/server";

/**
 * Public directory listing has been deprecated and disabled for student privacy.
 * Supervisors can access the complete student directory securely in /admin/students.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Public student directory listing is disabled. Access restricted to Supervisor Dashboard.",
    },
    { status: 403 }
  );
}
