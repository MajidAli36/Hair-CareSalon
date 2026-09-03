/** Opens a thermal receipt in a print dialog (80mm receipt printer layout). */
export function printThermalHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "none";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const print = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        document.body.removeChild(frame);
      }, 1000);
    }
  };

  if (frame.contentWindow?.document.readyState === "complete") {
    print();
  } else {
    frame.onload = print;
  }
}
