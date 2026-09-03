import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/types";

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  role: MemberRole;
};

export async function getUserMemberships(): Promise<OrganizationMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      role,
      organization:organizations (
        id,
        name
      )
    `
    )
    .eq("user_id", user.id);

  if (error || !data) return [];

  return data
    .filter((row) => row.organization)
    .map((row) => ({
      organizationId: row.organization!.id,
      organizationName: row.organization!.name,
      role: row.role as MemberRole,
    }));
}

export async function getActiveOrganization(): Promise<OrganizationMembership | null> {
  const memberships = await getUserMemberships();
  if (memberships.length === 0) return null;
  // Single-salon MVP: auto-select the first (only) organization.
  return memberships[0];
}

export async function requireOrganization(): Promise<OrganizationMembership> {
  const org = await getActiveOrganization();
  if (!org) {
    throw new Error("No organization membership found");
  }
  return org;
}
