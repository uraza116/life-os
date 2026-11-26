# Life OS architecture

Life OS is a single-user Next.js app that runs on your own computer. The browser loads the whole workspace once, works on it locally, and sends each change to a small REST API backed by SQLite.

```
Browser (React client)                         Next.js server (127.0.0.1)                SQLite
┌──────────────────────────────┐   GET /api/bootstrap   ┌─────────────────────────┐   ┌──────────┐
│ StoreProvider (store.tsx)    │ ─────────────────────► │ route handlers          │   │          │
│  workspace snapshot          │                        │  Zod validation         │──►│ Prisma 7 │
│  optimistic mutations        │ ◄───── JSON DTOs ───── │  src/lib/server/*       │   │ + better │
│  scores, filters, stats      │   POST/PATCH/DELETE    │                         │   │ -sqlite3 │
│  (pure modules in src/lib)   │ ─────────────────────► │                         │   └──────────┘
└──────────────────────────────┘                        └─────────────────────────┘
```

## Data flow

1. **Load once.** On startup the client calls `GET /api/bootstrap`, which returns settings, categories (with subcategories), projects (with milestones), every task (with checklist and dependency ids), saved views and daily notes. On first run it also creates the Settings row and the nine default categories.
2. **Change locally first.** Each store action (`src/components/store.tsx`) updates the in-memory snapshot straight away, so the UI responds instantly.
3. **Then persist.** The action calls the API. The server validates the body with Zod (`src/lib/validation.ts`), writes with Prisma, and returns the saved row as a DTO, which replaces the optimistic copy.
4. **Recover on failure.** If a request fails, the store shows a toast and reloads the whole snapshot, so the screen never drifts from the database.

Scoring, filtering, sorting and dashboard statistics run in the browser from pure functions, so they need no server round trip and are easy to test.

## Modules

| Path | Role |
| --- | --- |
| `src/lib/types.ts` | DTO types shared by server and client (`TaskDTO`, `ProjectDTO`, `Workspace`, …) |
| `src/lib/validation.ts` | Zod schemas for every API body |
| `src/lib/scoring.ts` | The 0–100 priority score, its reasons, action bucket and Eisenhower quadrant |
| `src/lib/nlp.ts` | Quick-add parser: chrono-node dates plus tokens for priority, category, project, estimate, energy and repetition |
| `src/lib/recurrence.ts` | Repeat rules and "next occurrence" |
| `src/lib/filters.ts` | Task filters, sorting, project progress, completion series |
| `src/lib/dates.ts` | Date-key helpers (`YYYY-MM-DD` in local time) |
| `src/lib/server/serialize.ts` | Prisma row → DTO converters |
| `src/lib/server/tasks.ts` | Task create/update, including recurrence spawning and postpone counting |
| `src/lib/server/seed.ts` | Default categories and demo data |
| `src/lib/server/import.ts` | JSON import (merge or replace) in one transaction |
| `src/lib/server/http.ts` | Error mapping: Zod → 400, missing row → 404, other → 500 |
| `src/components/store.tsx` | The client store (React context) |
| `src/components/shell.tsx` | Sidebar, header, keyboard shortcuts, theme |
| `src/components/views/*` | One file per screen group |
| `src/app/*/page.tsx` | Thin route wrappers around the views |

## API

All bodies are JSON and validated with Zod. Errors return `{ "error": "…" }` with a 400, 404 or 500 status.

| Method and path | Purpose |
| --- | --- |
| `GET /api/bootstrap` | Whole workspace snapshot |
| `POST /api/tasks` | Create a task (the client may send its own `id`) |
| `PATCH /api/tasks/:id` | Update a task. `deleted` / `archived` flags soft-delete or archive. Completing a repeating task returns the next occurrence as `spawned`. |
| `DELETE /api/tasks/:id` | Delete a task permanently |
| `POST /api/tasks/bulk` | `update`, `complete`, `reopen`, `delete`, `restore`, `archive`, `unarchive` or `purge` many tasks |
| `POST /api/categories`, `PATCH`/`DELETE /api/categories/:id` | Categories |
| `POST /api/subcategories`, `PATCH`/`DELETE /api/subcategories/:id` | Subcategories |
| `POST /api/projects`, `PATCH`/`DELETE /api/projects/:id` | Projects (`PATCH` also archives, trashes and restores) |
| `POST /api/milestones`, `PATCH`/`DELETE /api/milestones/:id` | Milestones |
| `POST /api/views`, `PATCH`/`DELETE /api/views/:id` | Saved views (filters + sort) |
| `PUT /api/notes` | Save the daily note for a date (empty content deletes it) |
| `PATCH /api/settings` | Settings, including scoring-weight overrides |
| `POST /api/demo`, `DELETE /api/demo` | Load or remove demo rows (`isDemo = true`) |
| `GET /api/export?format=json\|csv` | Full JSON backup or a tasks CSV |
| `POST /api/import` | `{ mode: "merge" \| "replace", data: <JSON export> }` |

## Data model

The schema is in `prisma/schema.prisma`. Conventions:

- **Enum-like fields are strings**, validated by Zod, so the schema stays portable to PostgreSQL.
- **Calendar dates are `"YYYY-MM-DD"` strings** in the user's local calendar, so a due date never shifts with time zones. Moments in time (`createdAt`, `completedAt`) are `DateTime`.
- **JSON lists are stored as strings** (`tags`, `recurrence`, saved-view `filters`, `scoringWeights`).
- **Soft delete and archive:** `deletedAt` puts a row in Trash, `archivedAt` hides it. Trash can be emptied permanently.
- **Demo data:** demo rows carry `isDemo = true` and are removed in one statement per table.

Some models (Event, Goal, Habit, FocusSession, Notification, Template, Review) exist for later phases and are not used yet.

## The priority score

`scoreTask()` in `src/lib/scoring.ts` turns each factor into a value from 0 to 1 and multiplies it by a weight. The default base weights add up to 100:

| Factor | Default weight |
| --- | --- |
| Deadline proximity | 24 |
| Importance | 20 |
| Assigned priority (P1–P5) | 15 |
| Urgency | 11 |
| Potential impact | 10 |
| Project and category importance | 8 |
| Quick win (low effort) | 5 |
| Energy fit | 4 |
| Unblocks other tasks | 3 |
| Overdue boost (extra, capped at 7 days and scaled by importance) | 10 |

Modifiers then lower the score: unfinished dependencies (×0.5), waiting/blocked/on hold (×0.6), a future start date (×0.6), and an estimate longer than the time available (×0.85). "Someday" (P5) tasks are capped at 35. A manual score replaces the computed one.

The weights can be changed in **Settings → Priority score weights**. Only the changed values are stored (`Settings.scoringWeights`).

Each task also gets an **Eisenhower quadrant** (important = importance ≥ 4 or P1/P2; urgent = urgency ≥ 4 or due within 2 days) and an **action bucket** (Do Now, Do Today, This Week, Later, Delegate, Consider Eliminating).

## Next.js 16 notes

The app uses `cacheComponents: true`, which prerenders pages. This leads to a few rules, also listed in `CLAUDE.md`:

- Client components must not read the clock during render. The store's `today` starts empty and is set in an effect.
- `usePathname`, `useParams` and `useSearchParams` must sit inside a `<Suspense>` boundary, or `next build` fails on dynamic routes.
- The shell always renders `{children}`. Views return `null` until the workspace has loaded.
- GET route handlers that read the database call `await connection()` first.

## Security and privacy

- The server binds to `127.0.0.1` only (dev, start and the Docker port mapping), so other devices can't reach it. There is no login, because only you can reach it.
- The database lives outside OneDrive (`%LOCALAPPDATA%\LifeOS\life-os.db`), because syncing can corrupt SQLite files.
- `.env`, database files, `/data` and `/backups` are gitignored.
