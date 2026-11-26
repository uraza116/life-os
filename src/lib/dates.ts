import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/** Local calendar date as YYYY-MM-DD. */
export function toDateKey(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDaysKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Whole days from today until `key` (negative = in the past). */
export function daysUntil(key: string, from: string = todayKey()): number {
  return differenceInCalendarDays(fromDateKey(key), fromDateKey(from));
}

export function formatDue(key: string | null | undefined, time?: string | null): string {
  if (!key) return "";
  const d = daysUntil(key);
  let label: string;
  if (d === 0) label = "Today";
  else if (d === 1) label = "Tomorrow";
  else if (d === -1) label = "Yesterday";
  else if (d > 1 && d < 7) label = format(fromDateKey(key), "EEEE");
  else if (d < -1 && d > -7) label = `${-d} days ago`;
  else label = format(fromDateKey(key), fromDateKey(key).getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
  return time ? `${label} · ${formatTime(time)}` : label;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatMinutes(min: number | null | undefined): string {
  if (!min) return "0m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
