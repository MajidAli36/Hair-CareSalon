import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

type DeviceCommand = "OPEN_DRAWER" | "CLOSE_DRAWER" | "PRINT_RECEIPT" | "PRINT_TOKEN";

async function getDbClient() {
  return createClient();
}

function getAdminClientIfConfigured() {
  if (!getSupabaseServiceRoleKey()) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function authenticateDevice(apiKey: string) {
  const admin = getAdminClientIfConfigured();
  if (!admin) return null;

  const { data, error } = await admin
    .from("devices")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  await admin
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return data as {
    id: string;
    organization_id: string;
    name: string;
    type: string;
    api_key: string;
  };
}

/** Uses the logged-in user's session — no service role key required. */
export async function findDeviceByType(organizationId: string, type: string) {
  try {
    const supabase = await getDbClient();
    const { data } = await supabase
      .from("devices")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("type", type)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Queues hardware command. Tries user session first, then service role for device APIs. */
export async function queueDeviceCommand(
  organizationId: string,
  deviceId: string,
  command: DeviceCommand,
  payload: Record<string, unknown> = {}
): Promise<string | null> {
  const row = {
    organization_id: organizationId,
    device_id: deviceId,
    command,
    payload,
  };

  try {
    const supabase = await getDbClient();
    const { data, error } = await supabase
      .from("device_commands")
      .insert(row)
      .select("id")
      .single();
    if (!error && data) return data.id;
  } catch {
    // Fall through to admin client for unauthenticated device routes
  }

  const admin = getAdminClientIfConfigured();
  if (!admin) return null;

  const { data, error } = await admin.from("device_commands").insert(row).select("id").single();
  if (error) return null;
  return data.id;
}
