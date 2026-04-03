---
phase: 02-canvas-sync
plan: 01
subsystem: database, api
tags: [canvas, drizzle, sqlite, bun, elysia, pagination, upsert, sync-status]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: assignments schema, Drizzle ORM db client, ElysiaJS app scaffolding
provides:
  - syncStatus column (text, nullable, enum new/updated/unchanged) on assignments table
  - canvas_id unique index on assignments table for upsert conflict targeting
  - Drizzle migration 0001_faulty_lucky_pierre.sql applying the schema changes
  - canvasService.ts module with paginated Canvas fetch, section override resolution, sync status computation, and Drizzle upsert
  - Exported helpers extractNextLink, resolveDueAt, computeSyncStatus, canvasFetchAll for testability
  - Unit test suite (18 tests) covering all core behaviors
affects: [02-canvas-sync-02, 02-canvas-sync-03, future plans requiring Canvas assignment data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service module pattern: all Canvas API calls isolated in canvasService.ts, route handlers call runSync() only"
    - "Drizzle onConflictDoUpdate with sql.raw excluded.* for multi-column upsert"
    - "Canvas Link header pagination: follow rel=next until absent, stop when Link header lacks rel=next"
    - "Section override resolution: fetch enrollments per course, match course_section_id to assignment overrides"
    - "Sync status computation: compare canvasId+title+dueAt against existingMap before upsert"
    - "TDD with Bun test: test file written first (RED), then implementation (GREEN)"

key-files:
  created:
    - packages/db/drizzle/0001_faulty_lucky_pierre.sql
    - apps/api/src/services/canvasService.ts
    - apps/api/src/services/canvasService.test.ts
  modified:
    - packages/db/src/schema/assignments.ts
    - packages/db/drizzle/meta/_journal.json
    - packages/db/drizzle/meta/0001_snapshot.json

key-decisions:
  - "SQLite NULL uniqueness (each NULL is distinct) makes a regular uniqueIndex on canvasId safe for multiple manual assignments — no partial index needed"
  - "syncStatus reset strategy: reset all canvas rows to unchanged before upsert, then upsert sets correct new/updated/unchanged per row"
  - "rate limit handling: single 429 retry after 1-second sleep, throw on second 429 — avoids complex backoff while matching Canvas recommendation"
  - "canvasFetchAll exported (not internal) to enable pagination integration testing without mocking module internals"

patterns-established:
  - "Canvas service module: all Canvas HTTP interaction + DB writes in apps/api/src/services/canvasService.ts"
  - "Drizzle upsert target: schema.assignments.canvasId (unique index required)"
  - "Bun.sleep(1000) for 429 retry — Bun-native, no extra imports"

requirements-completed: [CANV-02, CANV-03, CANV-04]

# Metrics
duration: 25min
completed: 2026-04-02
---

# Phase 2 Plan 01: Canvas Schema + Service Summary

**syncStatus column + canvas_id unique index added to assignments schema, Drizzle migration generated, and canvasService.ts built with paginated Canvas fetch, section override resolution, and onConflictDoUpdate upsert**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-02T00:00:00Z
- **Completed:** 2026-04-02
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `syncStatus` nullable column and `canvas_id_unique` unique index to the assignments schema; generated Drizzle migration 0001 with `ALTER TABLE` and `CREATE UNIQUE INDEX`
- Built `canvasService.ts` with five exported functions: `extractNextLink`, `resolveDueAt`, `computeSyncStatus`, `canvasFetchAll`, `runSync`
- 18 unit tests covering pagination (2-page mock), override resolution (4 cases), sync status logic (5 cases), and Link header parsing (5 cases) — all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add syncStatus column and canvas_id unique index + generate migration** - `3ea0a5a` (feat)
2. **Task 2 RED: Failing tests for canvasService** - `1d044ab` (test)
3. **Task 2 GREEN: canvasService.ts implementation** - `dc37aca` (feat)

_TDD task had two commits: test (RED) then implementation (GREEN)_

## Files Created/Modified

- `packages/db/src/schema/assignments.ts` - Added syncStatus column and uniqueIndex on canvasId; updated import
- `packages/db/drizzle/0001_faulty_lucky_pierre.sql` - Migration: ALTER TABLE ADD sync_status, CREATE UNIQUE INDEX canvas_id_unique
- `packages/db/drizzle/meta/_journal.json` - Updated migration journal
- `packages/db/drizzle/meta/0001_snapshot.json` - Schema snapshot for migration 0001
- `apps/api/src/services/canvasService.ts` - Full Canvas service: pagination, override resolution, sync status, upsert
- `apps/api/src/services/canvasService.test.ts` - 18 unit tests for all service behaviors

## Decisions Made

- Regular `uniqueIndex` (not partial) on `canvasId` is correct for SQLite — SQLite treats each NULL as distinct so multiple manual assignments (canvasId=null) will not conflict
- Reset all canvas assignments to `'unchanged'` syncStatus before each upsert pass, then upsert overwrites with computed status — ensures rows not seen in current Canvas response remain `'unchanged'` rather than keeping stale `'new'` or `'updated'`
- `canvasFetchAll` exported (not just internal) to enable the pagination integration test without needing to mock internal fetch calls

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `bunx drizzle-kit migrate` fails in CI/worktree because it requires `better-sqlite3` or `@libsql/client` (Drizzle Kit's migration runner needs one of these even though the app uses `bun:sqlite`). This is a known Drizzle Kit limitation. Migration files are generated correctly and can be applied at runtime via Drizzle's `migrate()` function — the drizzle-kit CLI migrate command is not needed in development workflow. Tests use in-memory SQLite and pass with the new schema.

## User Setup Required

None - no external service configuration required for this plan. Canvas API credentials (CANVAS_API_TOKEN, CANVAS_BASE_URL) will be required when running sync in subsequent plans.

## Next Phase Readiness

- canvasService.ts `runSync()` is ready to be called from a `POST /sync` Elysia route (Plan 02-02)
- Schema now has `syncStatus` column for frontend colored-dot display (Plan 02-03)
- All existing Phase 1 tests still pass (11 pass in packages/db, 18 pass in apps/api)
- The `canvas_id_unique` index enables conflict-free upserts from runSync

---
*Phase: 02-canvas-sync*
*Completed: 2026-04-02*
