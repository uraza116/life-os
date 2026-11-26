# Life OS roadmap

## Phase 1: core task management (done)

- Screens: Overview dashboard, My Day (with daily note), Inbox, All Tasks (filters, sort, search, bulk edit, saved views), Upcoming, Projects with milestones, Completed, Archive and Trash, Settings
- Transparent 0–100 priority score with reasons, editable weights and manual override; Eisenhower quadrant
- Natural-language quick add with a preview; Ctrl+K command palette; light and dark themes
- Repeating tasks, checklists, dependencies, "waiting on" with follow-up dates
- Editable life categories and subcategories; demo data you can load and remove
- JSON and CSV export, JSON import (merge or replace)
- Docker image (`usman116/life-os`)

## Later phases

These appear in the sidebar as dimmed "soon" items. The database already has tables for most of them.

| Feature | What it would add | Ready in the schema |
| --- | --- | --- |
| Calendar | Week and month views of due dates, plus time blocks (`scheduledStart`/`scheduledEnd`) | Partly (`Event`, task time fields) |
| Kanban | Drag tasks between status columns (dnd-kit is installed) | Yes (task `status`, `sortOrder`) |
| Goals | Quarterly and yearly goals with progress rolled up from projects and tasks | Yes (`Goal`) |
| Habits | Daily and weekly habits with streaks | Yes (`Habit`, `HabitLog`) |
| Brain Dump | A scratch area that turns lines into Inbox tasks | Yes (`Note` with `kind = "braindump"`) |
| Focus | Pomodoro and stopwatch sessions that add to a task's actual time | Yes (`FocusSession`) |
| Analytics | Completion trends, time estimated vs spent, postponement patterns | Data is collected (`completedAt`, `actualMin`, `postponeCount`) |
| AI assistant | Optional suggestions for planning the day and breaking down tasks, off by default | Settings fields exist (`aiEnabled`, `aiProvider`) |

## Skipped on purpose (for now)

- Mobile layout, PWA install, passcode lock and access from other devices on the network. The app stays local-only on `127.0.0.1`.

## Possible improvements

- A slimmer Docker image using Next.js "standalone" output (the current one is about 1.7 GB)
- Automated tests for `scoring.ts`, `nlp.ts`, `recurrence.ts` and the import round trip (Vitest is installed)
- Drag-and-drop ordering within lists and of categories
- Reminders and notifications (the `Notification` model exists)
