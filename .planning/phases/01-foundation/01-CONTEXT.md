# Phase 1: Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the monorepo, define the full SQLite schema, and wire TanStack Start + ElysiaJS + Eden Treaty so the stack builds and runs end-to-end. No user-facing features — this is the foundation every subsequent phase builds on.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- Bun workspaces monorepo with separate packages: `apps/web` (TanStack Start), `apps/api` (ElysiaJS), `packages/db` (Drizzle schema + migrations + client)
- `apps/web` imports the Elysia app type directly from `apps/api` for Eden Treaty type inference — no separate types package
- `packages/db` is `@atrium/db`; only `apps/api` imports it at runtime (web never touches the DB directly)

### SQLite Schema
- Define **full schemas** for all 6 tables in Phase 1 — no skeleton-only tables. Downstream phases write data without schema changes.
- Single `assignments` table with a `source` column (`'canvas' | 'manual'`) and nullable `canvas_id` — covers both Canvas assignments and manually-created tasks in one table, no UNION queries needed
- `schedule_blocks` links to assignments via `assignment_id` FK — each row is one scheduled work session for one assignment; includes `is_manual` flag for user-dragged blocks

### Claude's Discretion
- Column definitions for `time_estimates`, `fixed_events`, `preferences`, and `completion_history` tables — should follow the same patterns (integer PKs, unix ms timestamps, FK references where applicable)
- WAL mode enablement (required by success criteria — implementation detail)

### Dev Server
- Two separate ports: TanStack Start on `:3000`, ElysiaJS on `:3001`
- Single `bun dev` command in workspace root starts both using `concurrently` (or equivalent)
- CORS handled server-side via `@elysiajs/cors` with `origin: 'http://localhost:3000'` — no proxy needed
- Eden Treaty in `apps/web` points to `http://localhost:3001`

</decisions>

<specifics>
## Specific Ideas

- User considered a future mobile app — chose Option 1 (direct api type import) with the understanding that migration to a types package is straightforward if a non-TS mobile stack is added later
- Workspace structure mirrors what the user selected: `apps/web`, `apps/api`, `packages/db`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns for all subsequent phases

### Integration Points
- `apps/web` → `apps/api`: Eden Treaty typed client over HTTP (`:3000` → `:3001`)
- `apps/api` → `packages/db`: Drizzle client with bun:sqlite driver
- `.env` in `apps/api`: Canvas API token read server-side only, never sent to web

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-13*
