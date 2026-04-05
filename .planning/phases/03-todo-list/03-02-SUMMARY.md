---
phase: 03-todo-list
plan: "02"
subsystem: web-frontend-utils
tags: [tdd, pure-functions, grouping, sorting, date-validation]
dependency_graph:
  requires: []
  provides:
    - groupByCourse (groupAssignments.ts)
    - groupByDueDate (groupAssignments.ts)
    - sortGroup (groupAssignments.ts)
    - buildDueAt (groupAssignments.ts)
    - Assignment type (groupAssignments.ts)
    - Group type (groupAssignments.ts)
  affects:
    - apps/web/src/routes/index.tsx (consumer of groupByCourse, groupByDueDate — Plan 03)
tech_stack:
  added: []
  patterns:
    - TDD RED-GREEN cycle with bun:test
    - Pure TypeScript utility module (no DOM, no external deps)
    - Date overflow guard (T-05 mitigation: coherence check on JS Date construction)
key_files:
  created:
    - apps/web/src/utils/groupAssignments.ts
    - apps/web/src/utils/groupAssignments.test.ts
  modified: []
decisions:
  - "__manual__ sentinel key used in Map to distinguish manual tasks from Canvas tasks without risking collision with a real course named 'Manual'"
  - "null dueAt treated as Infinity in sort comparisons — prevents NaN propagation (T-06 mitigation)"
  - "buildDueAt coherence check: reconstructed Date fields must match inputs, rejecting JS date overflow (e.g. April 31 → May 1)"
  - "Empty buckets filtered from groupByDueDate output — only non-empty groups returned"
metrics:
  duration: "~1 minute"
  completed_date: "2026-04-05"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
  tests_added: 18
  tests_total: 55
---

# Phase 3 Plan 02: Grouping/Sorting/Date Utilities (TDD) Summary

**One-liner:** Pure TypeScript utility module with TDD — groupByCourse, groupByDueDate, sortGroup, buildDueAt functions with date overflow guard (T-05 mitigation).

## What Was Built

A pure utility module at `apps/web/src/utils/groupAssignments.ts` providing all grouping, sorting, and date construction logic needed for the todo list frontend. The module was built test-first using the TDD RED-GREEN cycle.

### Exported API

| Export | Purpose |
|--------|---------|
| `Assignment` (type) | Canonical assignment shape shared with Plan 03 component |
| `Group` (type) | `{ label: string; items: Assignment[] }` — group container |
| `groupByCourse` | Partitions assignments by `courseName`; manual tasks always in last "Manual" section |
| `groupByDueDate` | Buckets into "Due today", "Due this week", "Due later", "No due date"; empty buckets omitted |
| `sortGroup` | Incomplete tasks before complete; both sub-groups sorted by `dueAt` ascending, `null` treated as `Infinity` |
| `buildDueAt` | Constructs unix ms timestamp from structured inputs; defaults to 23:59; returns `{ error }` on date overflow (T-05) |

## Tasks Completed

| Task | Description | Commit | Type |
|------|-------------|--------|------|
| 1 (RED) | Write failing tests for all five functions | `76c3f09` | test |
| 1 (GREEN) | Implement groupAssignments.ts, all 18 tests pass | `9cdca89` | feat |

## Test Coverage

- 18 tests in groupAssignments.test.ts
- Full suite: 55 tests passing, 0 failures
- Coverage: groupByCourse (4), groupByDueDate (5), sortGroup (4), buildDueAt (5)

## Security / Threat Model

| Threat | Status |
|--------|--------|
| T-05: Date overflow injection (April 31 → May 1 via JS Date) | BLOCKED — coherence check in `buildDueAt` returns `{ error: 'Invalid date — check day, month, and year' }` |
| T-06: NaN propagation from empty string inputs | BLOCKED — `buildDueAt` returns `null` for empty inputs; `sortGroup` uses `?? Infinity` which is NaN-safe |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functions are fully implemented with real logic. No placeholder data, no TODO markers.

## Self-Check

Files exist:
- `apps/web/src/utils/groupAssignments.ts` — FOUND
- `apps/web/src/utils/groupAssignments.test.ts` — FOUND

Commits exist:
- `76c3f09` (test RED) — FOUND
- `9cdca89` (feat GREEN) — FOUND

## Self-Check: PASSED
