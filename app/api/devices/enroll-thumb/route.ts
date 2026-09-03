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
    return NextResponse.json({ error: "Device type not supported for enrollment" }, { status: 403 });
  }

  const body = await request.json();
  const { thumbId, staffId, pinCode } = body as {
    thumbId?: string;
    staffId?: string;
    pinCode?: string;
  };

  if (!thumbId?.trim()) {
    return NextResponse.json({ error: "thumbId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let resolvedStaffId = staffId;

  if (!resolvedStaffId && pinCode) {
    const { data: staff } = await admin
      .from("staff")
      .select("id")
      .eq("organization_id", device.organization_id)
      .eq("pin_code", pinCode)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: "Invalid PIN" }, { status: 404 });
    resolvedStaffId = staff.id;
  }

  if (!resolvedStaffId) {
    return NextResponse.json({ error: "staffId or pinCode required" }, { status: 400 });
  }

  const { data: existingThumb } = await admin
    .from("staff")
    .select("id, full_name")
    .eq("organization_id", device.organization_id)
    .eq("thumb_id", thumbId.trim())
    .maybeSingle();

  if (existingThumb && existingThumb.id !== resolvedStaffId) {
    return NextResponse.json(
      { error: `Thumb already enrolled for ${existingThumb.full_name}` },
      { status: 409 }
    );
  }

  const { data: staff, error } = await admin
    .from("staff")
    .update({
      thumb_id: thumbId.trim(),
      thumb_enrolled_at: new Date().toISOString(),
    })
    .eq("organization_id", device.organization_id)
    .eq("id", resolvedStaffId)
    .eq("is_active", true)
    .select("id, full_name, thumb_id, thumb_enrolled_at")
    .single();

  if (error || !staff) {
    return NextResponse.json({ error: error?.message ?? "Staff not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    staffId: staff.id,
    staffName: staff.full_name,
    thumbId: staff.thumb_id,
    enrolledAt: staff.thumb_enrolled_at,
  });
}
