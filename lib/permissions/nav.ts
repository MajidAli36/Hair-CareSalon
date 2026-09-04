import type { MemberRole } from "@/types";
import type { NavGroup } from "@/lib/navigation";
import { navGroups } from "@/lib/navigation";

/** Stable keys for each sidebar route — used in permission config */
export const NAV_KEYS = [
  "dashboard",
  "customers",
  "appointments",
  "online_booking",
  "queue",
  "pos",
  "sales",
  "services",
  "products",
  "chairs",
  "staff",
  "attendance",
  "devices",
  "reports",
  "finances",
  "whatsapp",
  "settings",
] as const;

export type NavKey = (typeof NAV_KEYS)[number];

export const NAV_KEY_LABELS: Record<NavKey, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  appointments: "Appointments",
  online_booking: "Online booking",
  queue: "Queue",
  pos: "POS",
  sales: "Sales",
  services: "Services",
  products: "Products",
  chairs: "Chairs",
  staff: "Staff",
  attendance: "Attendance",
  devices: "Devices",
  reports: "Reports",
  finances: "Finances",
  whatsapp: "WhatsApp",
  settings: "Settings",
};

/** href → permission key */
export const HREF_TO_NAV_KEY: Record<string, NavKey> = {
  "/dashboard": "dashboard",
  "/customers": "customers",
  "/appointments": "appointments",
  "/online-booking": "online_booking",
  "/queue": "queue",
  "/pos": "pos",
  "/sales": "sales",
  "/services": "services",
  "/products": "products",
  "/chairs": "chairs",
  "/staff": "staff",
  "/attendance": "attendance",
  "/devices": "devices",
  "/reports": "reports",
  "/finances": "finances",
  "/whatsapp": "whatsapp",
  "/settings": "settings",
};

export type NavPermissionsConfig = Partial<
  Record<MemberRole, Partial<Record<NavKey, boolean>>>
>;

const ALL_TRUE = Object.fromEntries(NAV_KEYS.map((k) => [k, true])) as Record<
  NavKey,
  boolean
>;

/** Built-in defaults — admin overrides merge on top */
export const DEFAULT_NAV_BY_ROLE: Record<MemberRole, Record<NavKey, boolean>> = {
  OWNER: { ...ALL_TRUE },
  ADMIN: { ...ALL_TRUE },
  MANAGER: {
    ...ALL_TRUE,
  },
  CASHIER: {
    dashboard: true,
    customers: true,
    pos: true,
    sales: true,
    appointments: true,
    online_booking: true,
    queue: true,
    services: false,
    products: false,
    chairs: false,
    staff: false,
    attendance: false,
    devices: false,
    reports: false,
    finances: false,
    whatsapp: false,
    settings: false,
  },
  RECEPTIONIST: {
    dashboard: true,
    customers: true,
    appointments: true,
    online_booking: true,
    queue: true,
    whatsapp: true,
    pos: false,
    sales: false,
    services: false,
    products: false,
    chairs: false,
    staff: false,
    attendance: false,
    devices: false,
    reports: false,
    finances: false,
    settings: false,
  },
  STAFF: {
    dashboard: true,
    attendance: true,
    queue: true,
    online_booking: true,
    customers: false,
    appointments: false,
    pos: false,
    sales: false,
    services: false,
    products: false,
    chairs: false,
    staff: false,
    devices: false,
    reports: false,
    finances: false,
    whatsapp: false,
    settings: false,
  },
};

export function getEffectiveNavPermissions(
  role: MemberRole,
  overrides?: NavPermissionsConfig | null
): Record<NavKey, boolean> {
  if (role === "OWNER") return { ...ALL_TRUE };

  const base = { ...DEFAULT_NAV_BY_ROLE[role] };
  const roleOverrides = overrides?.[role];
  if (roleOverrides) {
    for (const key of NAV_KEYS) {
      if (key in roleOverrides && roleOverrides[key] !== undefined) {
        base[key] = roleOverrides[key]!;
      }
    }
  }

  // Admins must keep Settings to manage team and permissions
  if (role === "ADMIN") {
    base.settings = true;
  }

  return base;
}

export function canAccessNavKey(
  role: MemberRole,
  key: NavKey,
  overrides?: NavPermissionsConfig | null
): boolean {
  return getEffectiveNavPermissions(role, overrides)[key];
}

export function pathnameToNavKey(pathname: string): NavKey | null {
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return HREF_TO_NAV_KEY[base] ?? null;
}

export function canAccessPath(
  role: MemberRole,
  pathname: string,
  overrides?: NavPermissionsConfig | null
): boolean {
  const key = pathnameToNavKey(pathname);
  if (!key) return true;
  return canAccessNavKey(role, key, overrides);
}

export function filterNavGroupsForRole(
  role: MemberRole,
  overrides?: NavPermissionsConfig | null
): NavGroup[] {
  const permissions = getEffectiveNavPermissions(role, overrides);

  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const key = HREF_TO_NAV_KEY[item.href];
        return key ? permissions[key] : true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** First sidebar route the role may access — used when blocking direct URL access */
export function getDefaultLandingPath(
  role: MemberRole,
  overrides?: NavPermissionsConfig | null
): string {
  const filtered = filterNavGroupsForRole(role, overrides);
  const first = filtered[0]?.items[0]?.href;
  return first ?? "/dashboard";
}

export const CONFIGURABLE_ROLES: MemberRole[] = [
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "RECEPTIONIST",
  "STAFF",
];
