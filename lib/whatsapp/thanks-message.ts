import {
  buildWhatsAppTemplateMessage,
  type WhatsAppTemplateInput,
} from "@/lib/whatsapp/templates";

type ThanksMessageInput = WhatsAppTemplateInput;

/**
 * Warm, detailed thank-you message for WhatsApp (wa.me text=).
 * Keep wording natural for Pakistani salon guests.
 */
export function buildCustomerThanksMessage(input: ThanksMessageInput = {}): string {
  return buildWhatsAppTemplateMessage("thanks", input);
}
