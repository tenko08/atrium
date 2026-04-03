---
phase: 02-canvas-sync
plan: 02
subsystem: api-routes
tags: [elysia, routes, canvas-sync, assignments, tdd]
dependency_graph:
  requires: [02-01]
  provides: [POST /sync, GET /assignments, GET /credentials-status]
  affects: [apps/api/src/index.ts, App type for Eden Treaty]
tech_stack:
  added: []
  patterns: [Elysia route module, mock.module for unit tests, env var validation]
key_files:
  created:
    - apps/api/src/routes/sync.ts
    - apps/api/src/routes/sync.test.ts
    - apps/api/src/routes/assignments.ts
    - apps/api/src/routes/assignments.test.ts
  modified:
    - apps/api/src/index.ts
decisions:
  - "Used mock.module('@atrium/db') in assignments.test.ts to avoid real DB dependency — DB requires migrations to be run and tables to exist, which is environment-specific setup not appropriate for unit tests"
  - "Credential checks are inline in sync route handler (read process.env at call time) rather than at module load — ensures env var changes between tests are correctly reflected"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-03"
  tasks: 2
  files_created: 4
  files_modified: 1
---

# Phase 02 Plan 02: Canvas API Routes Summary

Three Elysia route modules exposing Canvas sync and assignment data over HTTP — POST /sync triggers canvasService.runSync(), GET /assignments returns DB rows, GET /credentials-status reports env var presence.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 (RED) | Failing tests for sync, assignments, credentials-status | f75f6de | sync.test.ts, assignments.test.ts |
| 1 (GREEN) | Implement sync, assignments, credentials-status routes | 94a4fc8 | sync.ts, assignments.ts, assignments.test.ts |
| 2 | Register routes in index.ts | 031ae0f | index.ts |

## What Was Built

**`apps/api/src/routes/sync.ts`** — Elysia plugin with two routes:
- `POST /sync`: Validates `CANVAS_API_TOKEN` + `CANVAS_BASE_URL`, calls `runSync()`, returns `{ ok: true, syncedAt, assignmentCount }` or `{ ok: false, error: 'missing_credentials' | 'canvas_unreachable' }`
- `GET /credentials-status`: Returns `{ configured: boolean }` based on env var presence

**`apps/api/src/routes/assignments.ts`** — Elysia plugin:
- `GET /assignments`: Drizzle `db.select().from(schema.assignments)` — returns full assignment rows including `syncStatus`

**`apps/api/src/index.ts`** — Updated to `.use(syncRoute).use(assignmentsRoute)` so `App` type propagates to Eden Treaty client in frontend.

## Test Results

25 tests pass across 4 test files:
- 3 health tests (unchanged)
- 5 sync route tests (2 missing_credentials, 1 canvas_unreachable, 2 credentials-status)
- 2 assignments route tests (200 response, expected fields)
- 15 canvasService unit tests (unchanged from Plan 01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Mocked @atrium/db in assignments.test.ts**
- **Found during:** Task 1 GREEN phase
- **Issue:** The real `@atrium/db` opens `./atrium.db` which exists but has no tables (migrations not run). Route returned 500 in test environment.
- **Fix:** Used `mock.module('@atrium/db', ...)` to return a mock DB that resolves with in-memory rows. This is the correct unit test pattern — canvasService.test.ts uses the same approach (mocking fetch).
- **Files modified:** apps/api/src/routes/assignments.test.ts
- **Commit:** 94a4fc8

## Known Stubs

None — all routes are fully wired. The `GET /assignments` endpoint returns real DB data. The `POST /sync` endpoint delegates to the real `runSync()` which talks to Canvas API.

## Self-Check: PASSED

All created files exist on disk. All task commits (f75f6de, 94a4fc8, 031ae0f) verified in git log.
