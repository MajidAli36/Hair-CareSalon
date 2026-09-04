import { authenticateDevice } from "@/lib/devices/helpers";
import { cashDrawerEscPosBase64 } from "@/lib/devices/cash-drawer";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function getDeviceKey(request: Request) {
  return request.headers.get("x-device-key") ?? request.headers.get("authorization")?.replace("Bearer ", "");
}

function enrichCommandPayload(
  command: string,
  payload: Record<string, unknown> | null | undefined
) {
  const base = payload && typeof payload === "object" ? { ...payload } : {};
  if (command === "OPEN_DRAWER" && !base.escPosBase64) {
    base.escPosBase64 = cashDrawerEscPosBase64();
    base.kick = base.kick ?? "ESC_POS_DRAWER";
  }
  return base;
}

export async function GET(request: Request) {
  const apiKey = getDeviceKey(request);
  if (!apiKey) return NextResponse.json({ error: "Missing device key" }, { status: 401 });

  const device = await authenticateDevice(apiKey);
  if (!device) return NextResponse.json({ error: "Invalid device" }, { status: 401 });

  const admin = createAdminClient();
  const { data: commands } = await admin
    .from("device_commands")
    .select("id, command, payload, created_at")
    .eq("device_id", device.id)
    .eq("status", "PENDING")
    .order("created_at")
    .limit(10);

  if (commands?.length) {
    await admin
      .from("device_commands")
      .update({ status: "PROCESSING" })
      .in("id", commands.map((c) => c.id));
  }

  const enriched = (commands ?? []).map((c) => ({
    ...c,
    payload: enrichCommandPayload(
      c.command,
      c.payload as Record<string, unknown> | null | undefined
    ),
  }));

  return NextResponse.json({ commands: enriched });
}

export async function POST(request: Request) {
  const apiKey = getDeviceKey(request);
  if (!apiKey) return NextResponse.json({ error: "Missing device key" }, { status: 401 });

  const device = await authenticateDevice(apiKey);
  if (!device) return NextResponse.json({ error: "Invalid device" }, { status: 401 });

  const body = await request.json();
  const { commandId, status, errorMessage } = body as {
    commandId?: string;
    status?: "COMPLETED" | "FAILED";
    errorMessage?: string;
  };

  if (!commandId || !status) {
    return NextResponse.json({ error: "commandId and status required" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from("device_commands")
    .update({
      status,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", commandId)
    .eq("device_id", device.id);

  return NextResponse.json({ ok: true });
}
