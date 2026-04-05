---
phase: 03-todo-list
plan: "03"
subsystem: web-frontend
tags: [react, tdd, todo-list, grouping, completion, inline-edit, manual-tasks]
dependency_graph:
  requires:
    - 03-01 (POST/PATCH/DELETE endpoints)
    - 03-02 (groupByCourse, groupByDueDate, sortGroup, buildDueAt utilities)
  provides:
    - Full todo list UI in apps/web/src/routes/index.tsx
    - GroupingToggle (course / due-date views)
    - Completion toggle with optimistic update + rollback
    - Hover-reveal edit/delete for manual tasks
    - InlineEditRow for manual task editing
    - ManualTaskCreationForm (always visible in Manual section)
  affects:
    - apps/web/src/routes/index.tsx (complete rewrite)
tech_stack:
  added: []
  patterns:
    - Optimistic UI update with T-08 rollback (save prev, setAssignments optimistic, catch+restore)
    - Hover-reveal via useState hoveredId + visibility (not display) — CSS :hover unavailable with inline styles
    - finalGroups synthetic Manual section ensures form always visible even with no manual tasks
    - buildDueAt reused for both creation and inline edit date validation
    - T-09: setHoveredId(null) called before delete to prevent stale hover state
key_files:
  created:
    - apps/web/src/routes/index.test.ts
  modified:
    - apps/web/src/routes/index.tsx
decisions:
  - "InlineEditRow defined as function component inside index.tsx (not separate file) — consistent with existing project pattern of keeping logic in index.tsx"
  - "finalGroups synthetic Manual section: if no manual tasks exist, groupByCourse returns no Manual group, so a synthetic { label: 'Manual', items: [] } is appended in course view — ensures ManualTaskCreationForm is always visible"
  - "hover-reveal uses visibility:hidden/visible (not display:none/block) so icon buttons occupy space and rows don't shift on hover"
  - "Invalid date error message comes from buildDueAt utility (Plan 02) — not duplicated as literal in index.tsx"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-04"
  tasks_completed: 3
  files_created: 1
  files_modified: 1
requirements:
  - TODO-01
  - TODO-02
  - TODO-03
  - TODO-04
---

# Phase 03 Plan 03: Todo List UI Component Summary

**One-liner:** Full todo list UI in index.tsx — grouped sections with course/date toggle, optimistic completion toggle, hover-reveal inline edit/delete for manual tasks, and ManualTaskCreationForm with date overflow guard.

## What Was Built

Complete rewrite of `apps/web/src/routes/index.tsx` implementing all four TODO requirements:

### GroupingToggle (TODO-01)
Two toggle buttons ("By Course" / "By Due Date") placed above SyncButton. Switches between `groupByCourse` and `groupByDueDate` from the Plan 02 utility. Active button gets `#f4f4f4` background + `#cccccc` border.

### AssignmentGroup + TaskRow (TODO-01, TODO-02)
Each group renders an `<h2>` section header followed by a `<ul>` of task rows. Each row has:
- Completion checkbox with `aria-label` (D-07: both Canvas and manual tasks)
- Strikethrough + `#999999` color when `completed: true` (D-05)
- `sortGroup` in the utility handles move-to-bottom automatically when state updates
- SyncDot only for `source === 'canvas'` assignments
- Course name shown in due-date view for context

### Hover-Reveal Edit/Delete (TODO-04)
`hoveredId` state + `onMouseEnter`/`onMouseLeave` handlers on `<li>` elements. Pencil (&#9998;) and trash (&#128465;) buttons use `visibility: hidden/visible` (not `display: none`) to prevent row shift on hover. Only rendered for `source === 'manual'` rows (D-14).

### InlineEditRow (TODO-04)
Replaces the task row when `editingId === a.id && a.source === 'manual'`. Pre-fills all fields from the assignment. Enter key or checkmark button saves; Escape or X cancels. Date fields pre-filled by extracting from `assignment.dueAt` via `new Date()`.

### ManualTaskCreationForm (TODO-03)
Always visible at the bottom of the Manual section. `finalGroups` pattern ensures a synthetic `{ label: 'Manual', items: [] }` is appended in course view when no manual tasks exist. Fields: name (required), hours + minutes (required, total > 0), optional day/month/year + time. Uses `buildDueAt` for date validation with T-05 overflow guard.

### Optimistic Updates (T-08)
All mutations (complete, delete, edit) save `prev = assignments` before updating local state. On API error, `setAssignments(prev)` restores previous state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for validation logic | `3fc8083` | apps/web/src/routes/index.test.ts |
| 1-3 (GREEN) | Full index.tsx rewrite: grouping toggle, task rows, inline edit, creation form | `bd774b5` | apps/web/src/routes/index.tsx |

## Test Coverage

- 13 new tests in `apps/web/src/routes/index.test.ts` — all pass
- Full suite: 78 tests across 8 files — all pass, 0 regressions
- Coverage: title required (2), duration required (2), valid submission (3), date validation (3), estimatedMin computation (3)

## Security / Threat Model

| Threat | Status |
|--------|--------|
| T-07: XSS via task title rendering | BLOCKED — React JSX escapes text content; no dangerouslySetInnerHTML used |
| T-08: Optimistic state corruption on API failure | BLOCKED — every mutation saves `prev` and restores on catch |
| T-09: Hover state leak after delete | BLOCKED — `setHoveredId(null)` called in `handleDelete` before removing row |

## Deviations from Plan

### Minor Deviation: "Invalid date" not literally in index.tsx

**Found during:** Task 3 acceptance criteria verification
**Issue:** Plan acceptance criterion: `grep -n "Invalid date" apps/web/src/routes/index.tsx` expects 1 match. The string "Invalid date — check day, month, and year" is defined in `groupAssignments.ts` (line 79, from Plan 02) and returned as `result.error`. `index.tsx` displays `{dateError}` which holds this error string at runtime, but the literal string is not in index.tsx.
**Decision:** Kept current implementation (correct behavior: invalid dates show the error). Duplicating the string would introduce a maintenance risk (two places to update). The behavior matches the intent of the criterion.

## Known Stubs

None — all components are fully wired to API calls and utility functions. No placeholder data, no TODO markers.

## Self-Check: PASSED

- `apps/web/src/routes/index.tsx` — FOUND
- `apps/web/src/routes/index.test.ts` — FOUND
- Commit `3fc8083` (test RED) — FOUND
- Commit `bd774b5` (feat GREEN) — FOUND
- All 78 tests pass (was 65 before this plan)
