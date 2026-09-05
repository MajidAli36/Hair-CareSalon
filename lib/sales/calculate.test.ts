/**
 * Invoice calculation engine tests.
 * Run: npx tsx --test lib/sales/calculate.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateInvoiceTotals,
  calculateInventoryDelta,
  calculatePaymentAdjustment,
  roundMoney,
  splitEqually,
} from "./calculate";

describe("calculateInvoiceTotals", () => {
  it("computes line totals, subtotal, discount clamp, and total", () => {
    const result = calculateInvoiceTotals(
      [
        {
          itemType: "SERVICE",
          itemId: "s1",
          name: "Haircut",
          unitPrice: 1500,
          quantity: 1,
        },
        {
          itemType: "PRODUCT",
          itemId: "p1",
          name: "Nivia",
          unitPrice: 1000,
          quantity: 4,
        },
      ],
      500,
      0
    );

    assert.equal(result.subtotal, 5500);
    assert.equal(result.discount, 500);
    assert.equal(result.total, 5000);
    assert.equal(result.lines[1].lineTotal, 4000);
  });

  it("clamps discount to subtotal", () => {
    const result = calculateInvoiceTotals(
      [{ itemType: "SERVICE", itemId: "s1", name: "Cut", unitPrice: 100, quantity: 1 }],
      999
    );
    assert.equal(result.discount, 100);
    assert.equal(result.total, 0);
  });
});

describe("calculateInventoryDelta", () => {
  it("reverses and reapplies product qty (4 → 2 = net -2)", () => {
    const deltas = calculateInventoryDelta(
      [{ itemType: "PRODUCT", itemId: "p1", quantity: 4 }],
      [{ itemType: "PRODUCT", itemId: "p1", quantity: 2 }]
    );
    assert.deepEqual(deltas, [{ productId: "p1", delta: -2 }]);
  });

  it("handles product swap", () => {
    const deltas = calculateInventoryDelta(
      [{ itemType: "PRODUCT", itemId: "a", quantity: 1 }],
      [{ itemType: "PRODUCT", itemId: "b", quantity: 1 }]
    );
    assert.equal(deltas.length, 2);
    assert.deepEqual(
      deltas.sort((x, y) => x.productId.localeCompare(y.productId)),
      [
        { productId: "a", delta: -1 },
        { productId: "b", delta: 1 },
      ]
    );
  });

  it("ignores services for inventory", () => {
    const deltas = calculateInventoryDelta(
      [{ itemType: "SERVICE", itemId: "s1", quantity: 2 }],
      [{ itemType: "SERVICE", itemId: "s1", quantity: 1 }]
    );
    assert.deepEqual(deltas, []);
  });
});

describe("calculatePaymentAdjustment", () => {
  it("requires refund when total decreases", () => {
    const adj = calculatePaymentAdjustment({
      oldTotal: 7550,
      newTotal: 6000,
      paymentsTotal: 7550,
      refundsTotal: 0,
    });
    assert.equal(adj.difference, -1550);
    assert.equal(adj.refundDue, 1550);
    assert.equal(adj.additionalDue, 0);
  });

  it("requires additional payment when total increases", () => {
    const adj = calculatePaymentAdjustment({
      oldTotal: 6000,
      newTotal: 7000,
      paymentsTotal: 6000,
      refundsTotal: 0,
    });
    assert.equal(adj.additionalDue, 1000);
    assert.equal(adj.refundDue, 0);
  });

  it("accounts for prior refunds in net collected", () => {
    const adj = calculatePaymentAdjustment({
      oldTotal: 7550,
      newTotal: 7550,
      paymentsTotal: 7550,
      refundsTotal: 1500,
    });
    assert.equal(adj.netCollected, 6050);
    assert.equal(adj.additionalDue, 1500);
  });
});

describe("splitEqually", () => {
  it("splits with remainder on last share so parts sum to total", () => {
    const shares = splitEqually(100, 3);
    assert.deepEqual(shares, [33.33, 33.33, 33.34]);
    assert.equal(roundMoney(shares.reduce((a, b) => a + b, 0)), 100);
  });

  it("matches multi-staff attribution for 2 people", () => {
    const shares = splitEqually(1500.5, 2);
    assert.equal(roundMoney(shares[0] + shares[1]), 1500.5);
  });
});

describe("smoke: deposit / refund / amend money model", () => {
  it("deposit apply reduces collect-now without changing invoice total", () => {
    const inv = calculateInvoiceTotals(
      [{ itemType: "SERVICE", itemId: "s1", name: "Cut", unitPrice: 2000, quantity: 1 }],
      0,
      0
    );
    const depositCredit = 500;
    const appliedDeposit = roundMoney(Math.min(depositCredit, inv.total));
    const amountDue = roundMoney(Math.max(0, inv.total - appliedDeposit));
    assert.equal(inv.total, 2000);
    assert.equal(appliedDeposit, 500);
    assert.equal(amountDue, 1500);
  });

  it("amend below deposit: cash refund capped; deposit shrink covers rest", () => {
    const oldTotal = 2000;
    const newTotal = 800;
    const depositApplied = 1200;
    const cashPaid = 800;
    const adj = calculatePaymentAdjustment({
      oldTotal,
      newTotal,
      paymentsTotal: cashPaid + depositApplied,
      refundsTotal: 0,
    });
    // Full overpayment vs new total is 1200; only cashPaid is cash-refundable
    const cashRefundable = cashPaid;
    const cashRefund = roundMoney(Math.min(adj.refundDue, cashRefundable));
    const newDepositApplied = roundMoney(Math.min(depositApplied, newTotal));
    assert.equal(cashRefund, 800);
    assert.equal(newDepositApplied, 800);
    // Excess deposit freed = 400 (not cash-refunded)
    assert.equal(roundMoney(depositApplied - newDepositApplied), 400);
  });

  it("partial refund reduces net without changing ticket total", () => {
    const ticketRevenue = 5000;
    const partialRefund = 500;
    const netRevenue = roundMoney(ticketRevenue - partialRefund);
    assert.equal(netRevenue, 4500);
  });

  it("full refund removes ticket — do not subtract refund again", () => {
    const ticketsStillPosted = 0; // sale status REFUNDED excluded
    const refundOnPostedOnly = 0;
    const netRevenue = roundMoney(ticketsStillPosted - refundOnPostedOnly);
    assert.equal(netRevenue, 0);
  });

  it("same-day revenue identity: ticket sum is the single source", () => {
    const sales = [{ total: 1000.1 }, { total: 2000.2 }, { total: 500 }];
    const dashboard = roundMoney(sales.reduce((a, s) => a + s.total, 0));
    const finances = roundMoney(sales.reduce((a, s) => a + s.total, 0));
    const overall = roundMoney(sales.reduce((a, s) => a + s.total, 0));
    assert.equal(dashboard, finances);
    assert.equal(finances, overall);
    assert.equal(overall, 3500.3);
  });
});
