export const TASK_STATUSES = [
  "inbox",
  "todo",
  "in_progress",
  "waiting",
  "blocked",
  "on_hold",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  inbox: "Inbox",
  todo: "To Do",
  in_progress: "In Progress",
  waiting: "Waiting on Someone",
  blocked: "Blocked",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const OPEN_STATUSES: TaskStatus[] = ["inbox", "todo", "in_progress", "waiting", "blocked", "on_hold"];
export const isOpenStatus = (s: string) => (OPEN_STATUSES as string[]).includes(s);

export const PRIORITIES = [1, 2, 3, 4, 5] as const;
export const PRIORITY_LABEL: Record<number, string> = {
  1: "P1 · Critical",
  2: "P2 · High",
  3: "P3 · Medium",
  4: "P4 · Low",
  5: "P5 · Someday",
};
export const PRIORITY_SHORT: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5" };

export const ENERGY_LEVELS = ["low", "medium", "high"] as const;
export type Energy = (typeof ENERGY_LEVELS)[number];

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Category palette. Each key maps to Tailwind-safe classes declared in globals.css. */
export const CATEGORY_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "lime",
  "emerald",
  "teal",
  "sky",
  "blue",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Hex values used for dots, charts and progress bars (works in both themes). */
export const COLOR_HEX: Record<string, string> = {
  slate: "#64748b",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  lime: "#84cc16",
  emerald: "#10b981",
  teal: "#14b8a6",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
  rose: "#f43f5e",
};

export const CATEGORY_ICONS = [
  "Briefcase",
  "GraduationCap",
  "Presentation",
  "Rocket",
  "Lightbulb",
  "Home",
  "Wallet",
  "HeartPulse",
  "BookOpen",
  "Folder",
  "Star",
  "Users",
  "Plane",
  "Code",
  "ShoppingCart",
  "Dumbbell",
] as const;
