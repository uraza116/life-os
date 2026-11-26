import { addDays, addMonths, addWeeks, addYears, getDay, lastDayOfMonth, setDate } from "date-fns";
import { fromDateKey, toDateKey } from "./dates";

export type RecurrenceRule = {
  freq: "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** 0 = Sunday … 6 = Saturday (weekly only) */
  byWeekday?: number[];
  /** Day of month (monthly only). -1 = last day. */
  byMonthDay?: number;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeRecurrence(r: RecurrenceRule | null | undefined): string {
  if (!r) return "Does not repeat";
  const every = r.interval > 1 ? `Every ${r.interval} ` : "Every ";
  switch (r.freq) {
    case "daily":
      return r.interval > 1 ? `${every}days` : "Daily";
    case "weekdays":
      return "Every weekday";
    case "weekly": {
      const days = r.byWeekday?.length ? ` on ${r.byWeekday.map((d) => WEEKDAY_NAMES[d]).join(", ")}` : "";
      return (r.interval > 1 ? `${every}weeks` : "Weekly") + days;
    }
    case "monthly": {
      const day = r.byMonthDay === -1 ? " on the last day" : r.byMonthDay ? ` on day ${r.byMonthDay}` : "";
      return (r.interval > 1 ? `${every}months` : "Monthly") + day;
    }
    case "yearly":
      return r.interval > 1 ? `${every}years` : "Yearly";
  }
}

/** Next occurrence strictly after `fromKey`. */
export function nextOccurrence(fromKey: string, rule: RecurrenceRule): string {
  const from = fromDateKey(fromKey);
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.freq) {
    case "daily":
      return toDateKey(addDays(from, interval));
    case "weekdays": {
      let d = addDays(from, 1);
      while (getDay(d) === 0 || getDay(d) === 6) d = addDays(d, 1);
      return toDateKey(d);
    }
    case "weekly": {
      const days = rule.byWeekday?.length ? [...rule.byWeekday].sort() : [getDay(from)];
      // later day in the same week?
      const cur = getDay(from);
      const later = days.find((d) => d > cur);
      if (later !== undefined && interval === 1) return toDateKey(addDays(from, later - cur));
      if (later !== undefined) return toDateKey(addDays(from, later - cur));
      const weekStart = addDays(from, -cur);
      return toDateKey(addDays(addWeeks(weekStart, interval), days[0]));
    }
    case "monthly": {
      const next = addMonths(from, interval);
      if (rule.byMonthDay === -1) return toDateKey(lastDayOfMonth(next));
      if (rule.byMonthDay) {
        const last = lastDayOfMonth(next).getDate();
        return toDateKey(setDate(next, Math.min(rule.byMonthDay, last)));
      }
      return toDateKey(next);
    }
    case "yearly":
      return toDateKey(addYears(from, interval));
  }
}

export function parseRecurrence(json: string | null | undefined): RecurrenceRule | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json);
    return r && typeof r.freq === "string" ? (r as RecurrenceRule) : null;
  } catch {
    return null;
  }
}
