import { NextResponse } from "next/server";
import { initializeOrResetSecret } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { masterPassword } = body;

    if (!masterPassword || typeof masterPassword !== "string") {
      return NextResponse.json(
        { error: "Master Admin Password is required to configure Authenticator." },
        { status: 400 }
      );
    }

    const result = await initializeOrResetSecret(masterPassword);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin setup authorization error:", error);
    const msg = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

