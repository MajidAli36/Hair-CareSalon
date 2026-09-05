"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit/log";
import {
  FEEDBACK_DIMENSIONS,
  IMPROVEMENT_THRESHOLD,
  average,
  averageExact,
  type FeedbackDimensionKey,
} from "@/lib/feedback/dimensions";
import { endOfLocalDay, getLocalDateString, startOfLocalDay } from "@/lib/dates/local";
import type { ActionResult } from "@/types/commerce";

const ratingField = z.coerce.number().int().min(0).max(10);

const submitSchema = z.object({
  customer_id: z.string().uuid().optional().or(z.literal("")),
  walk_in_name: z.string().max(120).optional(),
  staff_id: z.string().uuid().optional().or(z.literal("")),
  rating_overall: ratingField,
  rating_behaviour: ratingField,
  rating_expertise: ratingField,
  rating_service: ratingField,
  rating_cleanliness: ratingField,
  rating_value: ratingField,
  rating_wait_time: ratingField,
  comment: z.string().max(2000).optional(),
});

export type FeedbackListItem = {
  id: string;
  customerName: string;
  isWalkIn: boolean;
  staffName: string | null;
  overall: number;
  averageScore: number;
  averageScoreExact: number;
  comment: string | null;
  createdAt: string;
  ratings: Record<FeedbackDimensionKey, number>;
};

export type FeedbackDashboard = {
  from: string;
  to: string;
  totalResponses: number;
  overallAverage: number;
  overallExperienceAverage: number;
  dimensionAverages: {
    key: FeedbackDimensionKey;
    label: string;
    average: number;
    needsImprovement: boolean;
  }[];
  needsImprovement: {
    key: FeedbackDimensionKey;
    label: string;
    average: number;
  }[];
  recent: FeedbackListItem[];
  lowScores: FeedbackListItem[];
};

function emptyRatings(): number[] {
  return [];
}

export async function submitCustomerFeedback(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("RECEPTIONIST");
  // Cashiers are above receptionist in hierarchy — also allow explicit cashier path
  // requireMinimumRole("RECEPTIONIST") already allows CASHIER+ 

  const parsed = submitSchema.safeParse({
    customer_id: formData.get("customer_id") || "",
    walk_in_name: formData.get("walk_in_name") || undefined,
    staff_id: formData.get("staff_id") || "",
    rating_overall: formData.get("rating_overall"),
    rating_behaviour: formData.get("rating_behaviour"),
    rating_expertise: formData.get("rating_expertise"),
    rating_service: formData.get("rating_service"),
    rating_cleanliness: formData.get("rating_cleanliness"),
    rating_value: formData.get("rating_value"),
    rating_wait_time: formData.get("rating_wait_time"),
    comment: formData.get("comment") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid feedback" };
  }

  const customerId = parsed.data.customer_id || null;
  const walkInName = parsed.data.walk_in_name?.trim() || null;
  const isWalkIn = !customerId;

  if (isWalkIn && !walkInName) {
    return { error: "Enter a walk-in name, or select a customer" };
  }
  if (!isWalkIn && walkInName) {
    // Prefer linked customer; ignore walk-in name
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", org.organizationId)
      .eq("id", customerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!customer) return { error: "Customer not found" };
  }

  const staffId = parsed.data.staff_id || null;
  if (staffId) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("organization_id", org.organizationId)
      .eq("id", staffId)
      .maybeSingle();
    if (!staff) return { error: "Staff member not found" };
  }

  const { data: row, error } = await supabase
    .from("customer_feedback")
    .insert({
      organization_id: org.organizationId,
      customer_id: customerId,
      walk_in_name: isWalkIn ? walkInName : null,
      staff_id: staffId,
      rating_overall: parsed.data.rating_overall,
      rating_behaviour: parsed.data.rating_behaviour,
      rating_expertise: parsed.data.rating_expertise,
      rating_service: parsed.data.rating_service,
      rating_cleanliness: parsed.data.rating_cleanliness,
      rating_value: parsed.data.rating_value,
      rating_wait_time: parsed.data.rating_wait_time,
      comment: parsed.data.comment?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const avg = average([
    parsed.data.rating_overall,
    parsed.data.rating_behaviour,
    parsed.data.rating_expertise,
    parsed.data.rating_service,
    parsed.data.rating_cleanliness,
    parsed.data.rating_value,
    parsed.data.rating_wait_time,
  ]);

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    actorRole: org.role,
    action: "feedback.created",
    entityType: "customer_feedback",
    entityId: row.id,
    metadata: {
      summary: `Feedback ${avg}/10 · ${isWalkIn ? walkInName : "customer"}`,
      average: avg,
      overall: parsed.data.rating_overall,
      customerId,
      walkInName,
      staffId,
    },
  });

  revalidatePath("/feedback");
  revalidatePath("/reports");
  return { success: true };
}

function mapFeedbackRow(row: {
  id: string;
  walk_in_name: string | null;
  comment: string | null;
  created_at: string;
  rating_overall: number;
  rating_behaviour: number;
  rating_expertise: number;
  rating_service: number;
  rating_cleanliness: number;
  rating_value: number;
  rating_wait_time: number;
  customer: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null;
  staff: { full_name: string } | { full_name: string }[] | null;
}): FeedbackListItem {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const staff = Array.isArray(row.staff) ? row.staff[0] : row.staff;
  const ratings: Record<FeedbackDimensionKey, number> = {
    overall: Number(row.rating_overall),
    behaviour: Number(row.rating_behaviour),
    expertise: Number(row.rating_expertise),
    service: Number(row.rating_service),
    cleanliness: Number(row.rating_cleanliness),
    value: Number(row.rating_value),
    wait_time: Number(row.rating_wait_time),
  };
  const values = Object.values(ratings);
  const isWalkIn = !customer;
  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
    : row.walk_in_name?.trim() || "Walk-in";

  return {
    id: row.id,
    customerName,
    isWalkIn,
    staffName: staff?.full_name ?? null,
    overall: ratings.overall,
    averageScore: average(values),
    averageScoreExact: averageExact(values),
    comment: row.comment,
    createdAt: row.created_at,
    ratings,
  };
}

export async function getFeedbackDashboard(
  from?: string,
  to?: string
): Promise<FeedbackDashboard> {
  const org = await requireOrganization();
  const supabase = await createClient();
  const toLabel = to ?? getLocalDateString();
  const fromLabel = from ?? toLabel.slice(0, 7) + "-01";
  const start = startOfLocalDay(fromLabel);
  const end = endOfLocalDay(toLabel);

  const { data, error } = await supabase
    .from("customer_feedback")
    .select(
      `
      id,
      walk_in_name,
      comment,
      created_at,
      rating_overall,
      rating_behaviour,
      rating_expertise,
      rating_service,
      rating_cleanliness,
      rating_value,
      rating_wait_time,
      customer:customers(first_name, last_name),
      staff:staff(full_name)
    `
    )
    .eq("organization_id", org.organizationId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items = (data ?? []).map((row) => mapFeedbackRow(row as never));

  const buckets: Record<FeedbackDimensionKey, number[]> = {
    overall: emptyRatings(),
    behaviour: emptyRatings(),
    expertise: emptyRatings(),
    service: emptyRatings(),
    cleanliness: emptyRatings(),
    value: emptyRatings(),
    wait_time: emptyRatings(),
  };

  for (const item of items) {
    for (const dim of FEEDBACK_DIMENSIONS) {
      buckets[dim.key].push(item.ratings[dim.key]);
    }
  }

  const dimensionAverages = FEEDBACK_DIMENSIONS.map((dim) => {
    const avg = average(buckets[dim.key]);
    return {
      key: dim.key,
      label: dim.label,
      average: avg,
      needsImprovement: items.length > 0 && avg < IMPROVEMENT_THRESHOLD,
    };
  });

  const needsImprovement = dimensionAverages
    .filter((d) => d.needsImprovement)
    .sort((a, b) => a.average - b.average);

  const overallAverage = average(items.map((i) => i.averageScoreExact));
  const overallExperienceAverage = average(buckets.overall);

  return {
    from: fromLabel,
    to: toLabel,
    totalResponses: items.length,
    overallAverage,
    overallExperienceAverage,
    dimensionAverages,
    needsImprovement,
    recent: items.slice(0, 20),
    lowScores: items.filter((i) => i.averageScore < IMPROVEMENT_THRESHOLD).slice(0, 10),
  };
}
