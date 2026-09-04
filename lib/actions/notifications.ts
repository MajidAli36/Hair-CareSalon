"use server";

import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatCustomerName, formatDateTime } from "@/lib/format";

export type AppNotification = {
  id: string;
  kind: "pending_payment" | "online_booking";
  title: string;
  body: string;
  meta: string;
  href: string;
  createdAt: string;
  actionable: boolean;
};

export type AppNotificationsPayload = {
  badgeCount: number;
  items: AppNotification[];
};

type CustomerBrief = { first_name: string; last_name: string | null; phone: string | null };
type StaffBrief = { full_name: string };

type PendingDepositRow = {
  id: string;
  amount: number;
  created_at: string;
  proof_path: string | null;
  appointment:
    | {
        id: string;
        scheduled_at: string;
        source: string;
        customer: CustomerBrief | CustomerBrief[] | null;
        staff: StaffBrief | StaffBrief[] | null;
      }
    | {
        id: string;
        scheduled_at: string;
        source: string;
        customer: CustomerBrief | CustomerBrief[] | null;
        staff: StaffBrief | StaffBrief[] | null;
      }[]
    | null;
};

type RecentOnlineRow = {
  id: string;
  scheduled_at: string;
  created_at: string;
  status: string;
  customer: CustomerBrief | CustomerBrief[] | null;
  staff: StaffBrief | StaffBrief[] | null;
  services: { service_name: string }[] | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getAppNotifications(): Promise<AppNotificationsPayload> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const since = new Date();
  since.setHours(since.getHours() - 48);

  const [{ data: pendingDepositsRaw }, { data: recentOnlineRaw }] = await Promise.all([
    supabase
      .from("appointment_deposits")
      .select(
        `
        id,
        amount,
        created_at,
        proof_path,
        appointment:appointments(
          id,
          scheduled_at,
          source,
          customer:customers(first_name, last_name, phone),
          staff:staff(full_name)
        )
      `
      )
      .eq("organization_id", org.organizationId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("appointments")
      .select(
        `
        id,
        scheduled_at,
        created_at,
        status,
        customer:customers(first_name, last_name, phone),
        staff:staff(full_name),
        services:appointment_services(service_name)
      `
      )
      .eq("organization_id", org.organizationId)
      .eq("source", "ONLINE")
      .neq("status", "CANCELLED")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Nested selects are valid at runtime; generated Relationships[] makes the client types fail.
  const pendingDeposits = (pendingDepositsRaw ?? []) as unknown as PendingDepositRow[];
  const recentOnline = (recentOnlineRaw ?? []) as unknown as RecentOnlineRow[];

  const pendingItems: AppNotification[] = [];
  const pendingAppointmentIds = new Set<string>();

  for (const row of pendingDeposits) {
    const appt = asOne(row.appointment);
    if (!appt) continue;
    pendingAppointmentIds.add(appt.id);

    const customer = asOne(appt.customer);
    const staff = asOne(appt.staff);
    const customerName = customer
      ? formatCustomerName(customer.first_name, customer.last_name)
      : "Customer";
    const phone = customer?.phone ? ` · ${customer.phone}` : "";
    const stylist = staff?.full_name ? ` with ${staff.full_name}` : "";

    pendingItems.push({
      id: `deposit-${row.id}`,
      kind: "pending_payment",
      title: "Payment proof waiting",
      body: `${customerName}${phone} sent ${formatCurrency(Number(row.amount))}${stylist}`,
      meta: `Visit ${formatDateTime(appt.scheduled_at)}`,
      href: "/online-booking",
      createdAt: row.created_at,
      actionable: true,
    });
  }

  const bookingItems: AppNotification[] = [];

  for (const row of recentOnline) {
    if (pendingAppointmentIds.has(row.id)) continue;

    const customer = asOne(row.customer);
    const staff = asOne(row.staff);
    const services = row.services ?? [];
    const customerName = customer
      ? formatCustomerName(customer.first_name, customer.last_name)
      : "Customer";
    const serviceNames = services.map((s) => s.service_name).filter(Boolean);
    const servicesLabel =
      serviceNames.length > 0 ? serviceNames.slice(0, 2).join(", ") : "Online booking";
    const stylist = staff?.full_name ? ` · ${staff.full_name}` : "";
    const visitDay = row.scheduled_at.slice(0, 10);

    bookingItems.push({
      id: `booking-${row.id}`,
      kind: "online_booking",
      title: "New online booking",
      body: `${customerName} · ${servicesLabel}${stylist}`,
      meta: `Visit ${formatDateTime(row.scheduled_at)}`,
      href: `/online-booking?date=${visitDay}`,
      createdAt: row.created_at,
      actionable: false,
    });
  }

  const items = [...pendingItems, ...bookingItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return {
    badgeCount: pendingItems.length,
    items,
  };
}
