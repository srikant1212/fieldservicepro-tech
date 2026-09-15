export function formatCurrency(amount: number, symbol: string = "$"): string {
  return `${symbol}${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string, format: "short" | "long" | "relative" = "short"): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const days = Math.floor((new Date().getTime() - date.getTime()) / 86400000);
  if (format === "relative") {
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days === -1) return "Tomorrow";
    if (days > 0 && days < 7) return `${days} days ago`;
    if (days < 0 && days > -7) return `In ${Math.abs(days)} days`;
  }
  if (format === "long") return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const clean = phone.replace(/[^0-9]/g, "");
  if (clean.length === 10 && clean.startsWith("04")) return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  return phone;
}

export function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000);
}
