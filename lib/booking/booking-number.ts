/** Fallback when booking_number column is missing or null. */
export function bookingNumberFromId(appointmentId: string): string {
  return `BK-${appointmentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function displayBookingNumber(
  bookingNumber: string | null | undefined,
  appointmentId: string
): string {
  return bookingNumber?.trim() || bookingNumberFromId(appointmentId);
}
