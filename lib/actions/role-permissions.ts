"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization, getActiveOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import {
  CONFIGURABLE_ROLES,
  DEFAULT_NAV_BY_ROLE,
  NAV_KEYS,
  NAV_KEY_LABELS,
  type NavKey,
  type NavPermissionsConfig,
  getEffectiveNavPermissions,
  filterNavGroupsForRole,
} from "@/lib/permissions/nav";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { MemberRole } from "@/types";
import type { NavGroup } from "@/lib/navigation";
import type { ActionResult } from "@/types/commerce";

export type RoleNavMatrix = {
  role: MemberRole;
  roleLabel: string;
  permissions: Record<NavKey, boolean>;
};

export async function getOrgNavPermissions(): Promise<NavPermissionsConfig> {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("nav_permissions")
    .eq("id", org.organizationId)
    .single();

  return (data?.nav_permissions as NavPermissionsConfig) ?? {};
}

export async function getNavForCurrentUser(): Promise<{
  navGroups: NavGroup[];
  permissions: Record<NavKey, boolean>;
  role: MemberRole;
}> {
  const org = await requireOrganization();
  const overrides = await getOrgNavPermissions();
  const permissions = getEffectiveNavPermissions(org.role, overrides);
  const filtered = filterNavGroupsForRole(org.role, overrides);

  return {
    navGroups: filtered,
    permissions,
    role: org.role,
  };
}

export async function getRoleNavMatrix(): Promise<RoleNavMatrix[]> {
  await requireMinimumRole("ADMIN");
  const overrides = await getOrgNavPermissions();

  return CONFIGURABLE_ROLES.map((role) => ({
    role,
    roleLabel: ROLE_LABELS[role],
    permissions: getEffectiveNavPermissions(role, overrides),
  }));
}

const updateSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "CASHIER", "RECEPTIONIST", "STAFF"]),
  navKey: z.enum(NAV_KEYS as unknown as [NavKey, ...NavKey[]]),
  enabled: z.enum(["true", "false"]),
});

export async function updateRoleNavPermission(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  const parsed = updateSchema.safeParse({
    role: formData.get("role"),
    navKey: formData.get("navKey"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("organizations")
    .select("nav_permissions")
    .eq("id", org.organizationId)
    .single();

  const existing = (current?.nav_permissions as NavPermissionsConfig) ?? {};
  const roleConfig = { ...(existing[parsed.data.role] ?? {}) };
  roleConfig[parsed.data.navKey] = parsed.data.enabled === "true";

  const updated: NavPermissionsConfig = {
    ...existing,
    [parsed.data.role]: roleConfig,
  };

  const { error } = await supabase
    .from("organizations")
    .update({ nav_permissions: updated })
    .eq("id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function resetRoleNavPermissions(role: MemberRole): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  if (role === "OWNER") return { error: "Cannot reset owner permissions" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("organizations")
    .select("nav_permissions")
    .eq("id", org.organizationId)
    .single();

  const existing = { ...((current?.nav_permissions as NavPermissionsConfig) ?? {}) };
  delete existing[role];

  const { error } = await supabase
    .from("organizations")
    .update({ nav_permissions: existing })
    .eq("id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getNavPermissionLabels() {
  return NAV_KEY_LABELS;
}

export async function getDefaultNavForRole(role: MemberRole) {
  return DEFAULT_NAV_BY_ROLE[role];
}

export async function getCurrentUserNavContext() {
  const org = await getActiveOrganization();
  if (!org) return null;
  const overrides = await getOrgNavPermissions();
  return {
    role: org.role,
    overrides,
    permissions: getEffectiveNavPermissions(org.role, overrides),
    navGroups: filterNavGroupsForRole(org.role, overrides),
  };
}
