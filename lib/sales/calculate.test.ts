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

describe("roundMoney", () => {
  it("rounds to 2 decimal places", () => {
    assert.equal(roundMoney(10.126), 10.13);
    assert.equal(roundMoney(10.124), 10.12);
  });
});
