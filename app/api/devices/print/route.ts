import { authenticateDevice } from "@/lib/devices/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND } from "@/lib/marketing/brand";
import {
  renderSaleReceiptHtml,
  renderTokenReceiptHtml,
} from "@/lib/print/thermal-html";
import { NextResponse } from "next/server";
import { formatDate, formatTime } from "@/lib/format";

function getDeviceKey(request: Request) {
  return request.headers.get("x-device-key") ?? request.headers.get("authorization")?.replace("Bearer ", "");
}

export async function POST(request: Request) {
  const apiKey = getDeviceKey(request);
  if (!apiKey) return NextResponse.json({ error: "Missing device key" }, { status: 401 });

  const device = await authenticateDevice(apiKey);
  if (!device) return NextResponse.json({ error: "Invalid device" }, { status: 401 });

  if (device.type !== "PRINTER" && device.type !== "TOKEN_KIOSK") {
    return NextResponse.json({ error: "Not a printer device" }, { status: 403 });
  }

  const body = await request.json();
  const { saleId, tokenNumber, customerName, customerPhone, queueDate } = body as {
    saleId?: string;
    tokenNumber?: number;
    customerName?: string;
    customerPhone?: string;
    queueDate?: string;
  };

  const admin = createAdminClient();

  const business = {
    name: BRAND.name,
    phone: BRAND.phone,
    address: BRAND.address,
    phonePtcl: BRAND.phonePtcl,
    phoneMobile: BRAND.phoneMobile,
  };

  const now = new Date();
  const date = formatDate(now);
  const time = formatTime(now);

  let receiptData: Record<string, unknown> = {};
  let html = "";

  if (saleId) {
    const { data: sale } = await admin
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (sale) {
      const [{ data: items }, { data: invoice }, { data: payments }, { data: customer }] =
        await Promise.all([
          admin.from("sale_items").select("name, quantity, unit_price, line_total").eq("sale_id", saleId),
          admin.from("invoices").select("invoice_number").eq("sale_id", saleId).maybeSingle(),
          admin.from("payments").select("method, amount, change_given, reference").eq("sale_id", saleId),
          sale.customer_id
            ? admin
                .from("customers")
                .select("first_name, last_name, phone")
                .eq("id", sale.customer_id)
                .single()
            : Promise.resolve({ data: null }),
        ]);

      html = renderSaleReceiptHtml({
        business,
        invoiceNumber: invoice?.invoice_number ?? `SALE-${saleId.slice(0, 8)}`,
        date,
        time,
        customerName: customer
          ? [customer.first_name, customer.last_name].filter(Boolean).join(" ")
          : null,
        customerPhone: customer?.phone ?? null,
        items: (items ?? []).map((i) => ({
          name: i.name,
          qty: i.quantity,
          unitPrice: Number(i.unit_price),
          lineTotal: Number(i.line_total),
        })),
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax ?? 0),
        depositApplied: Number(sale.deposit_applied ?? 0),
        total: Number(sale.total),
        paymentMethod:
          (payments ?? []).find((p) => p.reference !== "APPOINTMENT_DEPOSIT")?.method ??
          payments?.[0]?.method ??
          "CASH",
        amountPaid:
          sale.amount_paid != null
            ? Number(sale.amount_paid)
            : (payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
        amountDue:
          sale.amount_due != null
            ? Number(sale.amount_due)
            : Math.max(
                0,
                Number(sale.total) -
                  (sale.amount_paid != null
                    ? Number(sale.amount_paid)
                    : (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)) +
                  Number(sale.amount_refunded ?? 0)
              ),
        changeGiven: (payments ?? []).reduce((s, p) => s + (Number(p.change_given) || 0), 0),
      });

      receiptData = { type: "receipt", saleId, invoice: invoice?.invoice_number };
    }
  } else if (tokenNumber) {
    html = renderTokenReceiptHtml({
      business,
      tokenNumber,
      customerName: customerName ?? "Customer",
      customerPhone,
      queueDate: queueDate ?? date,
      date,
      time,
    });
    receiptData = { type: "token", tokenNumber, customerName };
  }

  return NextResponse.json({
    ok: true,
    print: receiptData,
    html,
    message: "Print data ready — render html on device or use browser print",
  });
}
