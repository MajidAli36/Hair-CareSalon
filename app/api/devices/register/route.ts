import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationSlug, name, type, fingerprint } = body as {
      organizationSlug?: string;
      name?: string;
      type?: string;
      fingerprint?: string;
    };

    if (!organizationSlug || !type) {
      return NextResponse.json({ error: "organizationSlug and type required" }, { status: 400 });
    }

    const validTypes = ["ATTENDANCE", "DRAWER", "PRINTER", "TOKEN_KIOSK"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid device type" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", organizationSlug)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (fingerprint) {
      const { data: existing } = await admin
        .from("devices")
        .select("id, api_key, name")
        .eq("organization_id", org.id)
        .contains("config", { fingerprint })
        .maybeSingle();

      if (existing) {
        await admin
          .from("devices")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
        return NextResponse.json({
          deviceId: existing.id,
          apiKey: existing.api_key,
          name: existing.name,
          registered: false,
        });
      }
    }

    const deviceName = name ?? `${type} Device`;
    const { data: device, error } = await admin
      .from("devices")
      .insert({
        organization_id: org.id,
        name: deviceName,
        type: type as "ATTENDANCE" | "DRAWER" | "PRINTER" | "TOKEN_KIOSK",
        auto_registered: true,
        config: fingerprint ? { fingerprint } : {},
      })
      .select("id, api_key, name")
      .single();

    if (error || !device) {
      return NextResponse.json({ error: error?.message ?? "Registration failed" }, { status: 500 });
    }

    return NextResponse.json({
      deviceId: device.id,
      apiKey: device.api_key,
      name: device.name,
      registered: true,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
