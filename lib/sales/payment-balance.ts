/** Sale payment balance — revenue (total) vs cash collected vs receivable. */

import { roundMoney } from "@/lib/sales/calculate";
import type { PaymentMethod } from "@/types/commerce";

export type SalePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type SalePaymentState = {
  total: number;
  amountPaid: number;
  amountRefunded: number;
  netCollected: number;
  amountDue: number;
  paymentStatus: SalePaymentStatus;
};

export function computeSalePaymentState(input: {
  total: number;
  paymentsSum: number;
  refundsSum: number;
  saleStatus: string;
}): SalePaymentState {
  const total = roundMoney(input.total);
  const amountPaid = roundMoney(input.paymentsSum);
  const amountRefunded = roundMoney(input.refundsSum);
  const netCollected = roundMoney(amountPaid - amountRefunded);

  if (input.saleStatus === "VOID" || input.saleStatus === "REFUNDED") {
    let paymentStatus: SalePaymentStatus = "PAID";
    if (input.saleStatus === "REFUNDED") {
      paymentStatus = "REFUNDED";
    } else if (amountRefunded > 0 && amountRefunded >= amountPaid && amountPaid > 0) {
      paymentStatus = "REFUNDED";
    } else if (amountRefunded > 0) {
      paymentStatus = "PARTIALLY_REFUNDED";
    } else if (amountPaid <= 0) {
      paymentStatus = "UNPAID";
    } else {
      paymentStatus = "PAID";
    }
    return {
      total,
      amountPaid,
      amountRefunded,
      netCollected,
      amountDue: 0,
      paymentStatus,
    };
  }

  const amountDue = roundMoney(Math.max(0, total - amountPaid + amountRefunded));

  let paymentStatus: SalePaymentStatus;
  if (amountRefunded > 0 && amountRefunded >= amountPaid && amountPaid > 0) {
    paymentStatus = "REFUNDED";
  } else if (amountRefunded > 0 && amountDue > 0) {
    paymentStatus = "PARTIALLY_REFUNDED";
  } else if (amountRefunded > 0 && amountDue <= 0) {
    paymentStatus = "PARTIALLY_REFUNDED";
  } else if (amountPaid <= 0 && total > 0) {
    paymentStatus = "UNPAID";
  } else if (amountDue > 0) {
    paymentStatus = "PARTIALLY_PAID";
  } else {
    paymentStatus = "PAID";
  }

  return {
    total,
    amountPaid,
    amountRefunded,
    netCollected,
    amountDue,
    paymentStatus,
  };
}

export type DueInvoice = {
  saleId: string;
  invoiceNumber?: string | null;
  total: number;
  amountDue: number;
  completedAt?: string | null;
};

export type PaymentAllocationLine = {
  saleId: string;
  amount: number;
  previousDue: number;
  remainingDue: number;
};

/** FIFO allocate payment across due invoices (oldest first). */
export function allocateAccountPayment(
  dueInvoices: DueInvoice[],
  paymentAmount: number
): PaymentAllocationLine[] {
  let remaining = roundMoney(paymentAmount);
  if (remaining <= 0) return [];
  const sorted = [...dueInvoices]
    .filter((i) => i.amountDue > 0)
    .sort((a, b) => {
      const ta = a.completedAt ?? "";
      const tb = b.completedAt ?? "";
      return ta.localeCompare(tb);
    });

  const lines: PaymentAllocationLine[] = [];
  for (const inv of sorted) {
    if (remaining <= 0) break;
    const apply = roundMoney(Math.min(remaining, inv.amountDue));
    if (apply <= 0) continue;
    lines.push({
      saleId: inv.saleId,
      amount: apply,
      previousDue: roundMoney(inv.amountDue),
      remainingDue: roundMoney(inv.amountDue - apply),
    });
    remaining = roundMoney(remaining - apply);
  }
  return lines;
}

export type ReceivePaymentValidation = {
  ok: true;
  appliedAmount: number;
  changeGiven: number;
  newState: SalePaymentState;
} | {
  ok: false;
  error: string;
};

export function validateReceivePayment(input: {
  saleStatus: string;
  customerId: string | null | undefined;
  total: number;
  paymentsSum: number;
  refundsSum: number;
  paymentAmount: number;
  tenderedAmount?: number | null;
  expectedPaymentVersion: number;
  currentPaymentVersion: number;
  allowWalkInPartial?: boolean;
}): ReceivePaymentValidation {
  if (input.saleStatus === "VOID") {
    return { ok: false, error: "Cannot collect payment on a voided invoice" };
  }
  if (input.saleStatus === "REFUNDED") {
    return { ok: false, error: "Cannot collect payment on a fully refunded invoice" };
  }
  if (input.expectedPaymentVersion !== input.currentPaymentVersion) {
    return {
      ok: false,
      error: "This invoice was updated by someone else. Reload and try again.",
    };
  }

  const amount = roundMoney(input.paymentAmount);
  if (!(amount > 0)) {
    return { ok: false, error: "Payment amount must be greater than zero" };
  }

  const current = computeSalePaymentState({
    total: input.total,
    paymentsSum: input.paymentsSum,
    refundsSum: input.refundsSum,
    saleStatus: input.saleStatus,
  });

  if (current.amountDue <= 0) {
    return { ok: false, error: "Invoice is already fully paid" };
  }

  if (amount > current.amountDue + 0.009) {
    return {
      ok: false,
      error: `Payment exceeds outstanding due (max ${current.amountDue})`,
    };
  }

  if (!input.customerId && !input.allowWalkInPartial) {
    if (roundMoney(current.amountDue - amount) > 0) {
      return {
        ok: false,
        error: "Walk-in customers must pay the full outstanding amount",
      };
    }
  }

  const tendered =
    input.tenderedAmount != null ? roundMoney(input.tenderedAmount) : amount;
  if (tendered + 0.009 < amount) {
    return { ok: false, error: "Tendered amount cannot be less than payment applied" };
  }
  const changeGiven = roundMoney(Math.max(0, tendered - amount));

  const newState = computeSalePaymentState({
    total: input.total,
    paymentsSum: input.paymentsSum + amount,
    refundsSum: input.refundsSum,
    saleStatus: input.saleStatus,
  });

  return {
    ok: true,
    appliedAmount: amount,
    changeGiven,
    newState,
  };
}

export function validateCheckoutPayments(input: {
  customerId: string | null | undefined;
  amountDueAfterDeposit: number;
  payments: { amount: number; method: PaymentMethod }[];
  allowUnpaid: boolean;
  isManager: boolean;
}): { ok: true; collected: number; remainingDue: number } | { ok: false; error: string } {
  const due = roundMoney(input.amountDueAfterDeposit);
  const lines = input.payments.filter((p) => roundMoney(p.amount) > 0);
  const collected = roundMoney(lines.reduce((s, p) => s + roundMoney(p.amount), 0));

  if (collected > due + 0.009) {
    return { ok: false, error: "Collected amount exceeds invoice due" };
  }

  const remainingDue = roundMoney(due - collected);

  if (!input.customerId && remainingDue > 0) {
    return { ok: false, error: "Walk-in customers must pay in full" };
  }

  if (remainingDue > 0 && collected <= 0) {
    if (!input.allowUnpaid || !input.isManager) {
      return {
        ok: false,
        error: "Creating an unpaid invoice requires manager approval",
      };
    }
  }

  return { ok: true, collected, remainingDue };
}
