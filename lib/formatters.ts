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

// YYYY-MM-DD in the device's local timezone (toISOString() would give the UTC date)
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A dialable link: iOS refuses "tel:" numbers that contain spaces, brackets or dashes */
export function telUrl(phone: string): string {
  return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
}

/** "16:00:00" -> "4:00 PM" */
export function formatTime(time: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
