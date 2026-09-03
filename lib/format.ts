export function formatCurrency(amount: number | string) {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return "Rs 0";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyCompact(amount: number) {
  if (amount >= 1_000_000) return `Rs ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rs ${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
}

export function formatCustomerName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(date: Date | string, style: "short" | "long" | "weekday" = "short") {
  const d = typeof date === "string" ? new Date(date) : date;
  if (style === "long") {
    return d.toLocaleDateString("en-PK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (style === "weekday") {
    return d.toLocaleDateString("en-PK", { weekday: "long", month: "long", day: "numeric" });
  }
  return d.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" });
}

/** Always 12-hour with AM/PM — stable across SSR and client (en-PK). */
export function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Date + AM/PM time, e.g. "Sep 3, 2026 · 5:57 PM" */
export function formatDateTime(date: Date | string) {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function formatPercentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

export function getGreeting(name?: string | null) {
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = name?.split("@")[0]?.split(".")[0];
  if (firstName) {
    return `${timeGreeting}, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}`;
  }
  return timeGreeting;
}

export function getInitials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
