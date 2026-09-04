import { formatCurrency, formatDateTime } from "@/lib/format";
import { BRAND } from "@/lib/marketing/brand";
import { buildWhatsAppSendUrl } from "@/lib/whatsapp/links";

export type OnlineBookingWhatsAppDetails = {
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  staffName: string;
  scheduledAt: string;
  services: { name: string; price: number }[];
  advanceAmount?: number;
  pendingApproval: boolean;
};

/** Message the customer sends to the salon after booking (opens their WhatsApp). */
export function buildOnlineBookingSalonNotifyMessage(details: OnlineBookingWhatsAppDetails): string {
  const services =
    details.services.length > 0
      ? details.services.map((s) => `• ${s.name} (${formatCurrency(s.price)})`).join("\n")
      : "• (services to confirm in salon)";

  const advanceLine =
    details.advanceAmount && details.advanceAmount > 0
      ? details.pendingApproval
        ? `Advance: ${formatCurrency(details.advanceAmount)} (screenshot uploaded — please verify)`
        : `Advance: ${formatCurrency(details.advanceAmount)}`
      : "Advance: none";

  return [
    `Hi ${BRAND.name}, I just submitted an online booking.`,
    "",
    `Booking No: ${details.bookingNumber}`,
    `Name: ${details.customerName}`,
    `Phone: ${details.customerPhone}`,
    details.staffName ? `Stylist: ${details.staffName}` : null,
    `Visit: ${formatDateTime(details.scheduledAt)}`,
    "",
    "Services:",
    services,
    "",
    advanceLine,
    details.pendingApproval
      ? "Please confirm my appointment after payment verification. Thank you!"
      : "Looking forward to my visit. Thank you!",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function getOnlineBookingSalonWhatsAppUrl(
  details: OnlineBookingWhatsAppDetails
): string | null {
  return buildWhatsAppSendUrl(
    BRAND.phoneMobile,
    buildOnlineBookingSalonNotifyMessage(details)
  );
}
