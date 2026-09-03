import type { MemberRole } from "@/types";

export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 6,
  ADMIN: 5,
  MANAGER: 4,
  CASHIER: 3,
  RECEPTIONIST: 2,
  STAFF: 1,
};

export function hasMinimumRole(
  userRole: MemberRole,
  requiredRole: MemberRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  RECEPTIONIST: "Receptionist",
  STAFF: "Staff",
};
