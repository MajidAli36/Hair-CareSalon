import type { PaymentMethod, SaleItemType } from "@/types/commerce";

/** Statuses that count toward revenue / COGS / customer spend. */
export const POSTED_SALE_STATUSES = ["COMPLETED", "AMENDED"] as const;
export type PostedSaleStatus = (typeof POSTED_SALE_STATUSES)[number];

export type SaleLifecycleStatus =
  | "DRAFT"
  | "COMPLETED"
  | "AMENDED"
  | "VOID"
  | "REFUNDED";

export function isPostedSaleStatus(status: string): boolean {
  return (POSTED_SALE_STATUSES as readonly string[]).includes(status);
}

export type SaleVersionSnapshot = {
  versionNumber: number;
  customerId: string | null;
  appointmentId: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  depositApplied: number;
  total: number;
  paymentTotal: number;
  status: string;
  notes: string | null;
  changeReason: string | null;
  items: {
    itemType: SaleItemType;
    itemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

export type RefundInput = {
  amount: number;
  method: PaymentMethod;
  reason: string;
  reference?: string | null;
};
