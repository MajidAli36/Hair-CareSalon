"use server";

import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/marketing/brand";
import {
  renderAppointmentReceiptHtml,
  renderSaleReceiptHtml,
  renderTokenReceiptHtml,
  type AppointmentReceiptInput,
  type SaleReceiptInput,
  type TokenReceiptInput,
} from "@/lib/print/thermal-html";
import { getSale } from "@/lib/actions/sales";
import { displayBookingNumber } from "@/lib/booking/booking-number";
import { formatCustomerName, formatDate, formatTime } from "@/lib/format";

async function getBusinessInfo() {
  return {
    name: BRAND.name,
    address: BRAND.address,
    phone: BRAND.phone,
    phonePtcl: BRAND.phonePtcl,
    phoneMobile: BRAND.phoneMobile,
  };
}

function nowParts() {
  const now = new Date();
  return {
    date: formatDate(now),
    time: formatTime(now),
  };
}

export async function getSaleReceiptHtml(saleId: string): Promise<string | null> {
  await requireOrganization();
  const sale = await getSale(saleId);
  if (!sale || (sale.status !== "COMPLETED" && sale.status !== "AMENDED")) return null;

  const business = await getBusinessInfo();
  const customer = sale.customer as {
    first_name: string;
    last_name: string | null;
    phone: string | null;
  } | null;
  const items = (sale.items ?? []) as {
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  const invoice = sale.invoice as
    | { invoice_number: string; issued_at: string }
    | { invoice_number: string; issued_at: string }[]
    | null;
  const invoiceData = Array.isArray(invoice) ? invoice[0] : invoice;
  const payments = (sale.payments ?? []) as {
    method: string;
    amount: number;
    change_given?: number | null;
    reference?: string | null;
  }[];
  const completedAt = sale.completed_at ? new Date(sale.completed_at) : new Date();
  const saleAny = sale as { amount_paid?: number; amount_due?: number; amount_refunded?: number };
  const amountPaid =
    saleAny.amount_paid != null
      ? Number(saleAny.amount_paid)
      : payments.reduce((s, p) => s + Number(p.amount), 0);
  const amountDue =
    saleAny.amount_due != null
      ? Number(saleAny.amount_due)
      : Math.max(0, Number(sale.total) - amountPaid + Number(saleAny.amount_refunded ?? 0));
  const changeGiven = payments.reduce((s, p) => s + (Number(p.change_given) || 0), 0);
  const tenderMethods = payments
    .filter((p) => p.reference !== "APPOINTMENT_DEPOSIT")
    .map((p) => p.method);

  const data: SaleReceiptInput = {
    business,
    invoiceNumber: invoiceData?.invoice_number ?? `SALE-${sale.id.slice(0, 8)}`,
    date: formatDate(completedAt),
    time: formatTime(completedAt),
    customerName: customer
      ? formatCustomerName(customer.first_name, customer.last_name)
      : null,
    customerPhone: customer?.phone ?? null,
    items: items.map((i) => ({
      name: i.name,
      qty: i.quantity,
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
    })),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    tax: Number(sale.tax ?? 0),
    depositApplied: Number(sale.deposit_applied ?? 0),
    total: Number(sale.total),
    paymentMethod: tenderMethods[0] ?? payments[0]?.method ?? "CASH",
    amountPaid,
    amountDue,
    changeGiven,
  };

  return renderSaleReceiptHtml(data);
}

export async function getTokenReceiptHtml(input: {
  tokenNumber: number;
  customerName: string;
  customerPhone?: string | null;
  staffName?: string | null;
  chair?: string | null;
  queueDate?: string;
  issuedAt?: string;
}): Promise<string> {
  await requireOrganization();
  const business = await getBusinessInfo();
  const parts = input.issuedAt
    ? (() => {
        const d = new Date(input.issuedAt);
        return {
          date: formatDate(d),
          time: formatTime(d),
        };
      })()
    : nowParts();

  const data: TokenReceiptInput = {
    business,
    tokenNumber: input.tokenNumber,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    staffName: input.staffName,
    chair: input.chair,
    queueDate: input.queueDate ?? parts.date,
    date: parts.date,
    time: parts.time,
  };

  return renderTokenReceiptHtml(data);
}

export async function getAppointmentReceiptHtml(
  appointmentId: string
): Promise<string | null> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, source, customer_id, staff_id, booking_number")
    .eq("id", appointmentId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!appt) return null;

  const [{ data: customer }, { data: staff }, { data: services }, { data: deposits }] =
    await Promise.all([
      appt.customer_id
        ? supabase
            .from("customers")
            .select("first_name, last_name, phone")
            .eq("id", appt.customer_id)
            .single()
        : Promise.resolve({ data: null }),
      appt.staff_id
        ? supabase.from("staff").select("full_name").eq("id", appt.staff_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("appointment_services")
        .select("service_name, price")
        .eq("appointment_id", appointmentId),
      supabase
        .from("appointment_deposits")
        .select("amount, status")
        .eq("appointment_id", appointmentId),
    ]);

  const business = await getBusinessInfo();
  const advance = (deposits ?? [])
    .filter((d) => d.status === "APPROVED")
    .reduce((s, d) => s + Number(d.amount), 0);
  const pendingApproval = (deposits ?? []).some((d) => d.status === "PENDING");

  const data: AppointmentReceiptInput = {
    business,
    bookingNumber: displayBookingNumber(
      (appt as { booking_number?: string | null }).booking_number,
      appt.id
    ),
    customerName: customer
      ? formatCustomerName(customer.first_name, customer.last_name)
      : "Customer",
    customerPhone: customer?.phone ?? null,
    staffName: staff?.full_name ?? null,
    services: (services ?? []).map((s) => ({
      name: s.service_name,
      price: Number(s.price),
    })),
    scheduledAt: appt.scheduled_at,
    source: appt.source,
    status: appt.status,
    advanceAmount: advance > 0 ? advance : undefined,
    pendingApproval,
  };

  return renderAppointmentReceiptHtml(data);
}
