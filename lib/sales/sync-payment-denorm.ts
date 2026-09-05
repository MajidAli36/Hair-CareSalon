import { createClient } from "@/lib/supabase/server";
import { computeSalePaymentState } from "@/lib/sales/payment-balance";
import { roundMoney } from "@/lib/sales/calculate";

/** Recalculate and persist denormalized payment fields on a sale. */
export async function syncSalePaymentDenorm(
  organizationId: string,
  saleId: string
): Promise<ReturnType<typeof computeSalePaymentState>> {
  const supabase = await createClient();

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, total, status, payment_version")
    .eq("id", saleId)
    .eq("organization_id", organizationId)
    .single();

  if (saleErr || !sale) {
    throw new Error(saleErr?.message ?? "Sale not found for payment sync");
  }

  const [{ data: pays }, { data: refs }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("sale_id", saleId)
      .eq("organization_id", organizationId),
    supabase
      .from("sale_refunds")
      .select("amount")
      .eq("sale_id", saleId)
      .eq("organization_id", organizationId),
  ]);

  const paymentsSum = roundMoney(
    (pays ?? []).reduce((s, p) => s + Number(p.amount), 0)
  );
  const refundsSum = roundMoney(
    (refs ?? []).reduce((s, p) => s + Number(p.amount), 0)
  );
  const state = computeSalePaymentState({
    total: Number(sale.total),
    paymentsSum,
    refundsSum,
    saleStatus: sale.status,
  });

  const { error } = await supabase
    .from("sales")
    .update({
      amount_paid: state.amountPaid,
      amount_refunded: state.amountRefunded,
      amount_due: state.amountDue,
      payment_status: state.paymentStatus,
      payment_version: Number(sale.payment_version ?? 1) + 1,
    })
    .eq("id", saleId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
  return state;
}
