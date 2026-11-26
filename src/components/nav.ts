import {
  Archive, Brain, Calendar, CalendarClock, ChartBar, CircleCheck, FolderKanban, Inbox, LayoutDashboard, ListTodo, Repeat,
  Settings, Sparkles, SquareKanban, Sun, Target, Timer, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean };

export const NAV_MAIN: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/my-day", label: "My Day", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tasks", label: "All Tasks", icon: ListTodo },
  { href: "/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/completed", label: "Completed", icon: CircleCheck },
  { href: "/trash", label: "Archive & Trash", icon: Archive },
];

/** Later-phase features: shown dimmed and not clickable until they are built. */
export const NAV_SOON: NavItem[] = [
  { href: "#", label: "Calendar", icon: Calendar, soon: true },
  { href: "#", label: "Kanban", icon: SquareKanban, soon: true },
  { href: "#", label: "Goals", icon: Target, soon: true },
  { href: "#", label: "Habits", icon: Repeat, soon: true },
  { href: "#", label: "Brain Dump", icon: Brain, soon: true },
  { href: "#", label: "Focus", icon: Timer, soon: true },
  { href: "#", label: "Analytics", icon: ChartBar, soon: true },
  { href: "#", label: "AI Assistant", icon: Sparkles, soon: true },
];

export const NAV_SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings };
