import { authenticateDevice, queueDeviceCommand } from "@/lib/devices/helpers";
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

  const command = action === "open" ? "OPEN_DRAWER" : "CLOSE_DRAWER";
  const commandId = await queueDeviceCommand(device.organization_id, device.id, command, {
    triggeredBy: "device_api",
  });

  return NextResponse.json({ ok: true, commandId, action });
}
