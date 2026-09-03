/** Normalize phone for wa.me (digits only, international). */
export function normalizeWhatsAppPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  // Pakistan mobile: 03XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }

  // Pakistan without leading 0: 3XXXXXXXXX
  if (digits.length === 10 && digits.startsWith("3")) {
    return `92${digits}`;
  }

  // Already international 92...
  if (digits.startsWith("92") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  // Other international numbers (10–15 digits)
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function formatWhatsAppDisplay(input: string): string {
  const normalized = normalizeWhatsAppPhone(input);
  if (!normalized) return input.trim();

  if (normalized.startsWith("92") && normalized.length === 12) {
    return `+92 ${normalized.slice(2, 5)} ${normalized.slice(5)}`;
  }

  return `+${normalized}`;
}

export function buildWhatsAppSendUrl(phone: string, message: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized || !message.trim()) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message.trim())}`;
}

export function buildWhatsAppChatUrl(phone: string, presetMessage?: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  if (presetMessage?.trim()) {
    return `https://wa.me/${normalized}?text=${encodeURIComponent(presetMessage.trim())}`;
  }
  return `https://wa.me/${normalized}`;
}

export function isValidWhatsAppPhone(input: string): boolean {
  return normalizeWhatsAppPhone(input) !== null;
}
