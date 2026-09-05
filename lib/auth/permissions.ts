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

/** Catalog / staff / chairs / devices / settings mutations */
export async function canManageRecords() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "MANAGER");
}

/** Create / update customer profiles (front desk + cashier) */
export async function canManageCustomers() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "RECEPTIONIST");
}

/** Soft-delete customers */
export async function canDeleteCustomers() {
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

/** Collect customer feedback ratings */
export async function canUseFeedback() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "RECEPTIONIST");
}

/** Issue tokens and update queue status */
export async function canOperateQueue() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "RECEPTIONIST");
}

/** Approve / reject online booking payment proofs */
export async function canApproveDeposits() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "RECEPTIONIST");
}

/** Booking advance settings, staff online toggles, schedules */
export async function canConfigureOnlineBooking() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "MANAGER");
}

/** Open cash drawer from queue / POS */
export async function canOpenCashDrawer() {
  const org = await getActiveOrganization();
  if (!org) return false;
  return hasMinimumRole(org.role, "RECEPTIONIST");
}
