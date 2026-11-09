import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const candidates: { name: string; address: string; isHotspot: boolean }[] = [];

    for (const [name, ifaceList] of Object.entries(interfaces)) {
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        // Only IPv4 and non-internal loopback
        const isIpv4 = iface.family === "IPv4" || (iface as any).family === 4;
        if (!isIpv4 || iface.internal) continue;

        // Ignore link-local APIPA addresses
        if (iface.address.startsWith("169.254.")) continue;

        // Windows Hotspot typically uses 192.168.137.1
        const isHotspot = iface.address === "192.168.137.1" || name.toLowerCase().includes("hotspot");

        candidates.push({
          name,
          address: iface.address,
          isHotspot,
        });
      }
    }

    // Sort so Windows Mobile Hotspot IP (192.168.137.1) comes first, followed by other 192.168.x.x, 10.x.x.x, etc.
    candidates.sort((a, b) => {
      if (a.isHotspot && !b.isHotspot) return -1;
      if (!a.isHotspot && b.isHotspot) return 1;
      if (a.address.startsWith("192.168.") && !b.address.startsWith("192.168.")) return -1;
      if (!a.address.startsWith("192.168.") && b.address.startsWith("192.168.")) return 1;
      return 0;
    });

    const recommended = candidates[0]?.address || "127.0.0.1";

    return NextResponse.json({
      success: true,
      interfaces: candidates,
      recommendedIp: recommended,
      port: 3000,
    });
  } catch (error) {
    console.error("Error inspecting network interfaces:", error);
    return NextResponse.json({ error: "Could not inspect network." }, { status: 500 });
  }
}

