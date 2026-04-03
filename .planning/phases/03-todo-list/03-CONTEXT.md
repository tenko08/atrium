# Phase 3: Todo List - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing assignment list (from Phase 2) into a full todo list: grouping with a toggle, completion toggling, manual task creation, and edit/delete for manual tasks. No time estimates (Phase 4), no schedule generation (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Grouping & Sorting
- **D-01:** Default grouping is **by course** — one section per Canvas course, plus a "Manual" section for user-created tasks
- **D-02:** Within each group, assignments are sorted **by due date ascending** (soonest first)
- **D-03:** Users can **toggle grouping** between course view and due-date view at runtime. Due-date view groups as: "Due today", "Due this week", "Due later", "No due date"
- **D-04:** The toggle is a small UI control (e.g., two buttons or a select) — not a page-level setting, just a view switch

### Completion Behavior
- **D-05:** Checking off a task applies **strikethrough styling + moves it to the bottom** of its group (below incomplete tasks)
- **D-06:** Completion is a **toggle** — clicking a checked task unchecks it and moves it back to its position by due date
- **D-07:** Both Canvas assignments and manual tasks support completion toggling (same behavior for both)

### Manual Task Creation
- **D-08:** Creation is via an **inline form at the bottom of the "Manual" course section** — no modal or popover
- **D-09:** Form fields:
  - **Name** — required text input
  - **Duration** — structured inputs: separate hour and minute fields (e.g., `[2] h [30] m`). User-provided value feeds into Phase 4's AI estimator as a baseline
  - **Due date** — structured inputs: separate day, month, year fields + optional time. If no time is provided, defaults to **11:59pm** on that date
- **D-10:** Due date is optional at creation time. Name is required, duration is required.

### Edit & Delete (Manual Tasks Only)
- **D-11:** Hovering a manual task reveals **pencil (edit) and trash (delete) icons** on the right side of the row
- **D-12:** Clicking the pencil icon transforms the row **inline into editable fields** — same structured inputs as creation. Save with Enter or a checkmark button; cancel with Escape
- **D-13:** Clicking the trash icon **deletes immediately** — no confirmation dialog
- **D-14:** Canvas assignments do NOT show edit/delete icons (they are read-only from the app's perspective — Canvas is the source of truth)

### Claude's Discretion
- Exact styling of the grouping toggle control
- How the "Manual" section is positioned relative to course sections
- How to handle the case where a manual task has no due date in due-date grouping view (put in "No due date" bucket)
- Animation/transition when a task moves to the bottom on completion (or no animation — keep it simple)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing frontend
- `apps/web/src/routes/index.tsx` — current assignment list UI to extend (flat `<ul>`, sync button, SyncDot component)
- `apps/web/src/components/SyncButton.tsx` — existing component pattern to follow
- `apps/web/src/components/MissingCredentials.tsx` — existing component pattern to follow

### Existing backend
- `apps/api/src/routes/assignments.ts` — existing `GET /assignments` route (needs extension for create/update/delete)
- `apps/api/src/routes/sync.ts` — existing route pattern to follow
- `apps/api/src/index.ts` — route registration pattern

### Schema
- `packages/db/src/schema/assignments.ts` — `source` column (`'canvas' | 'manual'`), `completed` boolean, `canvasId` nullable — manual tasks have `source: 'manual'`, `canvasId: null`
- `packages/db/src/client.ts` — Drizzle client pattern

### Requirements
- `.planning/REQUIREMENTS.md` §Todo List — TODO-01 through TODO-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncDot` component (inline in index.tsx) — green/orange dot for sync status, reuse on manual tasks (or omit dot for manual tasks)
- `formatDueDate` helper (inline in index.tsx) — formats unix ms to "Apr 10, 10:00 PM"
- Eden Treaty `api` client (`apps/web/src/api.ts`) — extend with new assignment endpoints

### Established Patterns
- Inline styles + monospace font — all existing UI uses this, continue the pattern
- Elysia routes: export plugin from `src/routes/`, register in `src/index.ts`
- DB access: `db.select/insert/update/delete` via Drizzle from `@atrium/db`
- Frontend state: `useState` + loader data — no external state management

### Integration Points
- New API routes needed: `POST /assignments` (create manual), `PATCH /assignments/:id` (update), `DELETE /assignments/:id` (delete), `PATCH /assignments/:id/complete` (toggle completion)
- Frontend: extend `index.tsx` with grouping logic, completion toggle, creation form, edit/delete controls
- `completed` column already exists on `assignments` table — no migration needed for completion

</code_context>

<specifics>
## Specific Ideas

- Due date input: structured day/month/year + optional time fields. No time = defaults to 11:59pm
- Duration input: separate hour and minute fields (not free text, not a dropdown)
- Hover-reveal controls: pencil + trash icons appear on hover for manual tasks only
- Canvas assignments are read-only in the UI — no edit/delete

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-todo-list*
*Context gathered: 2026-04-03*
