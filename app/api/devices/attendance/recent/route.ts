import { authenticateDevice } from "@/lib/devices/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { endOfLocalDay, getLocalDateString, startOfLocalDay } from "@/lib/dates/local";
import { NextResponse } from "next/server";

function getDeviceKey(request: Request) {
  return (
    request.headers.get("x-device-key") ??
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    new URL(request.url).searchParams.get("key") ??
    undefined
  );
}

export async function GET(request: Request) {
  const apiKey = getDeviceKey(request);
  if (!apiKey) return NextResponse.json({ error: "Missing device key" }, { status: 401 });

  const device = await authenticateDevice(apiKey);
  if (!device) return NextResponse.json({ error: "Invalid device" }, { status: 401 });

  if (device.type !== "ATTENDANCE" && device.type !== "TOKEN_KIOSK") {
    return NextResponse.json({ error: "Device type not supported for attendance" }, { status: 403 });
  }

  const limit = Math.min(
    20,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? "10"))
  );
  const today = getLocalDateString();
  const dayStart = startOfLocalDay(today).toISOString();
  const dayEnd = endOfLocalDay(today).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("staff_attendance")
    .select("id, check_in_at, check_out_at, method, staff:staff(id, full_name)")
    .eq("organization_id", device.organization_id)
    .gte("check_in_at", dayStart)
    .lte("check_in_at", dayEnd)
    .order("check_in_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const records = (data ?? []).map((row) => {
    const staff = row.staff as unknown as { id: string; full_name: string } | null;
    return {
      id: row.id,
      staffId: staff?.id ?? null,
      staffName: staff?.full_name ?? "Unknown",
      method: row.method,
      checkInAt: row.check_in_at,
      checkOutAt: row.check_out_at,
      onDuty: !row.check_out_at,
    };
  });

  const onDuty = records.filter((r) => r.onDuty);

  return NextResponse.json({
    device: { id: device.id, name: device.name },
    date: today,
    onDutyCount: onDuty.length,
    onDuty,
    records,
  });
}
