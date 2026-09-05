/** Centralized invoice/sale calculation — server is source of truth for persistence. */

import type { CartItem, PaymentMethod, SaleItemType } from "@/types/commerce";

export type InvoiceLineInput = {
  itemType: SaleItemType;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: {
    itemType: SaleItemType;
    itemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
};

export function calculateInvoiceTotals(
  items: InvoiceLineInput[],
  discount = 0,
  tax = 0
): InvoiceTotals {
  const lines = items.map((item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    return {
      itemType: item.itemType,
      itemId: item.itemId,
      name: item.name,
      unitPrice,
      quantity,
      lineTotal: roundMoney(unitPrice * quantity),
    };
  });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
  const clampedDiscount = roundMoney(Math.min(Math.max(0, discount), subtotal));
  const clampedTax = roundMoney(Math.max(0, tax));
  const total = roundMoney(Math.max(0, subtotal - clampedDiscount + clampedTax));

  return { subtotal, discount: clampedDiscount, tax: clampedTax, total, lines };
}

export type ProductQtyMap = Map<string, number>;

export function productQtyMap(
  lines: { itemType: string; itemId: string; quantity: number }[]
): ProductQtyMap {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (line.itemType !== "PRODUCT") continue;
    map.set(line.itemId, (map.get(line.itemId) ?? 0) + Number(line.quantity));
  }
  return map;
}

/** Net inventory delta: positive = need OUT, negative = need IN (restore). */
export function calculateInventoryDelta(
  oldLines: { itemType: string; itemId: string; quantity: number }[],
  newLines: { itemType: string; itemId: string; quantity: number }[]
): { productId: string; delta: number }[] {
  const oldMap = productQtyMap(oldLines);
  const newMap = productQtyMap(newLines);
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  const result: { productId: string; delta: number }[] = [];
  for (const id of ids) {
    const delta = (newMap.get(id) ?? 0) - (oldMap.get(id) ?? 0);
    if (delta !== 0) result.push({ productId: id, delta });
  }
  return result;
}

export type PaymentAdjustment = {
  /** Additional amount customer must pay now */
  additionalDue: number;
  /** Amount to refund to customer */
  refundDue: number;
  oldTotal: number;
  newTotal: number;
  difference: number;
  previouslyPaid: number;
  previouslyRefunded: number;
  netCollected: number;
};

export function calculatePaymentAdjustment(input: {
  oldTotal: number;
  newTotal: number;
  paymentsTotal: number;
  refundsTotal: number;
}): PaymentAdjustment {
  const previouslyPaid = roundMoney(input.paymentsTotal);
  const previouslyRefunded = roundMoney(input.refundsTotal);
  const netCollected = roundMoney(previouslyPaid - previouslyRefunded);
  const newTotal = roundMoney(input.newTotal);
  const oldTotal = roundMoney(input.oldTotal);
  const difference = roundMoney(newTotal - oldTotal);
  const balance = roundMoney(newTotal - netCollected);

  return {
    oldTotal,
    newTotal,
    difference,
    previouslyPaid,
    previouslyRefunded,
    netCollected,
    additionalDue: balance > 0 ? balance : 0,
    refundDue: balance < 0 ? Math.abs(balance) : 0,
  };
}

export function cartFromLines(
  lines: InvoiceTotals["lines"]
): CartItem[] {
  return lines.map((l) => ({
    itemType: l.itemType,
    itemId: l.itemId,
    name: l.name,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
  }));
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Split a money total equally across n parties.
 * Remainder cents go to the last share so parts always sum to `total`.
 */
export function splitEqually(total: number, n: number): number[] {
  const count = Math.max(0, Math.floor(n));
  if (count <= 0) return [];
  const rounded = roundMoney(total);
  if (count === 1) return [rounded];
  const base = roundMoney(rounded / count);
  const shares = Array.from({ length: count }, () => base);
  const allocated = roundMoney(base * (count - 1));
  shares[count - 1] = roundMoney(rounded - allocated);
  return shares;
}

export type AmendPayload = {
  saleId: string;
  expectedVersion: number;
  customerId?: string | null;
  appointmentId?: string | null;
  items: InvoiceLineInput[];
  discount: number;
  tax?: number;
  notes?: string | null;
  changeReason: string;
  /** Required when new total exceeds net collected AND settleAdditional is true */
  additionalPayment?: { amount: number; method: PaymentMethod } | null;
  /** Required when new total is below net collected (overpayment must be refunded) */
  refundPayment?: { amount: number; method: PaymentMethod } | null;
  /** When true (default false), require collecting additionalDue now; otherwise leave as customer due */
  settleAdditionalNow?: boolean;
};
