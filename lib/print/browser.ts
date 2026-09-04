import type { ThermalPaperWidth } from "@/lib/print/thermal-html";

const PAPER_MM: Record<ThermalPaperWidth, number> = {
  "80mm": 80,
  "58mm": 58,
};

function detectPaperWidth(html: string): ThermalPaperWidth {
  if (html.includes('data-paper="58mm"')) return "58mm";
  return "80mm";
}

export type PrintThermalOptions = {
  /** Override paper width used for the print iframe layout. */
  paperWidth?: ThermalPaperWidth;
};

/**
 * Opens a thermal receipt in the browser print dialog.
 * Uses an off-screen iframe sized to the thermal paper width so Chrome/Edge
 * respect `@page { size: NNmm auto }` instead of defaulting to A4/Letter.
 */
export function printThermalHtml(html: string, options?: PrintThermalOptions): void {
  const paper = options?.paperWidth ?? detectPaperWidth(html);
  const widthMm = PAPER_MM[paper];

  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Thermal receipt print");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${widthMm}mm`,
    height: "10mm",
    border: "0",
    margin: "0",
    padding: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      if (frame.parentNode) document.body.removeChild(frame);
    } catch {
      /* already removed */
    }
  };

  const runPrint = () => {
    // Size iframe to content height so print engines see a content-driven page.
    try {
      const contentHeight = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0,
        40
      );
      frame.style.height = `${contentHeight}px`;
    } catch {
      frame.style.height = "auto";
    }

    const onAfterPrint = () => {
      win.removeEventListener("afterprint", onAfterPrint);
      window.setTimeout(cleanup, 250);
    };
    win.addEventListener("afterprint", onAfterPrint);

    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }

    // Fallback cleanup if afterprint never fires (some embedded WebViews).
    window.setTimeout(cleanup, 60_000);
  };

  // Allow layout/fonts to settle before measuring and printing.
  const schedule = () => {
    requestAnimationFrame(() => {
      window.setTimeout(runPrint, 50);
    });
  };

  if (doc.readyState === "complete") {
    schedule();
  } else {
    frame.onload = schedule;
  }
}
