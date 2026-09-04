/**
 * Payment balance tests.
 * Run: npx tsx --test lib/sales/payment-balance.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateAccountPayment,
  computeSalePaymentState,
  validateCheckoutPayments,
  validateReceivePayment,
} from "./payment-balance";

describe("computeSalePaymentState", () => {
  it("full payment", () => {
    const s = computeSalePaymentState({
      total: 7500,
      paymentsSum: 7500,
      refundsSum: 0,
      saleStatus: "COMPLETED",
    });
    assert.equal(s.amountDue, 0);
    assert.equal(s.paymentStatus, "PAID");
  });

  it("partial payment", () => {
    const s = computeSalePaymentState({
      total: 7500,
      paymentsSum: 5000,
      refundsSum: 0,
      saleStatus: "COMPLETED",
    });
    assert.equal(s.amountDue, 2500);
    assert.equal(s.paymentStatus, "PARTIALLY_PAID");
    assert.equal(s.total, 7500);
  });

  it("unpaid", () => {
    const s = computeSalePaymentState({
      total: 7500,
      paymentsSum: 0,
      refundsSum: 0,
      saleStatus: "COMPLETED",
    });
    assert.equal(s.amountDue, 7500);
    assert.equal(s.paymentStatus, "UNPAID");
  });

  it("void forces due 0", () => {
    const s = computeSalePaymentState({
      total: 7500,
      paymentsSum: 5000,
      refundsSum: 5000,
      saleStatus: "VOID",
    });
    assert.equal(s.amountDue, 0);
  });

  it("partial refund with remaining due", () => {
    const s = computeSalePaymentState({
      total: 7500,
      paymentsSum: 7500,
      refundsSum: 1500,
      saleStatus: "COMPLETED",
    });
    assert.equal(s.amountDue, 1500);
    assert.equal(s.paymentStatus, "PARTIALLY_REFUNDED");
  });
});

describe("allocateAccountPayment", () => {
  it("settles oldest invoices first", () => {
    const lines = allocateAccountPayment(
      [
        { saleId: "b", amountDue: 3000, completedAt: "2026-09-08", total: 3000 },
        { saleId: "a", amountDue: 2500, completedAt: "2026-09-04", total: 7500 },
      ],
      4000
    );
    assert.equal(lines.length, 2);
    assert.equal(lines[0].saleId, "a");
    assert.equal(lines[0].amount, 2500);
    assert.equal(lines[0].remainingDue, 0);
    assert.equal(lines[1].saleId, "b");
    assert.equal(lines[1].amount, 1500);
    assert.equal(lines[1].remainingDue, 1500);
  });
});

describe("validateReceivePayment", () => {
  it("rejects overpayment", () => {
    const r = validateReceivePayment({
      saleStatus: "COMPLETED",
      customerId: "c1",
      total: 7500,
      paymentsSum: 5000,
      refundsSum: 0,
      paymentAmount: 3000,
      expectedPaymentVersion: 1,
      currentPaymentVersion: 1,
    });
    assert.equal(r.ok, false);
  });

  it("accepts final payment with change", () => {
    const r = validateReceivePayment({
      saleStatus: "COMPLETED",
      customerId: "c1",
      total: 7500,
      paymentsSum: 5000,
      refundsSum: 0,
      paymentAmount: 2500,
      tenderedAmount: 3000,
      expectedPaymentVersion: 1,
      currentPaymentVersion: 1,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.changeGiven, 500);
      assert.equal(r.newState.amountDue, 0);
      assert.equal(r.newState.paymentStatus, "PAID");
    }
  });

  it("rejects walk-in partial", () => {
    const r = validateReceivePayment({
      saleStatus: "COMPLETED",
      customerId: null,
      total: 7500,
      paymentsSum: 0,
      refundsSum: 0,
      paymentAmount: 5000,
      expectedPaymentVersion: 1,
      currentPaymentVersion: 1,
    });
    assert.equal(r.ok, false);
  });

  it("rejects concurrency mismatch", () => {
    const r = validateReceivePayment({
      saleStatus: "COMPLETED",
      customerId: "c1",
      total: 7500,
      paymentsSum: 0,
      refundsSum: 0,
      paymentAmount: 1000,
      expectedPaymentVersion: 1,
      currentPaymentVersion: 2,
    });
    assert.equal(r.ok, false);
  });

  it("rejects void invoice", () => {
    const r = validateReceivePayment({
      saleStatus: "VOID",
      customerId: "c1",
      total: 7500,
      paymentsSum: 0,
      refundsSum: 0,
      paymentAmount: 1000,
      expectedPaymentVersion: 1,
      currentPaymentVersion: 1,
    });
    assert.equal(r.ok, false);
  });
});

describe("validateCheckoutPayments", () => {
  it("allows named partial", () => {
    const r = validateCheckoutPayments({
      customerId: "c1",
      amountDueAfterDeposit: 7500,
      payments: [{ amount: 5000, method: "CASH" }],
      allowUnpaid: false,
      isManager: false,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.remainingDue, 2500);
  });

  it("blocks walk-in partial", () => {
    const r = validateCheckoutPayments({
      customerId: null,
      amountDueAfterDeposit: 7500,
      payments: [{ amount: 5000, method: "CASH" }],
      allowUnpaid: false,
      isManager: false,
    });
    assert.equal(r.ok, false);
  });

  it("unpaid requires manager", () => {
    const r = validateCheckoutPayments({
      customerId: "c1",
      amountDueAfterDeposit: 7500,
      payments: [],
      allowUnpaid: true,
      isManager: false,
    });
    assert.equal(r.ok, false);
  });

  it("split cash+card", () => {
    const r = validateCheckoutPayments({
      customerId: "c1",
      amountDueAfterDeposit: 7500,
      payments: [
        { amount: 3000, method: "CASH" },
        { amount: 2000, method: "CARD" },
      ],
      allowUnpaid: false,
      isManager: false,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.collected, 5000);
      assert.equal(r.remainingDue, 2500);
    }
  });
});
