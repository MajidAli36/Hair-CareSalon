"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit/log";
import { getLocalDateString } from "@/lib/dates/local";
import type { ActionResult } from "@/types/commerce";

export type StaffNoteType = "WARNING" | "COMPLAINT" | "PRAISE" | "NOTE";

export type StaffNoteRow = {
  id: string;
  staff_id: string;
  note_type: StaffNoteType;
  title: string;
  details: string | null;
  severity: number;
  occurred_on: string;
  created_at: string;
};

const noteSchema = z.object({
  staff_id: z.string().uuid(),
  note_type: z.enum(["WARNING", "COMPLAINT", "PRAISE", "NOTE"]),
  title: z.string().min(1, "Title is required").max(120),
  details: z.string().max(2000).optional(),
  severity: z.coerce.number().int().min(1).max(3).default(1),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  year_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function createStaffNote(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const parsed = noteSchema.safeParse({
    staff_id: formData.get("staff_id"),
    note_type: formData.get("note_type"),
    title: formData.get("title"),
    details: formData.get("details") || undefined,
    severity: formData.get("severity") || 1,
    occurred_on: formData.get("occurred_on") || getLocalDateString(),
    year_month: formData.get("year_month") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, full_name")
    .eq("organization_id", org.organizationId)
    .eq("id", parsed.data.staff_id)
    .maybeSingle();

  if (!staff) return { error: "Staff member not found" };

  const { data: note, error } = await supabase
    .from("staff_notes")
    .insert({
      organization_id: org.organizationId,
      staff_id: parsed.data.staff_id,
      note_type: parsed.data.note_type,
      title: parsed.data.title.trim(),
      details: parsed.data.details?.trim() || null,
      severity: parsed.data.severity,
      occurred_on: parsed.data.occurred_on,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    actorRole: org.role,
    action: `staff_note.${parsed.data.note_type.toLowerCase()}`,
    entityType: "staff",
    entityId: parsed.data.staff_id,
    metadata: {
      summary: `${parsed.data.note_type}: ${parsed.data.title.trim()}`,
      noteId: note.id,
      noteType: parsed.data.note_type,
      title: parsed.data.title.trim(),
      severity: parsed.data.severity,
      occurredOn: parsed.data.occurred_on,
      staffName: staff.full_name,
    },
  });

  revalidatePath(`/staff/${parsed.data.staff_id}`);
  revalidatePath("/staff");
  revalidatePath("/reports");
  return { success: true };
}

export async function deleteStaffNote(noteId: string, staffId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("MANAGER");
  const supabase = await createClient();

  const { error } = await supabase
    .from("staff_notes")
    .delete()
    .eq("id", noteId)
    .eq("organization_id", org.organizationId)
    .eq("staff_id", staffId);

  if (error) return { error: error.message };

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
  return { success: true };
}
