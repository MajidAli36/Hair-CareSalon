import { recordAttendanceAction, resolveStaffForAttendance } from "@/lib/attendance/record";
import { authenticateDevice } from "@/lib/devices/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function getDeviceKey(request: Request) {
  return request.headers.get("x-device-key") ?? request.headers.get("authorization")?.replace("Bearer ", "");
}

export async function POST(request: Request) {
  const apiKey = getDeviceKey(request);
  if (!apiKey) return NextResponse.json({ error: "Missing device key" }, { status: 401 });

  const device = await authenticateDevice(apiKey);
  if (!device) return NextResponse.json({ error: "Invalid device" }, { status: 401 });

  if (device.type !== "ATTENDANCE" && device.type !== "TOKEN_KIOSK") {
    return NextResponse.json({ error: "Device type not supported for attendance" }, { status: 403 });
  }

  const body = await request.json();
  const { pinCode, staffId, thumbId, action } = body as {
    pinCode?: string;
    staffId?: string;
    thumbId?: string;
    action?: "check_in" | "check_out" | "toggle";
  };

  if (!action) return NextResponse.json({ error: "action required (check_in, check_out, or toggle)" }, { status: 400 });

  const admin = createAdminClient();
  const resolved = await resolveStaffForAttendance(admin, device.organization_id, {
    staffId,
    pinCode,
    thumbId,
  });
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const result = await recordAttendanceAction(admin, {
    organizationId: device.organization_id,
    staffId: resolved.staffId,
    staffName: resolved.staffName,
    method: resolved.method,
    deviceId: device.id,
    action,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
