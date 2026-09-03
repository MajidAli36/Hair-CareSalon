export type ActionResult = {
  error?: string;
  success?: boolean;
  recordDate?: string;
  /** wa.me URL to open WhatsApp Web/App (fallback when not linked) */
  waUrl?: string;
  /** How the outbound message was delivered */
  sentVia?: "linked" | "wa_me" | "queued";
  /** 1-based position when queued for linked send */
  queuePosition?: number;
  /** Rough wait until this message is expected to send */
  estimatedWaitSeconds?: number;
};

export type SaleItemType = "SERVICE" | "PRODUCT" | "PACKAGE";
export type PaymentMethod = "CASH" | "CARD" | "OTHER";
export type SaleStatus = "DRAFT" | "COMPLETED" | "VOID";

export type CartItem = {
  itemType: SaleItemType;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type CheckoutPayload = {
  items: CartItem[];
  customerId?: string | null;
  appointmentId?: string | null;
  discount: number;
  /** Optional flat tax amount in PKR — omit or 0 when not applied */
  tax?: number;
  paymentMethod: PaymentMethod;
  notes?: string;
};
