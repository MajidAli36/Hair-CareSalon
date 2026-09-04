import { BRAND } from "@/lib/marketing/brand";

type ThanksMessageInput = {
  firstName?: string | null;
  fullName?: string | null;
};

function resolveFirstName(input: ThanksMessageInput): string | null {
  const fromFirst = input.firstName?.trim();
  if (fromFirst) return fromFirst;
  const fromFull = input.fullName?.trim().split(/\s+/)[0];
  return fromFull || null;
}

/**
 * Warm, detailed thank-you message for WhatsApp (wa.me text=).
 * Keep wording natural for Pakistani salon guests.
 */
export function buildCustomerThanksMessage(input: ThanksMessageInput = {}): string {
  const firstName = resolveFirstName(input);
  const greeting = firstName ? `Assalam o Alaikum ${firstName},` : "Assalam o Alaikum,";

  const hoursLine = BRAND.hours.map((h) => `${h.days}: ${h.time}`).join("\n");

  return `${greeting}

Thank you so much for choosing *${BRAND.name}*. It truly means a lot to us that you trusted our team with your hair and beauty care.

We hope you loved your experience with us — from the moment you walked in, to the care our stylists gave you. Your comfort and confidence are always our priority, and we work hard to make every visit feel special.

If you were happy with your service, we would be grateful if you shared your feedback with friends and family, or left us a kind word. It helps other guests find us and encourages our team to keep improving.

We would love to welcome you again soon for your next haircut, color, treatment, or styling appointment. You can book online anytime, or simply message us here on WhatsApp and we will gladly arrange a convenient slot for you.

📍 ${BRAND.address}
📞 ${BRAND.phone}
🕐 Opening hours:
${hoursLine}

Once again, thank you for being part of the ${BRAND.name} family. We look forward to seeing you again!

Warm regards,
Team ${BRAND.name}`;
}
