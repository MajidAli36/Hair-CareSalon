"use server";

import { revalidatePath } from "next/cache";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/commerce";

export async function registerDevice(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult & { apiKey?: string }> {
  const org = await requireMinimumRole("MANAGER");
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const location = (formData.get("location") as string) || null;

  if (!name || !type) return { error: "Name and type required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .insert({
      organization_id: org.organizationId,
      name,
      type: type as "ATTENDANCE" | "DRAWER" | "PRINTER" | "TOKEN_KIOSK",
      location,
      auto_registered: false,
    })
    .select("api_key")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/devices");
  return { success: true, apiKey: data.api_key };
}

export async function getDevices() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as {
    id: string;
    name: string;
    type: string;
    api_key: string;
    location: string | null;
    is_active: boolean;
    auto_registered: boolean;
    last_seen_at: string | null;
    created_at: string;
  }[];
}

export async function getDeviceCommands(limit = 20) {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_commands")
    .select("*, device:devices(name, type)")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as unknown as {
    id: string;
    command: string;
    status: string;
    created_at: string;
    device: { name: string; type: string } | null;
  }[];
}

export async function setDeviceActive(
  deviceId: string,
  isActive: boolean
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { error } = await supabase
    .from("devices")
    .update({ is_active: isActive })
    .eq("id", deviceId)
    .eq("organization_id", org.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/devices");
  return { success: true };
}

export async function deleteDevice(deviceId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  await supabase
    .from("device_commands")
    .delete()
    .eq("device_id", deviceId)
    .eq("organization_id", org.organizationId);

  const { error } = await supabase
    .from("devices")
    .delete()
    .eq("id", deviceId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/devices");
  return { success: true };
}
