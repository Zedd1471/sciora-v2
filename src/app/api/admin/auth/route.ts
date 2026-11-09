import { NextResponse } from "next/server";
import { getAdminSecret, verifyAdminAttempt } from "@/lib/admin-auth";

export async function GET() {
  try {
    const secret = await getAdminSecret();
    return NextResponse.json({
      isConfigured: !!secret,
    });
  } catch (error) {
    console.error("Failed to check admin auth status:", error);
    return NextResponse.json({ isConfigured: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "6-digit code or Master Password is required." },
        { status: 400 }
      );
    }

    const result = await verifyAdminAttempt(code);
    if (result.valid) {
      return NextResponse.json({
        success: true,
        isMaster: result.isMaster,
      });
    }

    return NextResponse.json(
      { success: false, error: result.message || "Invalid code." },
      { status: 401 }
    );
  } catch (error) {
    console.error("Admin verification error:", error);
    return NextResponse.json(
      { success: false, error: "Server authentication error." },
      { status: 500 }
    );
  }
}
