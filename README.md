# Life OS

A personal task and life planner that runs on your own computer. Tasks get a transparent 0–100 priority score, you can add them in plain English ("call advisor tomorrow 3pm p2 #PhD"), and everything is stored in a local SQLite database. Nothing is sent to a server.

**Status:** Phase 1 (core task management) is built and works locally. It is single-user and listens only on `127.0.0.1`, so other devices on your network can't reach it.

## What it does (Phase 1)

- **Screens:**
  - Overview dashboard
  - My Day
  - Inbox
  - All Tasks, with filters, sort, search and bulk edit
  - Upcoming
  - Projects, with milestones
  - Completed
  - Archive and Trash
  - Settings
- **Priority score:**
  - Each task gets a 0–100 score built from importance, urgency, impact, due date and other factors.
  - The task shows the reasons behind its score.
  - You can override the score by hand.
  - Tasks are also placed in an Eisenhower (urgent/important) quadrant.
- **Quick add** (`Q` or `N`) understands natural language:
  - dates and times
  - `p1`–`p5` for priority
  - `#category`
  - `+project`
  - `~30m` for a time estimate
  - `every Monday` for repeating tasks
  - It shows a preview before saving.
- **Task details:**
  - recurring tasks
  - checklists
  - dependencies
  - "waiting on" with follow-up dates
  - energy level
  - time estimates
- **Command palette** (`Ctrl+K`) for jumping to any screen or task.
- **Life categories** you can edit: Business, PhD & Research, Teaching, Career, Side Projects, Personal & Family, Finance, Health and Learning, each with subcategories.
- **Demo data** you can load and remove from Settings. Removing it never touches your own tasks.
- **Export** to JSON or CSV.
- Light and dark themes.

Calendar, Kanban, Goals, Habits, Brain Dump, Focus, Analytics and AI appear in the sidebar as dimmed "soon" items. They are not built yet.

## Run it

You need Node.js 20 or newer.

```powershell
cd "ToDo List"
npm install
npm run dev -- -p 3100
```

Then open http://127.0.0.1:3100.

### First-time setup on a new computer

The database and `.env` are not in git, so a fresh copy needs two extra steps:

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
   - Keep the database **outside** OneDrive or Dropbox, because syncing can corrupt SQLite files.
   - For example: `DATABASE_URL="file:C:/Users/<you>/AppData/Local/LifeOS/life-os.db"`
2. Create the database and generate the Prisma client:

   ```powershell
   npx prisma migrate deploy
   npx prisma generate
   ```

The app creates its default categories on first launch.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on 127.0.0.1 (add `-- -p 3100` to pick the port) |
| `npm run build` | Production build |
| `npm start` | Serve the production build on 127.0.0.1 |
| `npm run lint` | ESLint |

## Your data

- Tasks live in the SQLite file set by `DATABASE_URL`. Back it up by copying that file while the app is stopped, or by using **Settings → Export**.
- `.env`, `*.db` files, `/data` and `/backups` are gitignored, so your tasks and keys never go to GitHub.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 with SQLite (better-sqlite3) · Zod · chrono-node · cmdk · Radix UI · next-themes.

### Code layout

| Path | Contents |
| --- | --- |
| `src/app/api/*` | REST route handlers, validated with Zod |
| `src/lib/` | Scoring (`scoring.ts`), natural-language parsing (`nlp.ts`) and filters (`filters.ts`) |
| `src/lib/server/` | Database helpers and the seed data |
| `src/components/` | The app shell, the store (one client-side store with optimistic updates) and one view per screen |
| `prisma/schema.prisma` | The data model |

`CLAUDE.md` has the detailed architecture notes and known gotchas.

## Not done yet

- JSON import (export works)
- Editing scoring weights in Settings (shown read-only for now)
- Saved views and daily notes (in the data model but not in the interface)
- Later phases: calendar, Kanban, goals, habits, focus timer, analytics, AI assistance
