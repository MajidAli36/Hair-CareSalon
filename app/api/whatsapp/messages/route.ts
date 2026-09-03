import { NextResponse } from "next/server";
import { canUseWhatsApp } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { getWhatsAppSendQueue } from "@/lib/whatsapp/send-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const allowed = await canUseWhatsApp();
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await requireOrganization();
  const supabase = await createClient();
  const queue = getWhatsAppSendQueue();
  const overrides = queue.getStatusOverrides();

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, direction, status, phone, body, created_at")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).map((row) => {
    const override = overrides[row.id];
    if (!override) return row;
    return {
      ...row,
      status: override.status,
    };
  });

  return NextResponse.json({
    messages,
    queue: queue.getStats(),
  });
}
