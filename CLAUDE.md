# Life OS — project instructions for Claude Code

Personal productivity app ("Personal Life OS"). Single user, runs locally only (bound to 127.0.0.1).
The user's full original spec was pasted in the first session; the agreed scope is below.

## Agreed scope (user decisions)
- **Fastest path to a working local app.** The user is short on time.
- **Mobile, PWA, passcode, and LAN access are skipped** for now (user's decision, 2026-11-25).
- Phase 1 core: dashboard (Overview), My Day, Inbox, All Tasks (filters/sort/search/bulk), Upcoming,
  Projects (list + detail with milestones), Completed, Archive/Trash, Settings (categories editor,
  demo data load/remove, JSON/CSV export). Transparent 0–100 priority score + Eisenhower quadrant,
  natural-language quick add (chrono-node) with a preview before saving, Ctrl+K command palette,
  light/dark themes.
- Later-phase sidebar items (Calendar, Kanban, Goals, Habits, Brain Dump, Focus, Analytics, AI) appear
  dimmed with a "soon" label and are not clickable. No fake working buttons.
- Default life categories and demo data come from the spec: Business, PhD & Research, Teaching, Career,
  Side Projects, Personal & Family, Finance, Health, Learning. Demo rows carry `isDemo = true`.

## Stack and environment
- Node v24.22.3 portable install at `%LOCALAPPDATA%\Programs\nodejs` (on the user's PATH; in Git Bash
  run `export PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"` first).
- Next.js 16.4 (App Router, `cacheComponents: true`). **Read `node_modules/next/dist/docs/` before using
  Next APIs**: Middleware is now `proxy.ts`. GET route handlers that read the DB must `await connection()`.
- React 19.3, Tailwind v4, Prisma 7.10 + `@prisma/adapter-better-sqlite3`, Zod 4, date-fns, chrono-node,
  lucide-react, next-themes, sonner, cmdk, radix-ui, recharts, dnd-kit, motion.
- Prisma client is generated to `src/generated/prisma` (import from `@/generated/prisma/client`).
  Config lives in `prisma.config.ts` (loads `.env` via dotenv).
- **The database lives outside OneDrive** at `%LOCALAPPDATA%\LifeOS\life-os.db` (path set in `.env`), so
  OneDrive sync can't corrupt it. `.env` is gitignored and holds `AUTH_SECRET`.
- npm 11 gates install scripts: approved so far are better-sqlite3, prisma, @prisma/engines, esbuild.
  Use `npm install-scripts approve <pkg>` for new native packages.
- `prisma init` installs third-party agent skill folders (`.agents`, `.claude/skills`, `.windsurf`).
  They were deleted. Don't keep them.

## Architecture decisions
- Schema conventions (see `prisma/schema.prisma` header): enum-like fields are Strings validated by Zod;
  date-only fields are `"YYYY-MM-DD"` strings; JSON lists are stored as strings; `isDemo`, `deletedAt`
  (soft delete/Trash) and `archivedAt` are used throughout.
- Data flow plan: REST route handlers under `src/app/api/*` (Zod-validated), with the client loading a
  workspace snapshot from `/api/bootstrap` into one client store and applying optimistic mutations.
  Scoring, filters and dashboard stats run client-side from shared pure modules in `src/lib`.

## Status: Phase 1 core built and verified (2026-11-26)
The artifact idea from 2026-11-25 was dropped for now: the parent session asked for the Next.js app,
so Phase 1 was finished here. Run it with `npm run dev -- -p 3100` (port 3000 is used by the sibling
`portfolio-website/`), or preview_start `life-os` from this folder's `.claude/launch.json`.

Built:
- API (`src/app/api/*`, Zod-validated via `src/lib/validation.ts`, errors mapped in `src/lib/server/http.ts`):
  `bootstrap` (also creates the Settings row and the 9 default categories on first run), `tasks` (POST),
  `tasks/[id]` (PATCH incl. soft delete/archive flags, DELETE = permanent), `tasks/bulk`, `categories`,
  `subcategories`, `projects`, `milestones` (each with `[id]` PATCH/DELETE), `settings` (PATCH), `demo`
  (POST load / DELETE remove `isDemo` rows), `export?format=json|csv`.
- Server helpers in `src/lib/server/`: `serialize.ts` (row → DTO), `tasks.ts` (create/update; completing a
  recurring task spawns the next occurrence and moves the rule to it; later due dates bump
  `postponeCount`), `seed.ts` (default categories + demo data relative to today).
- Client: `src/components/store.tsx` (one context store, optimistic updates, resync + toast on error,
  scores memoised from `src/lib/scoring.ts`), `shell.tsx` (collapsible sidebar, header, theme toggle,
  Q/N = quick add, Ctrl+K = palette), `task-list.tsx` (rows, score tooltip with reasons, bulk bar),
  `task-editor.tsx` (side drawer with all fields, score breakdown + manual override, checklist,
  dependencies, recurrence, duplicate/archive/trash), `quick-add.tsx` (live preview of `src/lib/nlp.ts`),
  `command-palette.tsx` (cmdk with a plain substring filter), `views/*` (one file per screen group).
- Pure modules: `src/lib/nlp.ts` (chrono-node + p1–p5, #/@category, +project, ~30m, "every …", energy),
  `src/lib/filters.ts` (filtering, sorting, progress, completion series).
- Pages are thin client wrappers in `src/app/*/page.tsx`.

Gotchas found (Next 16 + cacheComponents):
- No `new Date()` during render in client components that prerender: the store's `today` starts as ""
  and is set in an effect; views render only after the workspace loads.
- `usePathname` / `useParams` / `useSearchParams` need a Suspense boundary (sidebar, `/projects`,
  `/projects/[id]`), otherwise `next build` fails on the dynamic route.
- The shell must always render `{children}` (views return null while loading), or dev logs
  "Could not validate that a segment in your UI has instant navigation".
- `src/lib/db.ts` uses `/*turbopackIgnore: true*/` on `process.cwd()` to avoid whole-project tracing.

Verified: `npx eslint`, `npx tsc --noEmit`, `next build` pass. Every Phase 1 screen was checked in the
browser pane in light and dark: quick add, editor, recurrence, bulk edit, filters, milestones, project
create/trash/restore, categories and subcategories, exports, palette, and demo load/remove (removing demo
data keeps the user's own rows). The local DB was left with the default categories and fresh demo data.

Not done yet (next steps):
1. Docs: README, ARCHITECTURE, ROADMAP, CHANGELOG, `.env.example`. JSON import is not built (export only).
2. Scoring weights are shown read-only in Settings. `settingsPatch` already accepts `scoringWeights`, so
   only the UI is missing.
3. Saved views (`SavedView` model) and daily notes are in the schema but not in the UI.
4. Small polish: project card titles truncate at narrow widths; settings category rows wrap below ~900px.
5. Later phases (Calendar, Kanban, Goals, Habits, Brain Dump, Focus, Analytics, AI) are dimmed "soon" items.
