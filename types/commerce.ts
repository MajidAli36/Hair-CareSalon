export type ActionResult = {
  error?: string;
  success?: boolean;
  recordDate?: string;
};

export type SaleItemType = "SERVICE" | "PRODUCT" | "PACKAGE";
export type PaymentMethod = "CASH" | "CARD" | "OTHER";
export type SaleStatus = "DRAFT" | "COMPLETED" | "AMENDED" | "VOID" | "REFUNDED";
export type SalePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type CartItem = {
  itemType: SaleItemType;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type CheckoutPaymentLine = {
  amount: number;
  method: PaymentMethod;
};

export type CheckoutPayload = {
  items: CartItem[];
  customerId?: string | null;
  appointmentId?: string | null;
  /** Primary stylist (first selected) — kept for receipts / legacy */
  staffId?: string | null;
  /** All stylists who served on this sale (equal-share reports) */
  staffIds?: string[];
  discount: number;
  /** Optional flat tax amount in PKR — omit or 0 when not applied */
  tax?: number;
  /** Primary method when using single amountReceived */
  paymentMethod: PaymentMethod;
  /** Amount collected now (partial allowed for named customers). Defaults to full due. */
  amountReceived?: number;
  /** Split tender lines; if set, overrides amountReceived */
  payments?: CheckoutPaymentLine[];
  /** Cash tendered (for change); optional */
  tenderedAmount?: number;
  /** Explicit unpaid/credit sale — requires manager */
  allowUnpaid?: boolean;
  notes?: string;
};
