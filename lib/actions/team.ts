"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { MemberRole } from "@/types";
import type { ActionResult } from "@/types/commerce";

export type TeamMember = {
  id: string;
  userId: string;
  email: string;
  role: MemberRole;
  roleLabel: string;
  joinedAt: string;
};

const inviteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER", "RECEPTIONIST", "STAFF"]),
});

const roleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER", "RECEPTIONIST", "STAFF"]),
});

async function getUserEmail(userId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return userId.slice(0, 8) + "…";
    return data.user.email;
  } catch {
    return userId.slice(0, 8) + "…";
  }
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const org = await requireMinimumRole("ADMIN");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const members = await Promise.all(
    data.map(async (row) => {
      const role = row.role as MemberRole;
      return {
        id: row.id,
        userId: row.user_id,
        email: await getUserEmail(row.user_id),
        role,
        roleLabel: ROLE_LABELS[role],
        joinedAt: row.created_at,
      };
    })
  );

  return members;
}

const resetPasswordSchema = z.object({
  memberId: z.string().uuid(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetTeamMemberPassword(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  const parsed = resetPasswordSchema.safeParse({
    memberId: formData.get("memberId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local to reset passwords." };
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("id", parsed.data.memberId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!member) return { error: "Member not found" };
  if (member.role === "OWNER") return { error: "Cannot reset owner password here" };

  const { error } = await admin.auth.admin.updateUserById(member.user_id, {
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { success: true };
}

export async function inviteTeamMember(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local to invite team members from the app.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const { data: list } = await admin.auth.admin.listUsers();
  let userId = list?.users?.find((u) => u.email?.toLowerCase() === email)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { created_by_admin: true, salon_role: parsed.data.role },
    });
    if (error) return { error: error.message };
    userId = data.user.id;
  }

  const supabase = await createClient();
  const { error: memberError } = await supabase.from("organization_members").upsert(
    {
      organization_id: org.organizationId,
      user_id: userId,
      role: parsed.data.role,
    },
    { onConflict: "organization_id,user_id" }
  );

  if (memberError) return { error: memberError.message };

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateTeamMemberRole(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  const parsed = roleSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("id, role, user_id")
    .eq("id", parsed.data.memberId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!member) return { error: "Member not found" };
  if (member.role === "OWNER") {
    return { error: "Cannot change the owner role" };
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("organization_id", org.organizationId)
    .single();

  if (!member) return { error: "Member not found" };
  if (member.role === "OWNER") {
    return { error: "Cannot remove the organization owner" };
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", org.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/staff");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function canManageTeam(): Promise<boolean> {
  try {
    await requireMinimumRole("ADMIN");
    return true;
  } catch {
    return false;
  }
}
