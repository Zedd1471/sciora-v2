import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    const hostHeader = request.headers.get("host") || "";
    const hostname = hostHeader.split(":")[0];

    // Detect if client is accessing via Wi-Fi hotspot or local LAN IP
    const isLocalNetwork =
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) && hostname !== "127.0.0.1");

    if (isLocalNetwork) {
      const redirectUrl = new URL(`/attendance${search}`, request.url);
      return NextResponse.redirect(redirectUrl, { status: 307 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};

