import { BRAND } from "@/lib/marketing/brand";
import { SYNCOPS } from "@/lib/print/syncops";
import { formatDate, formatTime } from "@/lib/format";

/** Thermal paper presets — content width leaves a printer-safe margin on both sides. */
export type ThermalPaperWidth = "80mm" | "58mm";

const PAPER = {
  // Keep content well inside printable area — many 80mm heads clip ~3–5mm on the right.
  "80mm": { page: "80mm", content: "70mm" },
  "58mm": { page: "58mm", content: "48mm" },
} as const;

/**
 * Default paper width for all receipts.
 * Set `NEXT_PUBLIC_RECEIPT_WIDTH=58mm` to switch the whole POS to 58mm paper.
 * Individual render calls can still override via `paperWidth`.
 */
export const DEFAULT_THERMAL_PAPER: ThermalPaperWidth =
  process.env.NEXT_PUBLIC_RECEIPT_WIDTH === "58mm" ? "58mm" : "80mm";

function thermalStyles(paper: ThermalPaperWidth): string {
  const { page, content } = PAPER[paper];
  return `
  :root {
    --receipt-width: ${page};
    --receipt-content-width: ${content};
  }

  /* Literal sizes in @page — CSS variables are unreliable inside @page in Chromium */
  @page {
    size: ${page} auto;
    margin: 0;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    width: ${page};
    max-width: ${page};
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body {
    width: ${page};
    max-width: ${page};
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    /* Arial prints crisply on ESC/POS / browser thermal drivers */
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.3;
    color: #000;
    background: #e8e8e8;
    -webkit-font-smoothing: none;
    font-smooth: never;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Screen / iframe preview: gray stage, receipt at true thermal width */
  .receipt-stage {
    width: ${page};
    max-width: ${page};
    margin: 0;
    padding: 0;
    background: #e8e8e8;
  }

  .receipt {
    width: ${content};
    max-width: ${content};
    height: auto;
    min-height: 0;
    margin: 0 auto;
    /* Extra right padding — thermal drivers often crop the trailing edge */
    padding: 2mm 2.5mm 3mm 1.5mm;
    background: #fff;
    color: #000;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .mono {
    font-family: Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
  }

  /* ── Header ── */
  .header {
    text-align: center;
    padding-bottom: 5px;
    margin-bottom: 5px;
    border-bottom: 2px solid #000;
  }
  .biz-name {
    font-size: 18px;
    font-weight: 900;
    line-height: 1.2;
    color: #000;
  }
  .biz-address {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #000;
    line-height: 1.3;
  }
  .biz-phones {
    margin-top: 3px;
    font-size: 11px;
    font-weight: 700;
    color: #000;
    line-height: 1.3;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* ── Title ── */
  .doc-type {
    text-align: center;
    margin: 6px 0 5px;
  }
  .doc-type-label {
    display: inline-block;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 3px 10px;
    border: 2px solid #000;
    color: #000;
  }

  /* ── Meta ── */
  .meta {
    margin: 5px 0;
    padding: 5px 0;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6px;
    margin: 3px 0;
    font-size: 12px;
    color: #000;
    max-width: 100%;
  }
  /* NEVER use gray on thermal — printers dither it into faint dots */
  .meta-row .k {
    flex-shrink: 0;
    font-weight: 700;
    color: #000;
  }
  .meta-row .v {
    min-width: 0;
    text-align: right;
    font-weight: 700;
    color: #000;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  /* ── Items ── */
  .section-label {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #000;
    margin: 6px 0 3px;
  }
  .items-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 28px 52px;
    gap: 2px;
    font-size: 11px;
    font-weight: 900;
    color: #000;
    padding-bottom: 3px;
    border-bottom: 2px solid #000;
    margin-bottom: 3px;
    max-width: 100%;
  }
  .items-head .col-qty,
  .items-head .col-price {
    text-align: right;
  }
  .item {
    padding: 4px 0;
    border-bottom: 1px solid #000;
    max-width: 100%;
  }
  .item:last-child {
    border-bottom: none;
  }
  .item-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 28px 52px;
    gap: 2px;
    align-items: start;
    font-size: 12px;
    color: #000;
    max-width: 100%;
  }
  .item-name {
    min-width: 0;
    font-weight: 700;
    word-break: break-word;
    overflow-wrap: anywhere;
    padding-right: 2px;
    color: #000;
  }
  .item-qty {
    text-align: right;
    font-weight: 700;
    color: #000;
    font-variant-numeric: tabular-nums;
  }
  .item-price {
    text-align: right;
    font-weight: 700;
    color: #000;
    font-variant-numeric: tabular-nums;
  }
  .item-unit {
    margin-top: 1px;
    font-size: 11px;
    font-weight: 600;
    color: #000;
  }

  /* ── Totals ── */
  .totals {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 2px solid #000;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin: 3px 0;
    font-size: 12px;
    font-weight: 700;
    color: #000;
    max-width: 100%;
  }
  .total-row.muted .k,
  .total-row.muted .v {
    color: #000;
    font-weight: 700;
  }
  .total-row .k {
    min-width: 0;
  }
  .total-row .v {
    flex-shrink: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .total-row.grand {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 2px solid #000;
    font-size: 15px;
    font-weight: 900;
    color: #000;
  }

  /* ── Payment ── */
  .pay-box {
    margin-top: 6px;
    padding: 5px 0;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
  }
  .pay-row {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin: 3px 0;
    font-size: 12px;
    font-weight: 700;
    color: #000;
    max-width: 100%;
  }
  .pay-row .v {
    flex-shrink: 0;
    font-weight: 900;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Token ── */
  .token-wrap { text-align: center; margin: 8px 0; }
  .token-label {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #000;
  }
  .token-num {
    font-size: 48px;
    font-weight: 900;
    line-height: 1;
    margin: 4px 0;
    letter-spacing: 0;
    color: #000;
  }

  /* ── Footer ── */
  .thanks {
    text-align: center;
    margin-top: 8px;
    font-size: 13px;
    font-weight: 900;
    color: #000;
  }
  .sub-thanks {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: #000;
    margin-top: 2px;
  }
  .credit {
    display: block;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: #000;
    margin-top: 8px;
    padding-top: 5px;
    border-top: 1px solid #000;
    line-height: 1.35;
  }
  .credit a { color: #000; text-decoration: none; font-weight: 700; }
  .credit strong { color: #000; font-weight: 900; }
  .credit-phone { font-weight: 900; color: #000; }

  /* Narrow paper: tighten columns */
  html[data-paper="58mm"] .items-head,
  html[data-paper="58mm"] .item-top {
    grid-template-columns: minmax(0, 1fr) 24px 46px;
  }
  html[data-paper="58mm"] .biz-name { font-size: 15px; }
  html[data-paper="58mm"] .doc-type-label { font-size: 12px; }
  html[data-paper="58mm"] .meta-row { font-size: 11px; }
  html[data-paper="58mm"] .total-row.grand { font-size: 14px; }
  html[data-paper="58mm"] .token-num { font-size: 40px; }

  @media print {
    @page {
      size: ${page} auto;
      margin: 0;
    }

    html,
    body {
      width: ${page} !important;
      max-width: ${page} !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      -webkit-font-smoothing: none !important;
    }

    .receipt-stage {
      width: ${page} !important;
      max-width: ${page} !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }

    .receipt {
      width: ${content} !important;
      max-width: ${content} !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 auto !important;
      padding: 1.5mm 2.5mm 2.5mm 1.5mm !important;
      background: #fff !important;
      color: #000 !important;
      box-shadow: none !important;
      overflow-x: hidden !important;
    }

    /* Force every text node black — kills leftover gray from any rule */
    .receipt,
    .receipt * {
      color: #000 !important;
      -webkit-text-fill-color: #000 !important;
    }

    .pay-box {
      background: transparent !important;
    }
  }
`;
}

function wrapThermalDocument(
  title: string,
  body: string,
  paper: ThermalPaperWidth = DEFAULT_THERMAL_PAPER
): string {
  return `<!DOCTYPE html>
<html lang="en" data-paper="${paper}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${PAPER[paper].page}" />
  <title>${escapeHtml(title)}</title>
  <style>${thermalStyles(paper)}</style>
</head>
<body>
  <div class="receipt-stage">
    <div class="receipt">
${body}
    </div>
  </div>
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
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  return `Rs ${n.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export type BusinessPrintInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  phonePtcl?: string | null;
  phoneMobile?: string | null;
};

function businessHeader(business: BusinessPrintInfo) {
  const brandName = business.name || BRAND.name;
  const address = business.address || BRAND.address;
  const ptcl = business.phonePtcl || BRAND.phonePtcl;
  const mobile = business.phoneMobile || BRAND.phoneMobile;

  return `
    <header class="header">
      <div class="biz-name">${escapeHtml(brandName)}</div>
      ${address ? `<div class="biz-address">${escapeHtml(address)}</div>` : ""}
      <div class="biz-phones mono">
        <span>PTCL ${escapeHtml(ptcl)}</span>
        &nbsp;·&nbsp;
        <span>${escapeHtml(mobile)}</span>
      </div>
    </header>`;
}

function creditFooter() {
  return `<footer class="credit">
    Built by <strong>${SYNCOPS.name}</strong><br/>
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
  /** Outstanding receivable; shown when > 0 */
  amountDue?: number;
  /** Cash change given at tender (from payments.change_given) */
  changeGiven?: number;
  /** Thermal paper width; defaults to 80mm. */
  paperWidth?: ThermalPaperWidth;
};

export function renderSaleReceiptHtml(data: SaleReceiptInput): string {
  const paper = data.paperWidth ?? DEFAULT_THERMAL_PAPER;
  const amountDue = Math.max(0, Math.round((Number(data.amountDue ?? 0) || 0) * 100) / 100);
  const changeGiven = Math.max(
    0,
    Math.round((Number(data.changeGiven ?? 0) || 0) * 100) / 100
  );

  const itemsHtml = data.items
    .map((item) => {
      const showUnit = item.qty > 1;
      return `
      <div class="item">
        <div class="item-top">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-qty mono">${item.qty}</span>
          <span class="item-price mono">${formatMoney(item.lineTotal)}</span>
        </div>
        ${
          showUnit
            ? `<div class="item-unit mono">${item.qty} × ${formatMoney(item.unitPrice)}</div>`
            : ""
        }
      </div>`;
    })
    .join("");

  const body = `
    ${businessHeader(data.business)}
    <div class="doc-type"><span class="doc-type-label">Invoice</span></div>
    <div class="meta">
      ${metaRow("Invoice No.", data.invoiceNumber, true)}
      ${metaRow("Date", data.date, true)}
      ${metaRow("Time", data.time, true)}
      ${data.customerName ? metaRow("Customer", data.customerName) : ""}
      ${data.customerPhone ? metaRow("Phone", data.customerPhone, true) : ""}
    </div>
    <div class="section-label">Items</div>
    <div class="items-head">
      <span>ITEM</span>
      <span class="col-qty">QTY</span>
      <span class="col-price">PRICE</span>
    </div>
    ${itemsHtml}
    <div class="totals">
      <div class="total-row muted"><span class="k">Subtotal</span><span class="v mono">${formatMoney(data.subtotal)}</span></div>
      ${data.discount > 0 ? `<div class="total-row muted"><span class="k">Discount</span><span class="v mono">−${formatMoney(data.discount)}</span></div>` : ""}
      ${data.tax > 0 ? `<div class="total-row muted"><span class="k">Tax</span><span class="v mono">+${formatMoney(data.tax)}</span></div>` : ""}
      <div class="total-row grand"><span class="k">TOTAL</span><span class="v mono">${formatMoney(data.total)}</span></div>
    </div>
    <div class="pay-box">
      <div class="pay-row"><span>Payment</span><span class="v">${escapeHtml(data.paymentMethod)}</span></div>
      ${data.depositApplied > 0 ? `<div class="pay-row"><span>Advance applied</span><span class="v mono">${formatMoney(data.depositApplied)}</span></div>` : ""}
      <div class="pay-row"><span>Amount paid</span><span class="v mono">${formatMoney(data.amountPaid)}</span></div>
      ${amountDue > 0 ? `<div class="pay-row"><span>Due payment</span><span class="v mono">${formatMoney(amountDue)}</span></div>` : ""}
      ${changeGiven > 0 ? `<div class="pay-row"><span>Change</span><span class="v mono">${formatMoney(changeGiven)}</span></div>` : ""}
    </div>
    <div class="thanks">Thank you for visiting</div>
    <div class="sub-thanks">We look forward to seeing you again</div>
    ${creditFooter()}
  `;

  return wrapThermalDocument(data.invoiceNumber, body, paper);
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
  paperWidth?: ThermalPaperWidth;
};

export function renderTokenReceiptHtml(data: TokenReceiptInput): string {
  const paper = data.paperWidth ?? DEFAULT_THERMAL_PAPER;
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

  return wrapThermalDocument(`Token ${data.tokenNumber}`, body, paper);
}

export type AppointmentReceiptInput = {
  business: BusinessPrintInfo;
  bookingNumber?: string | null;
  customerName: string;
  customerPhone?: string | null;
  staffName?: string | null;
  services: { name: string; price: number }[];
  scheduledAt: string;
  source: string;
  status: string;
  advanceAmount?: number;
  pendingApproval?: boolean;
  paperWidth?: ThermalPaperWidth;
};

export function renderAppointmentReceiptHtml(data: AppointmentReceiptInput): string {
  const paper = data.paperWidth ?? DEFAULT_THERMAL_PAPER;
  const scheduled = new Date(data.scheduledAt);
  const dateStr = formatDate(scheduled, "weekday");
  const timeStr = formatTime(scheduled);
  const serviceTotal = data.services.reduce((s, x) => s + x.price, 0);
  const sourceLabel = data.source === "ONLINE" ? "Online booking" : "Reception";

  const servicesHtml = data.services
    .map(
      (s) => `
      <div class="item">
        <div class="item-top">
          <span class="item-name">${escapeHtml(s.name)}</span>
          <span class="item-qty"></span>
          <span class="item-price mono">${formatMoney(s.price)}</span>
        </div>
      </div>`
    )
    .join("");

  const body = `
    ${businessHeader(data.business)}
    <div class="doc-type"><span class="doc-type-label">Appointment</span></div>
    <div class="meta">
      ${data.bookingNumber ? metaRow("Booking No.", data.bookingNumber, true) : ""}
      ${metaRow("Booking", sourceLabel)}
      ${metaRow("Status", data.status)}
      ${metaRow("Customer", data.customerName)}
      ${data.customerPhone ? metaRow("Phone", data.customerPhone, true) : ""}
      ${data.staffName ? metaRow("Stylist", data.staffName) : ""}
      ${metaRow("Date", dateStr, true)}
      ${metaRow("Time", timeStr, true)}
    </div>
    <div class="section-label">Services</div>
    <div class="items-head">
      <span>ITEM</span>
      <span class="col-qty"></span>
      <span class="col-price">PRICE</span>
    </div>
    ${servicesHtml}
    <div class="totals">
      <div class="total-row grand"><span class="k">TOTAL</span><span class="v mono">${formatMoney(serviceTotal)}</span></div>
      ${
        data.advanceAmount && data.advanceAmount > 0
          ? `<div class="total-row muted"><span class="k">Advance</span><span class="v mono">${formatMoney(data.advanceAmount)}${data.pendingApproval ? " (pending)" : ""}</span></div>`
          : ""
      }
    </div>
    <div class="thanks">${data.pendingApproval ? "Awaiting confirmation" : "Booking confirmed"}</div>
    <div class="sub-thanks">${data.bookingNumber ? `Ref ${escapeHtml(data.bookingNumber)} · ` : ""}We look forward to seeing you</div>
    ${creditFooter()}
  `;

  return wrapThermalDocument(data.bookingNumber ?? "Appointment", body, paper);
}
