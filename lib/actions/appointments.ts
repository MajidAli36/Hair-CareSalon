"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/log";
import { queueDeviceCommand, findDeviceByType } from "@/lib/devices/helpers";
import { queueOpenCashDrawer } from "@/lib/devices/cash-drawer";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { validateAppointmentSlot } from "@/lib/actions/scheduling";
import { assertCanAddDeposit, syncAppointmentAfterDepositChange } from "@/lib/actions/deposits";
import { sumServiceDuration } from "@/lib/booking/availability";
import { getDayRange } from "@/lib/booking/dates";
import { calculateRequiredAdvance, sumServicePrices } from "@/lib/booking/pricing";
import {
  bookingNumberFromId,
  displayBookingNumber,
} from "@/lib/booking/booking-number";
import { getDepositProofSignedUrl, uploadDepositProof } from "@/lib/storage/deposit-proofs";
import type { ActionResult } from "@/types/commerce";

export async function createAppointment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("RECEPTIONIST");
  const serviceIds = formData.getAll("service_ids") as string[];
  const scheduledAt = (formData.get("slot_iso") as string) || (formData.get("scheduled_at") as string);
  const customerId = formData.get("customer_id") as string;
  const staffId =
    (formData.get("slot_staff_id") as string) ||
    ((formData.get("staff_id") as string) !== "none" ? (formData.get("staff_id") as string) : null);

  if (!customerId || !scheduledAt) return { error: "Customer and time slot required" };

  const supabase = await createClient();

  let durationMinutes = Number(formData.get("duration_minutes") ?? 30);
  if (serviceIds.length > 0) {
    const { data: svc } = await supabase
      .from("services")
      .select("duration_minutes")
      .in("id", serviceIds)
      .eq("organization_id", org.organizationId);
    durationMinutes = sumServiceDuration(svc ?? [], durationMinutes);
  }

  const slotCheck = await validateAppointmentSlot({
    organizationId: org.organizationId,
    scheduledAt: new Date(scheduledAt).toISOString(),
    durationMinutes,
    staffId: staffId || null,
  });
  if (!slotCheck.ok) return { error: slotCheck.error };

  const { data: appt, error } = await supabase
    .from("appointments")
    .insert({
      organization_id: org.organizationId,
      customer_id: customerId,
      staff_id: staffId || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: durationMinutes,
      source: "STAFF",
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error || !appt) return { error: error?.message ?? "Failed to create appointment" };

  if (serviceIds.length > 0) {
    const { data: services } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .in("id", serviceIds)
      .eq("organization_id", org.organizationId);

    if (services?.length) {
      await supabase.from("appointment_services").insert(
        services.map((s) => ({
          organization_id: org.organizationId,
          appointment_id: appt.id,
          service_id: s.id,
          service_name: s.name,
          price: s.price,
          duration_minutes: s.duration_minutes,
        }))
      );
    }
  }

  const advanceAmount = Number(formData.get("advance_amount") ?? 0);
  const advanceMethod = (formData.get("advance_method") as "CASH" | "CARD" | "OTHER") || "CASH";
  if (advanceAmount > 0) {
    const canAdd = await assertCanAddDeposit(appt.id, org.organizationId, advanceAmount);
    if (canAdd.error) return { error: canAdd.error };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: depositError } = await supabase.from("appointment_deposits").insert({
      organization_id: org.organizationId,
      appointment_id: appt.id,
      amount: advanceAmount,
      method: advanceMethod,
      notes: (formData.get("advance_notes") as string) || "Advance at booking",
      created_by: user?.id ?? null,
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    });

    if (depositError) return { error: depositError.message };

    await supabase
      .from("appointments")
      .update({ status: "CONFIRMED" })
      .eq("id", appt.id);

    if (advanceMethod === "CASH") {
      await queueOpenCashDrawer(org.organizationId, { reason: "appointment_advance" });
    }
  }

  revalidatePath("/appointments");
  revalidatePath("/appointments/new");
  revalidatePath("/finances");
  redirect("/appointments");
}

export async function checkInAppointment(appointmentId: string): Promise<ActionResult & { tokenNumber?: number }> {
  const org = await requireMinimumRole("RECEPTIONIST");
  const supabase = await createClient();

  const { data: appt, error: fetchErr } = await supabase
    .from("appointments")
    .select("*, customer:customers(first_name, last_name)")
    .eq("id", appointmentId)
    .eq("organization_id", org.organizationId)
    .single();

  if (fetchErr || !appt) return { error: "Appointment not found" };

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({ status: "CHECKED_IN" })
    .eq("id", appointmentId);

  if (updateErr) return { error: updateErr.message };

  const customer = appt.customer as unknown as { first_name: string; last_name: string | null } | null;
  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
    : "Customer";

  const { data: tokenNum } = await supabase.rpc("next_queue_token_number", {
    org_id: org.organizationId,
  });

  const tokenNumber = tokenNum ?? 1;

  const { data: token, error: tokenErr } = await supabase
    .from("queue_tokens")
    .insert({
      organization_id: org.organizationId,
      token_number: tokenNumber,
      customer_id: appt.customer_id,
      appointment_id: appointmentId,
      customer_name: customerName,
      staff_id: appt.staff_id ?? null,
      issued_at: new Date().toISOString(),
    })
    .select("token_number")
    .single();

  if (tokenErr) return { error: tokenErr.message };

  const printerId = await findDeviceByType(org.organizationId, "PRINTER");
  const kioskId = await findDeviceByType(org.organizationId, "TOKEN_KIOSK");
  const targetDevice = kioskId ?? printerId;
  if (targetDevice) {
    await queueDeviceCommand(org.organizationId, targetDevice, "PRINT_TOKEN", {
      tokenNumber: token?.token_number ?? tokenNumber,
      customerName,
      appointmentId,
    });
  }

  revalidatePath("/appointments");
  revalidatePath("/queue");
  return { success: true, tokenNumber: token?.token_number ?? tokenNumber };
}

export async function recordManualAppointmentPayment(
  appointmentId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("CASHIER");
  const amount = Number(formData.get("amount"));
  const method = formData.get("method") as "CASH" | "CARD" | "OTHER";
  const notes = (formData.get("notes") as string) || null;

  if (!amount || amount <= 0) return { error: "Invalid amount" };

  const canAdd = await assertCanAddDeposit(appointmentId, org.organizationId, amount);
  if (canAdd.error) return { error: canAdd.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("appointment_deposits").insert({
    organization_id: org.organizationId,
    appointment_id: appointmentId,
    amount,
    method,
    notes: notes ?? "Manual payment",
    created_by: user?.id ?? null,
    status: "APPROVED",
    approved_at: new Date().toISOString(),
    approved_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  await supabase
    .from("appointments")
    .update({ status: "CONFIRMED" })
    .eq("id", appointmentId)
    .eq("organization_id", org.organizationId);

  // Keep legacy column in sync for older views
  await supabase
    .from("appointments")
    .update({
      manual_payment_amount: amount,
      manual_payment_method: method,
      manual_payment_notes: notes,
      manual_payment_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("organization_id", org.organizationId);

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "appointment.manual_payment",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { amount, method },
  });

  if (method === "CASH") {
    await queueOpenCashDrawer(org.organizationId, { reason: "manual_payment" });
  }

  revalidatePath("/appointments");
  revalidatePath("/finances");
  return { success: true };
}

export type PosAppointment = {
  id: string;
  customerId: string;
  customerName: string;
  scheduledAt: string;
  status: string;
  depositBalance: number;
  staffId: string | null;
  staffName: string | null;
  services: { serviceId: string; name: string; price: number }[];
};

export async function getAppointmentsForPos(): Promise<PosAppointment[]> {
  const org = await requireMinimumRole("CASHIER");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const [{ data: todayRows }, { data: depositRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select(`
        id,
        customer_id,
        staff_id,
        scheduled_at,
        status,
        customer:customers(first_name, last_name),
        staff:staff(full_name),
        services:appointment_services(service_id, service_name, price)
      `)
      .eq("organization_id", org.organizationId)
      .gte("scheduled_at", `${today}T00:00:00`)
      .lte("scheduled_at", `${today}T23:59:59`)
      .not("status", "in", '("COMPLETED","CANCELLED","NO_SHOW")')
      .order("scheduled_at"),
    supabase
      .from("appointment_deposits")
      .select("appointment_id, amount")
      .eq("organization_id", org.organizationId)
      .eq("status", "APPROVED")
      .is("applied_to_sale_id", null),
  ]);

  const depositMap: Record<string, number> = {};
  for (const d of depositRows ?? []) {
    depositMap[d.appointment_id] = (depositMap[d.appointment_id] ?? 0) + Number(d.amount);
  }

  const appointmentIdsWithDeposit = Object.keys(depositMap);
  let depositAppointmentRows: typeof todayRows = [];

  if (appointmentIdsWithDeposit.length > 0) {
    const { data } = await supabase
      .from("appointments")
      .select(`
        id,
        customer_id,
        staff_id,
        scheduled_at,
        status,
        customer:customers(first_name, last_name),
        staff:staff(full_name),
        services:appointment_services(service_id, service_name, price)
      `)
      .eq("organization_id", org.organizationId)
      .in("id", appointmentIdsWithDeposit)
      .gte("scheduled_at", `${since}T00:00:00`)
      .not("status", "in", '("COMPLETED","CANCELLED","NO_SHOW")')
      .order("scheduled_at", { ascending: false });
    depositAppointmentRows = data ?? [];
  }

  const merged = new Map<string, NonNullable<typeof todayRows>[number]>();
  for (const row of todayRows ?? []) merged.set(row.id, row);
  for (const row of depositAppointmentRows) merged.set(row.id, row);

  return Array.from(merged.values())
    .map((row) => {
      const customer = row.customer as unknown as {
        first_name: string;
        last_name: string | null;
      } | null;
      const staff = row.staff as unknown as { full_name: string } | null;
      const services =
        (row.services as unknown as {
          service_id: string;
          service_name: string;
          price: number;
        }[]) ?? [];

      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: customer
          ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
          : "Customer",
        scheduledAt: row.scheduled_at,
        status: row.status,
        depositBalance: depositMap[row.id] ?? 0,
        staffId: row.staff_id ?? null,
        staffName: staff?.full_name ?? null,
        services: services.map((s) => ({
          serviceId: s.service_id,
          name: s.service_name,
          price: Number(s.price),
        })),
      };
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function getCustomerAdvanceAppointments(
  customerId: string
): Promise<PosAppointment[]> {
  const org = await requireMinimumRole("CASHIER");
  const supabase = await createClient();

  const { data: deposits } = await supabase
    .from("appointment_deposits")
    .select("appointment_id, amount")
    .eq("organization_id", org.organizationId)
    .eq("status", "APPROVED")
    .is("applied_to_sale_id", null);

  if (!deposits?.length) return [];

  const depositMap: Record<string, number> = {};
  for (const d of deposits) {
    depositMap[d.appointment_id] = (depositMap[d.appointment_id] ?? 0) + Number(d.amount);
  }

  const ids = Object.keys(depositMap);
  const { data } = await supabase
    .from("appointments")
    .select(`
      id,
      customer_id,
      staff_id,
      scheduled_at,
      status,
      customer:customers(first_name, last_name),
      staff:staff(full_name),
      services:appointment_services(service_id, service_name, price)
    `)
    .eq("organization_id", org.organizationId)
    .eq("customer_id", customerId)
    .in("id", ids)
    .not("status", "in", '("COMPLETED","CANCELLED","NO_SHOW")')
    .order("scheduled_at", { ascending: false });

  return (data ?? []).map((row) => {
    const customer = row.customer as unknown as {
      first_name: string;
      last_name: string | null;
    } | null;
    const staff = row.staff as unknown as { full_name: string } | null;
    const services =
      (row.services as unknown as {
        service_id: string;
        service_name: string;
        price: number;
      }[]) ?? [];

    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: customer
        ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
        : "Customer",
      scheduledAt: row.scheduled_at,
      status: row.status,
      depositBalance: depositMap[row.id] ?? 0,
      staffId: row.staff_id ?? null,
      staffName: staff?.full_name ?? null,
      services: services.map((s) => ({
        serviceId: s.service_id,
        name: s.service_name,
        price: Number(s.price),
      })),
    };
  });
}

export async function getAppointmentDepositTotal(appointmentId: string): Promise<number> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data } = await supabase
    .from("appointment_deposits")
    .select("amount")
    .eq("organization_id", org.organizationId)
    .eq("appointment_id", appointmentId)
    .eq("status", "APPROVED")
    .is("applied_to_sale_id", null);

  return (data ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
}

export async function getAppointments(
  date?: string,
  options?: { source?: "STAFF" | "ONLINE" }
) {
  const org = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select(`
      *,
      customer:customers(id, first_name, last_name, phone, email),
      staff:staff(id, full_name),
      services:appointment_services(service_name, price, duration_minutes)
    `)
    .eq("organization_id", org.organizationId)
    .order("scheduled_at");

  if (date) {
    const { start, end } = getDayRange(date);
    query = query.gte("scheduled_at", start).lt("scheduled_at", end);
  }

  if (options?.source) {
    query = query.eq("source", options.source);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const appointmentIds = rows.map((a) => a.id);
  const depositMap: Record<
    string,
    {
      id: string;
      amount: number;
      status: string;
      method: string;
      notes: string | null;
      payment_reference: string | null;
      proof_path: string | null;
      applied_to_sale_id: string | null;
      refund_reason: string | null;
      refund_method: string | null;
      refunded_at: string | null;
      paid_at: string | null;
    }[]
  > = {};

  if (appointmentIds.length > 0) {
    const { data: deposits } = await supabase
      .from("appointment_deposits")
      .select(
        "id, appointment_id, amount, status, method, notes, payment_reference, proof_path, applied_to_sale_id, refund_reason, refund_method, refunded_at, paid_at"
      )
      .eq("organization_id", org.organizationId)
      .in("appointment_id", appointmentIds);

    for (const d of deposits ?? []) {
      if (!depositMap[d.appointment_id]) depositMap[d.appointment_id] = [];
      depositMap[d.appointment_id].push({
        id: d.id,
        amount: Number(d.amount),
        status: d.status ?? "APPROVED",
        method: d.method,
        notes: d.notes,
        payment_reference: d.payment_reference,
        proof_path: (d as { proof_path?: string | null }).proof_path ?? null,
        applied_to_sale_id: d.applied_to_sale_id,
        refund_reason: d.refund_reason,
        refund_method: d.refund_method,
        refunded_at: d.refunded_at,
        paid_at: d.paid_at,
      });
    }
  }

  return rows.map((row) => ({
    ...row,
    deposits: depositMap[row.id] ?? [],
  })) as unknown as {
    id: string;
    scheduled_at: string;
    status: string;
    source: string;
    manual_payment_amount: number | null;
    deposits: {
      id: string;
      amount: number;
      status: string;
      method: string;
      notes: string | null;
      payment_reference: string | null;
      proof_path: string | null;
      applied_to_sale_id: string | null;
      refund_reason: string | null;
      refund_method: string | null;
      refunded_at: string | null;
      paid_at: string | null;
    }[];
    customer: {
      first_name: string;
      last_name: string | null;
      phone: string | null;
      email: string | null;
    };
    staff: { full_name: string } | null;
    services: { service_name: string; price: number; duration_minutes: number }[];
  }[];
}

export async function createOnlineBooking(input: {
  orgSlug: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  scheduledAt: string;
  staffId: string;
  serviceIds: string[];
  notes?: string;
  advanceAmount?: number;
  advanceMethod?: "CASH" | "CARD" | "OTHER";
  advanceNotes?: string;
  paymentProof?: File | null;
}): Promise<{
  error?: string;
  success?: boolean;
  pendingApproval?: boolean;
  bookingNumber?: string;
  appointmentId?: string;
}> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    return { error: "Online booking is not available. Please contact the salon." };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, booking_advance_amount, booking_advance_percent")
    .eq("slug", input.orgSlug)
    .single();

  if (!org) return { error: "Salon not found" };
  if (!input.staffId) return { error: "Please select a staff member" };

  let durationMinutes = 30;
  if (input.serviceIds.length > 0) {
    const { data: services } = await admin
      .from("services")
      .select("duration_minutes")
      .in("id", input.serviceIds)
      .eq("organization_id", org.id);
    durationMinutes = sumServiceDuration(services ?? [], 30);
  }

  const { data: staffRow } = await admin
    .from("staff")
    .select("id, online_booking_enabled")
    .eq("id", input.staffId)
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .single();

  if (!staffRow?.online_booking_enabled) {
    return { error: "This stylist is not available for online booking." };
  }

  const slotCheck = await validateAppointmentSlot({
    organizationId: org.id,
    scheduledAt: new Date(input.scheduledAt).toISOString(),
    durationMinutes,
    staffId: input.staffId,
    useAdmin: true,
    onlineOnly: true,
  });
  if (!slotCheck.ok) return { error: slotCheck.error };

  let serviceRows: { id: string; name: string; price: number; duration_minutes: number }[] = [];
  if (input.serviceIds.length > 0) {
    const { data: services } = await admin
      .from("services")
      .select("id, name, price, duration_minutes")
      .in("id", input.serviceIds)
      .eq("organization_id", org.id);
    serviceRows = services ?? [];
  }

  const serviceTotal = sumServicePrices(serviceRows);
  const requiredAdvance = calculateRequiredAdvance(serviceTotal, org);

  const proofFile = input.paymentProof;
  const hasProof = Boolean(proofFile && proofFile.size > 0);

  if (requiredAdvance > 0) {
    const paid = Number(input.advanceAmount ?? 0);
    if (paid < requiredAdvance) {
      return {
        error: `Advance of ${requiredAdvance} is required to secure your booking. Please send payment and upload a screenshot.`,
      };
    }
    if (!hasProof) {
      return {
        error: "Please upload a screenshot of your JazzCash, EasyPaisa, or bank payment.",
      };
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (proofFile && !allowed.includes(proofFile.type)) {
      return { error: "Payment proof must be an image (JPG, PNG, or WebP)." };
    }
    if (proofFile && proofFile.size > 5 * 1024 * 1024) {
      return { error: "Payment screenshot must be 5 MB or smaller." };
    }
  }

  let customerId: string;
  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("organization_id", org.id)
    .eq("phone", input.phone)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
  } else {
    const { data: created, error: custErr } = await admin
      .from("customers")
      .insert({
        organization_id: org.id,
        first_name: input.firstName,
        last_name: input.lastName ?? null,
        phone: input.phone,
        email: input.email ?? null,
      })
      .select("id")
      .single();
    if (custErr || !created) return { error: custErr?.message ?? "Failed to create customer" };
    customerId = created.id;
  }

  let bookingNumber: string | null = null;
  try {
    const { data: nextNum } = await admin.rpc("next_booking_number", {
      org_id: org.id,
    });
    if (typeof nextNum === "string" && nextNum.trim()) {
      bookingNumber = nextNum.trim();
    }
  } catch {
    bookingNumber = null;
  }

  const baseAppt = {
    organization_id: org.id,
    customer_id: customerId,
    staff_id: input.staffId,
    scheduled_at: new Date(input.scheduledAt).toISOString(),
    duration_minutes: durationMinutes,
    source: "ONLINE" as const,
    status: "SCHEDULED" as const,
    notes: input.notes ?? null,
  };

  let apptId: string | null = null;
  if (bookingNumber) {
    const withNumber = await admin
      .from("appointments")
      .insert({ ...baseAppt, booking_number: bookingNumber })
      .select("id")
      .single();
    if (!withNumber.error && withNumber.data) {
      apptId = withNumber.data.id;
    } else if (withNumber.error && !/booking_number/i.test(withNumber.error.message)) {
      return { error: withNumber.error.message };
    }
  }

  if (!apptId) {
    const plain = await admin.from("appointments").insert(baseAppt).select("id").single();
    if (plain.error || !plain.data) return { error: plain.error?.message ?? "Booking failed" };
    apptId = plain.data.id;
    bookingNumber = bookingNumberFromId(apptId);
    await admin
      .from("appointments")
      .update({ booking_number: bookingNumber })
      .eq("id", apptId);
  }

  const resolvedBookingNumber = displayBookingNumber(bookingNumber, apptId);
  const appt = { id: apptId };

  if (input.serviceIds.length > 0 && serviceRows.length) {
    await admin.from("appointment_services").insert(
      serviceRows.map((s) => ({
        organization_id: org.id,
        appointment_id: appt.id,
        service_id: s.id,
        service_name: s.name,
        price: s.price,
        duration_minutes: s.duration_minutes,
      }))
    );
  }

  let pendingApproval = false;
  const advancePaid = Number(input.advanceAmount ?? 0);
  if (advancePaid > 0) {
    const needsApproval = requiredAdvance > 0;
    let proofPath: string | null = null;

    if (hasProof && proofFile) {
      const ext =
        proofFile.type === "image/png"
          ? "png"
          : proofFile.type === "image/webp"
            ? "webp"
            : "jpg";
      const bytes = Buffer.from(await proofFile.arrayBuffer());
      const uploaded = await uploadDepositProof({
        organizationId: org.id,
        appointmentId: appt.id,
        bytes,
        contentType: proofFile.type || "image/jpeg",
        extension: ext,
      });
      if (!uploaded.ok) {
        return { error: uploaded.error };
      }
      proofPath = uploaded.result.path;
    }

    const { error: depErr } = await admin.from("appointment_deposits").insert({
      organization_id: org.id,
      appointment_id: appt.id,
      amount: advancePaid,
      method: input.advanceMethod ?? "OTHER",
      notes: input.advanceNotes ?? "Online booking advance",
      payment_reference: null,
      proof_path: proofPath,
      status: needsApproval ? "PENDING" : "APPROVED",
      approved_at: needsApproval ? null : new Date().toISOString(),
    });
    if (depErr) return { error: depErr.message };
    pendingApproval = needsApproval;

    if (needsApproval) {
      await admin
        .from("appointments")
        .update({
          status: "SCHEDULED",
          notes: [input.notes, "[Awaiting advance approval]"].filter(Boolean).join(" "),
        })
        .eq("id", appt.id);
    } else {
      await admin.from("appointments").update({ status: "CONFIRMED" }).eq("id", appt.id);
    }
  } else {
    await admin.from("appointments").update({ status: "CONFIRMED" }).eq("id", appt.id);
  }

  // Log inbound notify for salon WhatsApp inbox / audit trail
  try {
    const staffName =
      (
        await admin.from("staff").select("full_name").eq("id", input.staffId).maybeSingle()
      ).data?.full_name ?? "";
    const serviceNames = serviceRows.map((s) => s.name).join(", ") || "General visit";
    const body = [
      `New online booking ${resolvedBookingNumber}`,
      `From: ${input.firstName}${input.lastName ? ` ${input.lastName}` : ""}`,
      `Phone: ${input.phone}`,
      staffName ? `Stylist: ${staffName}` : null,
      `When: ${new Date(input.scheduledAt).toISOString()}`,
      `Services: ${serviceNames}`,
      pendingApproval ? "Status: awaiting payment confirmation" : "Status: confirmed",
    ]
      .filter(Boolean)
      .join("\n");

    await admin.from("whatsapp_messages").insert({
      organization_id: org.id,
      customer_id: customerId,
      direction: "INBOUND",
      status: "RECEIVED",
      phone: input.phone,
      body,
      metadata: {
        source: "online_booking",
        appointment_id: appt.id,
        booking_number: resolvedBookingNumber,
        pending_approval: pendingApproval,
      },
    });
  } catch {
    // Non-fatal — booking already saved
  }

  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  return {
    success: true,
    pendingApproval,
    bookingNumber: resolvedBookingNumber,
    appointmentId: appt.id,
  };
}

export async function cancelOnlineAppointment(appointmentId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: appt, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, source")
    .eq("id", appointmentId)
    .eq("organization_id", org.organizationId)
    .single();

  if (fetchErr || !appt) return { error: "Appointment not found" };
  if (appt.source !== "ONLINE") return { error: "Only online appointments can be cancelled here" };

  const { error } = await supabase
    .from("appointments")
    .update({ status: "CANCELLED" })
    .eq("id", appointmentId);

  if (error) return { error: error.message };
  revalidatePath("/appointments");
  return { success: true };
}

export async function getOrgBySlug(slug: string) {
  const admin = tryCreateAdminClient();
  if (!admin) return null;

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, slug, booking_slot_minutes, booking_days_ahead, booking_advance_amount, booking_advance_percent, booking_payment_instructions"
    )
    .eq("slug", slug)
    .single();
  if (!org) return null;
  const [{ data: services }, { data: staff }] = await Promise.all([
    admin
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("staff")
      .select("id, full_name, job_title")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .eq("online_booking_enabled", true)
      .order("full_name"),
  ]);
  return {
    ...org,
    services: services ?? [],
    staff: staff ?? [],
  };
}

export async function getBookingAdvanceSettings() {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "booking_advance_amount, booking_advance_percent, booking_payment_instructions"
    )
    .eq("id", org.organizationId)
    .single();
  return data;
}

export async function saveBookingAdvanceSettings(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const amount = Number(formData.get("booking_advance_amount") ?? 0);
  const percent = Number(formData.get("booking_advance_percent") ?? 0);
  const instructions = (formData.get("booking_payment_instructions") as string) || null;

  const { error } = await supabase
    .from("organizations")
    .update({
      booking_advance_amount: amount,
      booking_advance_percent: percent,
      booking_payment_instructions: instructions,
    })
    .eq("id", org.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/book");
  return { success: true };
}

export async function getPendingDepositCount(): Promise<number> {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { count } = await supabase
    .from("appointment_deposits")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.organizationId)
    .eq("status", "PENDING");
  return count ?? 0;
}

export async function approveAppointmentDeposit(depositId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deposit, error: fetchErr } = await supabase
    .from("appointment_deposits")
    .select("id, appointment_id, status")
    .eq("id", depositId)
    .eq("organization_id", org.organizationId)
    .single();

  if (fetchErr || !deposit) return { error: "Deposit not found" };
  if (deposit.status !== "PENDING") return { error: "Deposit is not pending" };

  const { error } = await supabase
    .from("appointment_deposits")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    })
    .eq("id", depositId);

  if (error) return { error: error.message };

  await syncAppointmentAfterDepositChange(deposit.appointment_id, org.organizationId);

  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  revalidatePath("/finances");
  return { success: true };
}

export async function rejectAppointmentDeposit(depositId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: deposit } = await supabase
    .from("appointment_deposits")
    .select("id, appointment_id, status")
    .eq("id", depositId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!deposit) return { error: "Deposit not found" };
  if (deposit.status !== "PENDING") return { error: "Deposit is not pending" };

  const { error } = await supabase
    .from("appointment_deposits")
    .update({ status: "REJECTED" })
    .eq("id", depositId)
    .eq("organization_id", org.organizationId)
    .eq("status", "PENDING");

  if (error) return { error: error.message };

  await supabase
    .from("appointments")
    .update({ status: "CANCELLED" })
    .eq("id", deposit.appointment_id)
    .eq("organization_id", org.organizationId);

  revalidatePath("/appointments");
  revalidatePath("/online-booking");
  return { success: true };
}

export async function getDepositProofUrl(
  depositId: string
): Promise<{ url?: string; error?: string }> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { data: deposit } = await supabase
    .from("appointment_deposits")
    .select("id, proof_path")
    .eq("id", depositId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  const path = (deposit as { proof_path?: string | null } | null)?.proof_path;
  if (!path) return { error: "No payment screenshot on file" };

  return getDepositProofSignedUrl(path);
}
