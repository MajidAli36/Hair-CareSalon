import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  CalendarCheck,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShoppingCart,
  Armchair,
  Ticket,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  key: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, key: "dashboard" }],
  },
  {
    label: "Operations",
    items: [
      { title: "Customers", href: "/customers", icon: Users, key: "customers" },
      { title: "Appointments", href: "/appointments", icon: Calendar, key: "appointments" },
      { title: "Online booking", href: "/online-booking", icon: Globe, key: "online_booking" },
      { title: "Queue", href: "/queue", icon: Ticket, key: "queue" },
      { title: "POS", href: "/pos", icon: ShoppingCart, key: "pos" },
      { title: "Sales", href: "/sales", icon: Receipt, key: "sales" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Services", href: "/services", icon: Scissors, key: "services" },
      { title: "Products", href: "/products", icon: Package, key: "products" },
      { title: "Chairs", href: "/chairs", icon: Armchair, key: "chairs" },
    ],
  },
  {
    label: "Team",
    items: [
      { title: "Staff", href: "/staff", icon: UserCog, key: "staff" },
      { title: "Attendance", href: "/attendance", icon: CalendarCheck, key: "attendance" },
      { title: "Devices", href: "/devices", icon: Monitor, key: "devices" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart3, key: "reports" },
      { title: "Finances", href: "/finances", icon: Wallet, key: "finances" },
    ],
  },
  {
    label: "Communication",
    items: [{ title: "WhatsApp", href: "/whatsapp", icon: MessageSquare, key: "whatsapp" }],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/settings", icon: Settings, key: "settings" }],
  },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/appointments": "Appointments",
  "/appointments/new": "Add appointment",
  "/online-booking": "Online booking",
  "/queue": "Queue",
  "/pos": "Point of Sale",
  "/sales": "Sales",
  "/services": "Services",
  "/products": "Products",
  "/chairs": "Chairs",
  "/staff": "Staff",
  "/attendance": "Attendance",
  "/devices": "Devices",
  "/reports": "Reports",
  "/finances": "Finances",
  "/whatsapp": "WhatsApp",
  "/settings": "Settings",
};

export function getPageTitle(pathname: string) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const base = pathname.split("/").slice(0, 2).join("/");
  if (pageTitles[base]) return pageTitles[base];
  return "Hair & Care Salon";
}
