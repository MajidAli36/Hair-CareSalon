import { BRAND } from "@/lib/marketing/brand";
import { SYNCOPS } from "@/lib/print/syncops";
import { formatDate, formatTime } from "@/lib/format";

/**
 * Premium 80mm thermal invoice styles — international retail / salon standard.
 * Optimized for POS printers while keeping a polished software look on screen.
 */
const THERMAL_STYLES = `
  @page { size: 80mm auto; margin: 2.5mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    width: 72mm;
    margin: 0 auto;
    padding: 8px 6px 12px;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mono { font-family: "Consolas", "Courier New", monospace; font-variant-numeric: tabular-nums; }

  /* ── Header ── */
  .header {
    text-align: center;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 2px solid #111;
  }
  .brand-mark {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 4px;
  }
  .biz-name {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.2px;
    line-height: 1.3;
    text-transform: none;
  }
  .biz-address {
    margin-top: 5px;
    font-size: 10px;
    color: #333;
    line-height: 1.35;
  }
  .biz-phones {
    margin-top: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #111;
  }
  .biz-phones span { white-space: nowrap; }

  /* ── Document type ── */
  .doc-type {
    text-align: center;
    margin: 10px 0 8px;
  }
  .doc-type-label {
    display: inline-block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 12px;
    border: 1.5px solid #111;
  }

  /* ── Meta grid ── */
  .meta {
    margin: 8px 0;
    padding: 6px 0;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 3px 0;
    font-size: 10.5px;
  }
  .meta-row .k { color: #555; flex-shrink: 0; }
  .meta-row .v { text-align: right; font-weight: 600; word-break: break-word; }

  /* ── Items ── */
  .section-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #555;
    margin: 8px 0 4px;
  }
  .items-head {
    display: flex;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #555;
    padding-bottom: 3px;
    border-bottom: 1px solid #ccc;
    margin-bottom: 4px;
  }
  .item-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    margin: 5px 0;
    font-size: 11px;
  }
  .item-name { flex: 1; font-weight: 500; word-break: break-word; padding-right: 2px; }
  .item-qty { width: 28px; text-align: center; color: #444; flex-shrink: 0; }
  .item-amt { width: 58px; text-align: right; font-weight: 600; flex-shrink: 0; }

  /* ── Totals ── */
  .totals {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 2px solid #111;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    margin: 3px 0;
    font-size: 11px;
  }
  .total-row.muted .k, .total-row.muted .v { color: #555; font-weight: 400; }
  .total-row.grand {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed #111;
    font-size: 14px;
    font-weight: 800;
  }

  /* ── Payment box ── */
  .pay-box {
    margin-top: 8px;
    padding: 6px 8px;
    border: 1px solid #111;
    background: #f7f7f7;
  }
  .pay-row {
    display: flex;
    justify-content: space-between;
    margin: 2px 0;
    font-size: 10.5px;
  }
  .pay-row .v { font-weight: 700; }

  /* ── Token ── */
  .token-wrap { text-align: center; margin: 10px 0; }
  .token-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #555;
  }
  .token-num {
    font-size: 48px;
    font-weight: 800;
    line-height: 1;
    margin: 6px 0 4px;
    letter-spacing: -1px;
  }

  /* ── Footer ── */
  .thanks {
    text-align: center;
    margin-top: 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .sub-thanks {
    text-align: center;
    font-size: 10px;
    color: #555;
    margin-top: 2px;
  }
  .credit {
    display: block;
    text-align: center;
    font-size: 9px;
    color: #666;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #ddd;
    line-height: 1.45;
  }
  .credit a { color: #444; text-decoration: none; }
  .credit strong { color: #111; }
  .credit-phone { font-weight: 600; color: #222; }
`;

function wrapThermalDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${THERMAL_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `Rs ${n.toLocaleString("en-PK")}`;
}

export type BusinessPrintInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  phonePtcl?: string | null;
  phoneMobile?: string | null;
};

function businessHeader(business: BusinessPrintInfo) {
  const salonTitle = business.address || BRAND.address;
  const brandName = business.name || BRAND.name;
  const ptcl = business.phonePtcl || BRAND.phonePtcl;
  const mobile = business.phoneMobile || BRAND.phoneMobile;

  return `
    <header class="header">
      <div class="brand-mark">${escapeHtml(brandName)}</div>
      <div class="biz-name">${escapeHtml(salonTitle)}</div>
      <div class="biz-phones mono">
        <span>PTCL ${escapeHtml(ptcl)}</span>
        &nbsp;·&nbsp;
        <span>${escapeHtml(mobile)}</span>
      </div>
    </header>`;
}

function creditFooter() {
  return `<footer class="credit">
    Build by <strong>${SYNCOPS.name}</strong><br/>
    <a class="credit-phone" href="tel:+923018678319">${SYNCOPS.phone}</a>
    &nbsp;·&nbsp;
    <a href="${SYNCOPS.url}">syncops.tech</a>
  </footer>`;
}

function metaRow(label: string, value: string, mono = false) {
  return `<div class="meta-row"><span class="k">${escapeHtml(label)}</span><span class="v${mono ? " mono" : ""}">${escapeHtml(value)}</span></div>`;
}

export type SaleReceiptInput = {
  business: BusinessPrintInfo;
  invoiceNumber: string;
  date: string;
  time: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  depositApplied: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
};

export function renderSaleReceiptHtml(data: SaleReceiptInput): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <div class="item-row">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-qty mono">×${item.qty}</span>
        <span class="item-amt mono">${formatMoney(item.lineTotal)}</span>
      </div>`
    )
    .join("");

  const body = `
    ${businessHeader(data.business)}
    <div class="doc-type"><span class="doc-type-label">Tax Invoice</span></div>
    <div class="meta">
      ${metaRow("Invoice No.", data.invoiceNumber, true)}
      ${metaRow("Date", data.date, true)}
      ${metaRow("Time", data.time, true)}
      ${data.customerName ? metaRow("Customer", data.customerName) : ""}
      ${data.customerPhone ? metaRow("Phone", data.customerPhone, true) : ""}
    </div>
    <div class="section-label">Items</div>
    <div class="items-head">
      <span class="item-name">DESCRIPTION</span>
      <span class="item-qty">QTY</span>
      <span class="item-amt">AMOUNT</span>
    </div>
    ${itemsHtml}
    <div class="totals">
      <div class="total-row muted"><span class="k">Subtotal</span><span class="v mono">${formatMoney(data.subtotal)}</span></div>
      ${data.discount > 0 ? `<div class="total-row muted"><span class="k">Discount</span><span class="v mono">−${formatMoney(data.discount)}</span></div>` : ""}
      ${data.tax > 0 ? `<div class="total-row muted"><span class="k">Tax</span><span class="v mono">+${formatMoney(data.tax)}</span></div>` : ""}
      ${data.depositApplied > 0 ? `<div class="total-row muted"><span class="k">Advance applied</span><span class="v mono">−${formatMoney(data.depositApplied)}</span></div>` : ""}
      <div class="total-row grand"><span class="k">TOTAL</span><span class="v mono">${formatMoney(data.total)}</span></div>
    </div>
    <div class="pay-box">
      <div class="pay-row"><span>Payment method</span><span class="v">${escapeHtml(data.paymentMethod)}</span></div>
      <div class="pay-row"><span>Amount received</span><span class="v mono">${formatMoney(data.amountPaid)}</span></div>
    </div>
    <div class="thanks">Thank you for visiting</div>
    <div class="sub-thanks">We look forward to seeing you again</div>
    ${creditFooter()}
  `;

  return wrapThermalDocument(data.invoiceNumber, body);
}

export type TokenReceiptInput = {
  business: BusinessPrintInfo;
  tokenNumber: number;
  customerName: string;
  customerPhone?: string | null;
  staffName?: string | null;
  chair?: string | null;
  queueDate: string;
  date: string;
  time: string;
};

export function renderTokenReceiptHtml(data: TokenReceiptInput): string {
  const body = `
    ${businessHeader(data.business)}
    <div class="doc-type"><span class="doc-type-label">Queue Token</span></div>
    <div class="token-wrap">
      <div class="token-label">Your number</div>
      <div class="token-num mono">${data.tokenNumber}</div>
    </div>
    <div class="meta">
      ${metaRow("Customer", data.customerName)}
      ${data.customerPhone ? metaRow("Phone", data.customerPhone, true) : ""}
      ${data.staffName ? metaRow("Staff", data.staffName) : ""}
      ${data.chair ? metaRow("Chair", data.chair) : ""}
      ${metaRow("Queue date", data.queueDate, true)}
      ${metaRow("Token time", `${data.date} ${data.time}`, true)}
    </div>
    <div class="thanks">Please wait for your turn</div>
    <div class="sub-thanks">Listen for your number to be called</div>
    ${creditFooter()}
  `;

  return wrapThermalDocument(`Token ${data.tokenNumber}`, body);
}

export type AppointmentReceiptInput = {
  business: BusinessPrintInfo;
  customerName: string;
  customerPhone?: string | null;
  staffName?: string | null;
  services: { name: string; price: number }[];
  scheduledAt: string;
  source: string;
  status: string;
  advanceAmount?: number;
  pendingApproval?: boolean;
};

export function renderAppointmentReceiptHtml(data: AppointmentReceiptInput): string {
  const scheduled = new Date(data.scheduledAt);
  const dateStr = formatDate(scheduled, "weekday");
  const timeStr = formatTime(scheduled);
  const serviceTotal = data.services.reduce((s, x) => s + x.price, 0);
  const sourceLabel = data.source === "ONLINE" ? "Online booking" : "Reception";

  const servicesHtml = data.services
    .map(
      (s) => `
      <div class="item-row">
        <span class="item-name">${escapeHtml(s.name)}</span>
        <span class="item-amt mono">${formatMoney(s.price)}</span>
      </div>`
    )
    .join("");

  const body = `
    ${businessHeader(data.business)}
    <div class="doc-type"><span class="doc-type-label">Appointment</span></div>
    <div class="meta">
      ${metaRow("Booking", sourceLabel)}
      ${metaRow("Status", data.status)}
      ${metaRow("Customer", data.customerName)}
      ${data.customerPhone ? metaRow("Phone", data.customerPhone, true) : ""}
      ${data.staffName ? metaRow("Stylist", data.staffName) : ""}
      ${metaRow("Date", dateStr, true)}
      ${metaRow("Time", timeStr, true)}
    </div>
    <div class="section-label">Services</div>
    ${servicesHtml}
    <div class="totals">
      <div class="total-row grand"><span class="k">Total</span><span class="v mono">${formatMoney(serviceTotal)}</span></div>
      ${
        data.advanceAmount && data.advanceAmount > 0
          ? `<div class="total-row muted"><span class="k">Advance</span><span class="v mono">${formatMoney(data.advanceAmount)}${data.pendingApproval ? " (pending)" : ""}</span></div>`
          : ""
      }
    </div>
    <div class="thanks">${data.pendingApproval ? "Awaiting confirmation" : "Booking confirmed"}</div>
    <div class="sub-thanks">We look forward to seeing you</div>
    ${creditFooter()}
  `;

  return wrapThermalDocument("Appointment", body);
}
