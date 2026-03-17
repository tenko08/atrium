# Phase 2: Canvas Sync - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect to the Canvas LMS API, pull all assignments across all active courses (with pagination and section-level due-date overrides), and persist them into the local SQLite database. This phase is pure backend data plumbing + a minimal sync UI. No assignment list view, no time estimates — those are Phase 3 and 4.

</domain>

<decisions>
## Implementation Decisions

### Credential storage
- Canvas API token and institution URL are read from `.env` only — `CANVAS_API_TOKEN` and `CANVAS_BASE_URL` in `apps/api/.env`
- No settings UI, no DB-stored credentials
- Single-user personal tool; multi-user auth is explicitly out of scope for v1

### Sync trigger
- App auto-syncs on page load (fires automatically when the frontend mounts)
- A "Sync Now" button is always visible for on-demand refresh (satisfies CANV-05)

### Sync feedback UI
- The Sync Now button shows a spinner + "Syncing..." text while running
- When idle: button shows "↻ Sync Now"
- After completing: "Last synced X ago" timestamp shown beneath the button
- No result summary (new/updated counts) — just the timestamp

### Sync status on assignments
- Each assignment row shows a colored dot next to the name to indicate sync status:
  - **Green dot** = new assignment (first seen this sync)
  - **Orange dot** = updated assignment (changed since last sync)
  - No dot = unchanged
- This dot state is derived from comparing the incoming Canvas data to what was previously stored

### Error handling — network/Canvas errors
- If sync fails (Canvas unreachable, API error, timeout), show inline error text near the button: "Sync failed — Canvas unreachable" in red
- Previous data stays visible and usable
- User can retry via the Sync Now button

### Error handling — missing/invalid token
- If `CANVAS_API_TOKEN` or `CANVAS_BASE_URL` is missing from `.env`, the app shows a **blocking error state** — a full-page message instructing the user to add the variables to `apps/api/.env`
- Nothing else in the app renders until this is resolved
- Prevents silent confusion from a misconfigured setup

### Claude's Discretion
- Canvas API pagination strategy (Link header vs offset)
- Section due-date override lookup logic (per-student override vs default course deadline)
- Rate limit handling implementation (backoff strategy, retry count)
- How "sync status" is stored — a column on `assignments` or computed at query time
- Exact red/green/orange color tokens used

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Canvas API
- Canvas LMS REST API docs: `https://canvas.instructure.com/doc/api/` — assignments endpoint, pagination via Link headers, section overrides
- Note: rate limit header names vary by institution deployment (flagged in STATE.md) — validate against actual Canvas instance

### Project requirements
- `.planning/REQUIREMENTS.md` §Canvas Integration — CANV-01 through CANV-05 define the acceptance criteria for this phase

### Schema
- `packages/db/src/schema/assignments.ts` — existing assignments table (has `canvas_id`, `source`, `course_id`, `course_name`, `due_at` already defined)
- `packages/db/src/client.ts` — Drizzle client pattern to follow

### API patterns
- `apps/api/src/routes/health.ts` — Elysia route structure to follow
- `apps/api/src/index.ts` — how routes are registered on the Elysia app

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/client.ts` — Drizzle + bun:sqlite client, import `db` from here
- `packages/db/src/schema/assignments.ts` — assignments table already has all Canvas fields; Phase 2 writes to this table directly
- `apps/web/src/api.ts` — Eden Treaty client (`api`), use this to call sync endpoints from the frontend

### Established Patterns
- Elysia routes: export a `new Elysia()` plugin from `src/routes/`, register in `src/index.ts`
- DB access: import `db` from `@atrium/db`, use Drizzle query builder
- Environment variables: read from `process.env` in `apps/api` only — never in `apps/web`
- Frontend calls backend via Eden Treaty typed client at `http://localhost:3001`

### Integration Points
- New Canvas sync route(s) added to `apps/api/src/routes/` and registered in `apps/api/src/index.ts`
- Frontend sync button + status UI lives in `apps/web` — calls the sync endpoint via Eden Treaty
- `assignments` table in SQLite is the sync target — upsert on `canvas_id`

</code_context>

<specifics>
## Specific Ideas

- Green dot = new assignment, orange dot = updated assignment (no dot = unchanged) — shown next to assignment name in the UI
- Blocking error screen when `.env` vars are missing: show exact variable names (`CANVAS_API_TOKEN`, `CANVAS_BASE_URL`) so setup is unambiguous

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-canvas-sync*
*Context gathered: 2026-03-16*
