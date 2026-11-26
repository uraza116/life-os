# Changelog

All notable changes to Life OS. Dates are in the user's local time.

## 0.2.0 (2026-11-26)

### Added

- **JSON import** in Settings → Backup. Pick a Life OS JSON export, then either merge it (add new rows, update rows with the same id) or replace everything. The import runs in one transaction, so a bad file changes nothing.
- **Editable scoring weights** in Settings → Priority score weights, with the default shown next to any changed value and a reset button.
- **Saved views** on All Tasks: save the current filters and sort under a name, open them from the sidebar, the view picker or the command palette, update or delete them.
- **Daily note** on My Day, saved when you leave the box, with earlier notes listed underneath.
- The JSON export now includes saved views and daily notes.
- Docs: `ARCHITECTURE.md`, `ROADMAP.md` and this changelog.

### Changed

- Project card titles wrap to two lines instead of being cut off.
- Category rows in Settings stretch the name field, so rows wrap more cleanly on narrow windows.

## 0.1.0 (2026-11-26)

### Added

- Phase 1 core: Overview dashboard, My Day, Inbox, All Tasks (filters, sort, search, bulk edit), Upcoming, Projects with milestones, Completed, Archive and Trash, Settings.
- Transparent 0–100 priority score with reasons and manual override, plus an Eisenhower quadrant.
- Natural-language quick add with a preview, Ctrl+K command palette, light and dark themes.
- Repeating tasks, checklists, dependencies, "waiting on" with follow-up dates.
- Editable categories and subcategories, demo data load and remove, JSON and CSV export.
- README, `.env.example`, Dockerfile and `docker-compose.yml`; image published as `usman116/life-os`.
