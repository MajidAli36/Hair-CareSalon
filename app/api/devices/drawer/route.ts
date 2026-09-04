import { authenticateDevice, queueDeviceCommand } from "@/lib/devices/helpers";
import { cashDrawerEscPosBase64, queueOpenCashDrawer } from "@/lib/devices/cash-drawer";
import { NextResponse } from "next/server";

function getDeviceKey(request: Request) {
  return request.headers.get("x-device-key") ?? request.headers.get("authorization")?.replace("Bearer ", "");
}

export async function POST(request: Request) {
  const apiKey = getDeviceKey(request);
  if (!apiKey) return NextResponse.json({ error: "Missing device key" }, { status: 401 });

  const device = await authenticateDevice(apiKey);
  if (!device) return NextResponse.json({ error: "Invalid device" }, { status: 401 });

  const body = await request.json();
  const { action } = body as { action?: "open" | "close" };

  if (!action) return NextResponse.json({ error: "action required (open|close)" }, { status: 400 });

  if (action === "open") {
    // Prefer org drawer/printer routing so a kiosk key can still open the till
    const routed = await queueOpenCashDrawer(device.organization_id, {
      triggeredBy: "device_api",
      fromDeviceId: device.id,
    });
    if (routed.ok) {
      return NextResponse.json({
        ok: true,
        commandId: routed.commandId,
        action,
        deviceRole: routed.deviceRole,
      });
    }
    // Fall back: queue kick on the calling device itself
    const commandId = await queueDeviceCommand(
      device.organization_id,
      device.id,
      "OPEN_DRAWER",
      {
        triggeredBy: "device_api",
        escPosBase64: cashDrawerEscPosBase64(),
        kick: "ESC_POS_DRAWER",
      }
    );
    return NextResponse.json({ ok: true, commandId, action });
  }

  const commandId = await queueDeviceCommand(device.organization_id, device.id, "CLOSE_DRAWER", {
    triggeredBy: "device_api",
  });

  return NextResponse.json({ ok: true, commandId, action });
}
