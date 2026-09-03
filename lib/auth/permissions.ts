import { getActiveOrganization, requireOrganization } from "@/lib/auth/organization";
import { hasMinimumRole } from "@/lib/permissions/roles";
import type { MemberRole } from "@/types";

export async function requireMinimumRole(requiredRole: MemberRole) {
  const org = await requireOrganization();
  if (!hasMinimumRole(org.role, requiredRole)) {
    throw new Error("Insufficient permissions");
  }
  return org;
}

export async function canManageRecords() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "MANAGER");
}

export async function canUsePos() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "CASHIER");
}

export async function canViewReports() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "MANAGER");
}

export async function canUseWhatsApp() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "RECEPTIONIST");
}
