/**
 * Natural-language quick add. Pure and client-safe.
 *
 * Understands, for example:
 *   "Email advisor tomorrow 3pm p1 #phd ~30m"
 *   "Pay rent every month on the 1st !finance"
 *   "Grade exams by friday high energy @teaching"
 * Tokens: p1–p5 / "urgent" / "!!" for priority, #category or @category (fuzzy match on name),
 * ~30m / ~2h / "for 45 minutes" for estimates, "every …" for recurrence, chrono-node for dates.
 */
import * as chrono from "chrono-node";
import { toDateKey } from "./dates";
import type { RecurrenceRule } from "./recurrence";
import type { CategoryDTO, ProjectDTO } from "./types";

export type ParsedTask = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: number | null;
  categoryId: string | null;
  projectId: string | null;
  estimateMin: number | null;
  energy: "low" | "medium" | "high" | null;
  recurrence: RecurrenceRule | null;
  tags: string[];
  chips: { label: string; value: string }[];
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function matchByName<T extends { id: string; name: string }>(items: T[], token: string): T | undefined {
  const t = norm(token);
  if (!t) return undefined;
  return (
    items.find((i) => norm(i.name) === t) ??
    items.find((i) => norm(i.name).startsWith(t)) ??
    items.find((i) => i.name.toLowerCase().split(/[^a-z0-9]+/).some((w) => w && w.startsWith(t))) ??
    items.find((i) => norm(i.name).includes(t))
  );
}

export function parseQuickAdd(
  input: string,
  categories: CategoryDTO[],
  projects: ProjectDTO[],
  ref: Date = new Date(),
): ParsedTask {
  let text = ` ${input.trim()} `;
  const chips: ParsedTask["chips"] = [];
  const cut = (re: RegExp) => {
    text = text.replace(re, " ");
  };

  // Priority
  let priority: number | null = null;
  const p = text.match(/\s(?:p([1-5])|!([1-5]))\s/i);
  if (p) {
    priority = Number(p[1] ?? p[2]);
    cut(/\s(?:p[1-5]|![1-5])(?=\s)/i);
  } else if (/\s(urgent|asap|critical|!!!?)\s/i.test(text)) {
    priority = 1;
    cut(/\s(urgent|asap|critical|!!!?)(?=\s)/i);
  } else if (/\s(important|high priority)\s/i.test(text)) {
    priority = 2;
    cut(/\s(important|high priority)(?=\s)/i);
  } else if (/\s(someday|low priority)\s/i.test(text)) {
    priority = /someday/i.test(text) ? 5 : 4;
    cut(/\s(someday|low priority)(?=\s)/i);
  }

  // Energy
  let energy: ParsedTask["energy"] = null;
  const e = text.match(/\s(low|medium|high)[ -]energy\s/i);
  if (e) {
    energy = e[1].toLowerCase() as ParsedTask["energy"];
    cut(/\s(low|medium|high)[ -]energy(?=\s)/i);
  }

  // Estimate: ~30m, ~1.5h, "for 45 min", "2 hours"
  let estimateMin: number | null = null;
  const est =
    text.match(/\s~(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs)?(?=\s)/i) ??
    text.match(/\sfor\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|h|m)(?=\s)/i);
  if (est) {
    const n = Number(est[1]);
    const unit = (est[2] ?? "m").toLowerCase();
    estimateMin = Math.round(unit.startsWith("h") ? n * 60 : n);
    text = text.replace(est[0], " ");
  }

  // Recurrence
  let recurrence: RecurrenceRule | null = null;
  const every = text.match(
    /\s(every\s+(?:(\d+)\s+)?(day|days|weekday|weekdays|week|weeks|month|months|year|years|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)s?(?:\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?)?|daily|weekly|monthly|yearly)(?=\s)/i,
  );
  if (every) {
    const word = (every[3] ?? every[1]).toLowerCase();
    const interval = every[2] ? Number(every[2]) : 1;
    if (word === "daily" || word.startsWith("day")) recurrence = { freq: "daily", interval };
    else if (word.startsWith("weekday")) recurrence = { freq: "weekdays", interval: 1 };
    else if (word === "weekly" || word.startsWith("week")) recurrence = { freq: "weekly", interval };
    else if (word === "monthly" || word.startsWith("month"))
      recurrence = { freq: "monthly", interval, ...(every[4] ? { byMonthDay: Number(every[4]) } : {}) };
    else if (word === "yearly" || word.startsWith("year")) recurrence = { freq: "yearly", interval };
    else if (word in WEEKDAYS) recurrence = { freq: "weekly", interval, byWeekday: [WEEKDAYS[word]] };
    text = text.replace(every[0], " ");
  }

  // Category (#name or @name). Multi-word names can be typed without spaces: #phdresearch, or by first word: #phd.
  let categoryId: string | null = null;
  let projectId: string | null = null;
  const tags: string[] = [];
  text = text.replace(/\s([#@+])([\w&-]+)(?=\s)/g, (whole, sigil: string, word: string) => {
    if (sigil === "+") {
      const proj = matchByName(projects.filter((x) => !x.deletedAt && !x.archivedAt), word);
      if (proj && !projectId) {
        projectId = proj.id;
        return " ";
      }
      return whole;
    }
    const cat = matchByName(categories, word);
    if (cat && !categoryId) {
      categoryId = cat.id;
      return " ";
    }
    if (sigil === "#") {
      tags.push(word.toLowerCase());
      return " ";
    }
    return whole;
  });
  if (projectId && !categoryId) categoryId = projects.find((x) => x.id === projectId)?.categoryId ?? null;

  // Dates & times via chrono (after removing the other tokens so they don't confuse it).
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  const results = chrono.casual.parse(text, ref, { forwardDate: true });
  if (results.length) {
    const r = results[0];
    const d = r.start.date();
    dueDate = toDateKey(d);
    if (r.start.isCertain("hour")) {
      dueTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    // Remove the matched text plus a dangling connector ("by", "on", "at", "due").
    const before = text.slice(0, r.index).replace(/\s(by|on|at|due|before)\s*$/i, " ");
    text = before + " " + text.slice(r.index + r.text.length);
  }
  if (!dueDate && recurrence) {
    // A repeating task with no explicit date starts on its next occurrence (today for daily rules).
    dueDate = toDateKey(ref);
    if (recurrence.freq === "weekly" && recurrence.byWeekday?.length) {
      const diff = (recurrence.byWeekday[0] - ref.getDay() + 7) % 7;
      dueDate = toDateKey(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff));
    }
    if (recurrence.freq === "monthly" && recurrence.byMonthDay && recurrence.byMonthDay > 0) {
      const day = recurrence.byMonthDay;
      const month = ref.getDate() <= day ? ref.getMonth() : ref.getMonth() + 1;
      dueDate = toDateKey(new Date(ref.getFullYear(), month, day));
    }
  }

  const title = text.replace(/\s+/g, " ").trim() || input.trim();

  if (dueDate) chips.push({ label: "Due", value: dueDate + (dueTime ? ` ${dueTime}` : "") });
  if (priority) chips.push({ label: "Priority", value: `P${priority}` });
  if (categoryId) chips.push({ label: "Category", value: categories.find((c) => c.id === categoryId)?.name ?? "" });
  if (projectId) chips.push({ label: "Project", value: projects.find((x) => x.id === projectId)?.name ?? "" });
  if (estimateMin) chips.push({ label: "Estimate", value: `${estimateMin} min` });
  if (energy) chips.push({ label: "Energy", value: energy });
  if (recurrence) chips.push({ label: "Repeats", value: recurrence.freq });
  if (tags.length) chips.push({ label: "Tags", value: tags.map((t) => `#${t}`).join(" ") });

  return { title, dueDate, dueTime, priority, categoryId, projectId, estimateMin, energy, recurrence, tags, chips };
}
