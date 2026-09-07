import { BRAND } from "@/lib/marketing/brand";

export type WhatsAppTemplateId =
  | "thanks"
  | "service"
  | "response"
  | "feedback"
  | "reminder"
  | "welcome";

export type WhatsAppTemplateInput = {
  firstName?: string | null;
  fullName?: string | null;
};

export type WhatsAppTemplateMeta = {
  id: WhatsAppTemplateId;
  label: string;
  description: string;
};

export const WHATSAPP_TEMPLATES: WhatsAppTemplateMeta[] = [
  {
    id: "thanks",
    label: "Thank you",
    description: "Warm thanks after a visit",
  },
  {
    id: "service",
    label: "Service offer",
    description: "Highlight services and invite booking",
  },
  {
    id: "response",
    label: "Customer reply",
    description: "Reply to a WhatsApp inquiry",
  },
  {
    id: "feedback",
    label: "Feedback request",
    description: "Ask how their experience was",
  },
  {
    id: "reminder",
    label: "Visit reminder",
    description: "Gentle nudge to book again",
  },
  {
    id: "welcome",
    label: "Welcome",
    description: "Welcome a new or returning guest",
  },
];

function resolveFirstName(input: WhatsAppTemplateInput): string | null {
  const fromFirst = input.firstName?.trim();
  if (fromFirst) return fromFirst;
  const fromFull = input.fullName?.trim().split(/\s+/)[0];
  return fromFull || null;
}

function greeting(input: WhatsAppTemplateInput): string {
  const firstName = resolveFirstName(input);
  return firstName ? `Assalam o Alaikum ${firstName},` : "Assalam o Alaikum,";
}

function contactBlock(): string {
  const hoursLine = BRAND.hours.map((h) => `${h.days}: ${h.time}`).join("\n");
  return `📍 ${BRAND.address}
📞 ${BRAND.phone}
🕐 Opening hours:
${hoursLine}`;
}

function signOff(): string {
  return `Warm regards,
Team ${BRAND.name}`;
}

function buildThanksMessage(input: WhatsAppTemplateInput): string {
  return `${greeting(input)}

Thank you so much for choosing *${BRAND.name}*. It truly means a lot to us that you trusted our team with your hair and beauty care.

We hope you loved your experience with us — from the moment you walked in, to the care our stylists gave you. Your comfort and confidence are always our priority, and we work hard to make every visit feel special.

If you were happy with your service, we would be grateful if you shared your feedback with friends and family, or left us a kind word. It helps other guests find us and encourages our team to keep improving.

We would love to welcome you again soon for your next haircut, color, treatment, or styling appointment. You can book online anytime, or simply message us here on WhatsApp and we will gladly arrange a convenient slot for you.

${contactBlock()}

Once again, thank you for being part of the ${BRAND.name} family. We look forward to seeing you again!

${signOff()}`;
}

function buildServiceMessage(input: WhatsAppTemplateInput): string {
  return `${greeting(input)}

Thank you for your interest in *${BRAND.name}*.

We offer a full range of hair and beauty services, including:

• Signature haircuts tailored to your face and lifestyle
• Color, highlights, and balayage
• Keratin and deep treatments
• Bridal and occasion styling

If you share what you are looking for (for example haircut, color, treatment, or bridal), we will recommend the best option and available time slots for you.

You can reply here on WhatsApp, or visit us at:

${contactBlock()}

We look forward to taking care of you!

${signOff()}`;
}

function buildResponseMessage(input: WhatsAppTemplateInput): string {
  return `${greeting(input)}

Thank you for messaging *${BRAND.name}*.

We have received your message and are happy to help. Please share a few details so we can assist you quickly:

• What service are you interested in?
• Preferred day or time?
• Any stylist preference?

Once we have this, we will confirm availability and guide you for booking.

${contactBlock()}

${signOff()}`;
}

function buildFeedbackMessage(input: WhatsAppTemplateInput): string {
  return `${greeting(input)}

Thank you again for visiting *${BRAND.name}*.

We hope you had a wonderful experience with our team. Your feedback means a lot to us — if you have a moment, please tell us how everything went (service quality, wait time, cleanliness, and overall comfort).

If anything could have been better, please let us know here on WhatsApp so we can improve. And if you were happy with your visit, a kind word or recommendation to friends and family would truly help us.

${contactBlock()}

Thank you for supporting ${BRAND.name}.

${signOff()}`;
}

function buildReminderMessage(input: WhatsAppTemplateInput): string {
  return `${greeting(input)}

This is a friendly reminder from *${BRAND.name}*.

It has been a while since your last visit, and we would love to see you again for a fresh cut, touch-up, treatment, or styling session.

If you would like to book, just reply with your preferred day and service, and we will arrange a convenient slot for you.

${contactBlock()}

We look forward to welcoming you soon!

${signOff()}`;
}

function buildWelcomeMessage(input: WhatsAppTemplateInput): string {
  return `${greeting(input)}

Welcome to *${BRAND.name}* — we are delighted to have you with us.

Our team is here to help with haircuts, color, treatments, bridal styling, and everyday grooming, always with care and attention to detail.

Whenever you are ready to book, simply message us on WhatsApp with the service you need and your preferred time. We will gladly guide you.

${contactBlock()}

Once again, welcome to the ${BRAND.name} family!

${signOff()}`;
}

export function buildWhatsAppTemplateMessage(
  templateId: WhatsAppTemplateId,
  input: WhatsAppTemplateInput = {}
): string {
  switch (templateId) {
    case "service":
      return buildServiceMessage(input);
    case "response":
      return buildResponseMessage(input);
    case "feedback":
      return buildFeedbackMessage(input);
    case "reminder":
      return buildReminderMessage(input);
    case "welcome":
      return buildWelcomeMessage(input);
    case "thanks":
    default:
      return buildThanksMessage(input);
  }
}

export function getWhatsAppTemplateMeta(
  templateId: WhatsAppTemplateId
): WhatsAppTemplateMeta {
  return (
    WHATSAPP_TEMPLATES.find((template) => template.id === templateId) ??
    WHATSAPP_TEMPLATES[0]
  );
}
