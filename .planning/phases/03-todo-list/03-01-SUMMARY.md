---
phase: 03-todo-list
plan: "01"
subsystem: api
tags: [elysia, tdd, crud, assignments, drizzle, eden-treaty]
dependency_graph:
  requires: []
  provides: [POST /assignments, PATCH /assignments/:id/complete, PATCH /assignments/:id, DELETE /assignments/:id]
  affects: [apps/web/src/api.ts]
tech_stack:
  added: []
  patterns: [t.Object() body schemas for Eden Treaty inference, t.Numeric() param coercion, drizzle-orm eq() where clause, explicit updatedAt in every set()]
key_files:
  created: []
  modified:
    - apps/api/src/routes/assignments.ts
    - apps/api/src/routes/assignments.test.ts
decisions:
  - "Hard-coded source='manual' in POST handler body schema (T-01 — mass assignment prevention)"
  - "Source guard fetch before PATCH/:id and DELETE/:id returns 403 for canvas assignments (T-02)"
  - "t.Numeric() on :id params for PATCH and DELETE coerces URL string to number (T-04)"
  - "updatedAt: Date.now() set explicitly in every .set({}) call — Drizzle SQLite has no $onUpdateFn"
metrics:
  duration: "82 seconds"
  completed_date: "2026-04-04"
  tasks_completed: 1
  files_modified: 2
requirements:
  - TODO-02
  - TODO-03
  - TODO-04
---

# Phase 03 Plan 01: Assignment CRUD Endpoints Summary

**One-liner:** Four typed Elysia endpoints (POST/PATCH-complete/PATCH/DELETE) for manual assignment CRUD with Eden Treaty type inference and canvas-write protection.

## What Was Built

Extended `apps/api/src/routes/assignments.ts` with four new endpoints using TDD:

- **POST /assignments** — Creates a manual task. Hard-codes `source: 'manual'` server-side (T-01 mitigation). Body schema uses `t.Object({ title, estimatedMin, dueAt? })` so Eden Treaty infers typed request bodies. Returns 201 with full row.
- **PATCH /assignments/:id/complete** — Toggles `completed` boolean and sets `completedAt` to unix ms when true, null when false. Always updates `updatedAt`.
- **PATCH /assignments/:id** — Updates `title`, `estimatedMin`, `dueAt`. Fetches row first and returns 403 if `source === 'canvas'` (T-02 mitigation). Updates `updatedAt` explicitly.
- **DELETE /assignments/:id** — Removes row. Same canvas source guard as PATCH (T-02). Returns `{ ok: true }`.

All mutating routes use `t.Object()` body schemas and `t.Numeric()` param coercion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing tests for four new endpoints, then implement them (TDD) | 114c44b | apps/api/src/routes/assignments.ts, apps/api/src/routes/assignments.test.ts |

## Test Results

- 12 tests in `assignments.test.ts` — all pass
- 47 tests across full suite — all pass, 0 regressions

## Acceptance Criteria Verification

- `grep -n "t\.Object"` — 6 matches (POST body, PATCH/complete params+body, PATCH/:id params+body, DELETE params)
- `grep -n "source: 'manual'"` — exactly 1 match (POST handler, server-side only)
- `grep -n "cannot modify canvas"` — exactly 2 matches (PATCH/:id guard, DELETE/:id guard)
- `grep -n "updatedAt: Date.now()"` — 3 matches (POST insert now, PATCH/complete set, PATCH/:id set)
- `grep -n "t\.Numeric"` — 3 matches (PATCH/complete, PATCH/:id, DELETE/:id params)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All four endpoints are fully wired to Drizzle DB operations via `@atrium/db`.

## Self-Check: PASSED

- `apps/api/src/routes/assignments.ts` — FOUND
- `apps/api/src/routes/assignments.test.ts` — FOUND
- Commit `114c44b` — FOUND (git log confirmed)
- All 47 tests pass
