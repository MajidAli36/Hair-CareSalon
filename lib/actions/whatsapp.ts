"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import {
  buildWhatsAppChatUrl,
  buildWhatsAppSendUrl,
  formatWhatsAppDisplay,
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
} from "@/lib/whatsapp/links";
import { getWhatsAppSessionManager } from "@/lib/whatsapp/session-manager";
import { getWhatsAppSendQueue } from "@/lib/whatsapp/send-queue";
import type { ActionResult } from "@/types/commerce";

const sendSchema = z.object({
  phone: z.string().min(8, "Phone number is required"),
  body: z.string().min(1, "Message is required"),
  customer_id: z.string().optional(),
});

export async function sendWhatsAppMessage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("RECEPTIONIST");
  const parsed = sendSchema.safeParse({
    phone: formData.get("phone"),
    body: formData.get("body"),
    customer_id: formData.get("customer_id") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const normalized = normalizeWhatsAppPhone(parsed.data.phone);
  if (!normalized) {
    return {
      error:
        "Invalid phone number. Use international format, e.g. +923001234567 or 03001234567.",
    };
  }

  const bodyText = parsed.data.body.trim();
  const displayPhone = formatWhatsAppDisplay(normalized);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const manager = getWhatsAppSessionManager();
  const queue = getWhatsAppSendQueue();
  await queue.hydrateFromDatabase();

  // Linked WhatsApp → safe background queue (10–15s between sends)
  if (manager.isConnected()) {
    try {
      // Pre-check limits before inserting PENDING
      const previewStats = queue.getStats();
      if (previewStats.pending >= previewStats.limits.maxQueue) {
        return {
          error: `Send queue is full (${previewStats.limits.maxQueue}). Wait for delivery, then try again.`,
        };
      }

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          organization_id: org.organizationId,
          customer_id: parsed.data.customer_id ?? null,
          direction: "OUTBOUND",
          status: "PENDING",
          phone: displayPhone,
          body: bodyText,
          metadata: {
            source: "baileys_queue",
            normalized_phone: normalized,
            queued_at: new Date().toISOString(),
            gap_seconds: previewStats.gapSeconds,
          },
        })
        .select("id")
        .single();

      if (error) return { error: error.message };

      let enqueued: { position: number; estimatedWaitSeconds: number };
      try {
        enqueued = queue.enqueue({
          id: data.id,
          organizationId: org.organizationId,
          normalizedPhone: normalized,
          body: bodyText,
        });
      } catch (err) {
        await supabase
          .from("whatsapp_messages")
          .update({
            status: "FAILED",
            metadata: {
              source: "baileys_queue",
              normalized_phone: normalized,
              error: err instanceof Error ? err.message : "Queue rejected",
              failed_at: new Date().toISOString(),
            },
          })
          .eq("id", data.id);
        return { error: err instanceof Error ? err.message : "Could not queue message" };
      }

      await writeAuditLog({
        organizationId: org.organizationId,
        userId: user?.id,
        action: "whatsapp.queue",
        entityType: "whatsapp_message",
        entityId: data.id,
        metadata: {
          phone: displayPhone,
          method: "queued",
          position: enqueued.position,
        },
      });

      revalidatePath("/whatsapp");
      return {
        success: true,
        sentVia: "queued",
        queuePosition: enqueued.position,
        estimatedWaitSeconds: enqueued.estimatedWaitSeconds,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to queue WhatsApp message",
      };
    }
  }

  // Fallback: open wa.me when not linked
  const waUrl = buildWhatsAppSendUrl(parsed.data.phone, bodyText);
  if (!waUrl) {
    return { error: "Could not build WhatsApp link. Check phone and message." };
  }

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      organization_id: org.organizationId,
      customer_id: parsed.data.customer_id ?? null,
      direction: "OUTBOUND",
      status: "SENT",
      phone: displayPhone,
      body: bodyText,
      metadata: {
        source: "wa_me",
        wa_url: waUrl,
        normalized_phone: normalized,
        sent_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    organizationId: org.organizationId,
    userId: user?.id,
    action: "whatsapp.send",
    entityType: "whatsapp_message",
    entityId: data.id,
    metadata: { phone: displayPhone, method: "wa_me" },
  });

  revalidatePath("/whatsapp");
  return { success: true, waUrl, sentVia: "wa_me" };
}

export async function getWhatsAppMessages(limit = 50) {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, direction, status, phone, body, created_at")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data as unknown as {
    id: string;
    direction: string;
    status: string;
    phone: string;
    body: string;
    created_at: string;
  }[];
}

export async function getWhatsAppCustomers() {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .not("phone", "is", null)
    .order("first_name")
    .limit(100);
  return data ?? [];
}

export type WhatsAppConfig = {
  organizationName: string;
  organizationSlug: string;
  whatsappPhone: string | null;
  whatsappPhoneNormalized: string | null;
  chatUrl: string | null;
  bookingUrl: string;
  phoneValid: boolean;
};

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const org = await requireOrganization();
  const supabase = await createClient();

  const { data } = await supabase
    .from("organizations")
    .select("name, slug, whatsapp_phone")
    .eq("id", org.organizationId)
    .single();

  const slug = data?.slug ?? "hair-salon";
  const rawPhone = data?.whatsapp_phone ?? null;
  const normalized = rawPhone ? normalizeWhatsAppPhone(rawPhone) : null;
  const phoneValid = rawPhone ? isValidWhatsAppPhone(rawPhone) : false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const bookingUrl = `${siteUrl}/book/${slug}`;

  const preset = `Hi ${data?.name ?? "Hair & Care Salon"}, I'd like to book an appointment.`;
  const chatUrl = rawPhone && phoneValid ? buildWhatsAppChatUrl(rawPhone, preset) : null;

  return {
    organizationName: data?.name ?? org.organizationName,
    organizationSlug: slug,
    whatsappPhone: rawPhone,
    whatsappPhoneNormalized: normalized,
    chatUrl,
    bookingUrl,
    phoneValid,
  };
}

export async function updateWhatsAppPhone(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireMinimumRole("ADMIN");
  const raw = (formData.get("whatsapp_phone") as string)?.trim() || "";

  let phone: string | null = null;
  if (raw) {
    if (!isValidWhatsAppPhone(raw)) {
      return {
        error: "Invalid number. Use +923001234567 or 03001234567 (Pakistan mobile).",
      };
    }
    phone = formatWhatsAppDisplay(raw);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ whatsapp_phone: phone })
    .eq("id", org.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/whatsapp");
  return { success: true };
}
