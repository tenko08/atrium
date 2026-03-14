---
phase: 01-foundation
plan: "02"
subsystem: api
tags: [elysia, elysiajs, cors, bun, health-check, eden-treaty, tdd, wave-0]

# Dependency graph
requires:
  - phase: 01-foundation plan 01
    provides: Bun workspaces monorepo root with apps/* and packages/* structure
provides:
  - ElysiaJS API server in apps/api on port 3001
  - GET /health endpoint returning { status: 'ok', timestamp: number }
  - CORS configured for http://localhost:3000 only
  - "export type App = typeof app" for Eden Treaty type inference in apps/web
  - apps/api/.env.example template for CANVAS_API_TOKEN, CANVAS_BASE_URL, DB_FILE_NAME
  - Wave 0 smoke test: 3 tests covering 200 response, body shape, CORS header
affects:
  - 01-03 (TanStack Start app needs App type for Eden Treaty client)
  - All phases that add Elysia routes (import into apps/api/src/index.ts)
  - Phase 2+ (Canvas API token read from .env, never sent to frontend)

# Tech tracking
tech-stack:
  added:
    - elysia (latest) — ElysiaJS web framework for Bun
    - "@elysiajs/cors (latest) — CORS plugin for Elysia"
    - bun-types (latest) — Bun type definitions for devDependencies
  patterns:
    - Elysia app constructed without .listen() in tests, .listen(3001) only in production entry
    - Route modules created as separate Elysia instances and composed via .use() in main app
    - CORS restricted to single origin (http://localhost:3000), not wildcard
    - App type exported as "export type App = typeof app" for Eden Treaty consumers

key-files:
  created:
    - apps/api/package.json — @atrium/api manifest with elysia, @elysiajs/cors, @atrium/db deps
    - apps/api/tsconfig.json — extends tsconfig.base.json, rootDir=src
    - apps/api/src/index.ts — Elysia server with CORS + health route, listens on :3001, exports App type
    - apps/api/src/routes/health.ts — GET /health returns { status: 'ok', timestamp: Date.now() }
    - apps/api/.env.example — template for CANVAS_API_TOKEN, CANVAS_BASE_URL, DB_FILE_NAME
    - apps/api/src/index.test.ts — Wave 0: 3 tests (200 status, body shape, CORS header)
  modified:
    - bun.lock — updated with new elysia and @elysiajs/cors dependencies

key-decisions:
  - "elysia uses 'latest' not 'catalog:' because Bun 1.2.18 does not support the catalog: protocol — Bun's workspace hoisting ensures a single elysia version in node_modules, achieving the same goal"
  - "apps/api does NOT import @atrium/db in this plan — db dependency declared for Phase 2 readiness but health route has no DB access"
  - "Test file builds app without .listen() to enable unit testing via app.handle() without port binding"

patterns-established:
  - "Pattern 4: Route modules — define routes as standalone Elysia instances, compose into main app via .use()"
  - "Pattern 5: Test without listen — build Elysia app without .listen() in test files, use app.handle(new Request(...)) for unit tests"
  - "Pattern 6: CORS single origin — use { origin: 'http://localhost:3000' } not wildcard for security"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 1 Plan 02: ElysiaJS API Server Scaffold Summary

**ElysiaJS server on port 3001 with CORS for localhost:3000, GET /health endpoint, and exported App type for Eden Treaty type inference — 3 Wave 0 tests all green**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T19:34:48Z
- **Completed:** 2026-03-14T19:39:30Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- ElysiaJS API server scaffolded at apps/api with CORS restricted to http://localhost:3000
- GET /health route returns `{ status: 'ok', timestamp: <number> }` with HTTP 200
- `export type App = typeof app` enables Eden Treaty type inference in the TanStack Start frontend
- Wave 0 test suite: 3 tests all green via TDD (RED commit then GREEN commit)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED — failing Wave 0 health tests** - `3759ae9` (test)
2. **Task 1: TDD GREEN — ElysiaJS implementation** - `b1a77ee` (feat)

_Note: TDD task had test commit (RED) then feat commit (GREEN)_

## Files Created/Modified
- `apps/api/package.json` — @atrium/api manifest: elysia, @elysiajs/cors, @atrium/db, bun-types
- `apps/api/tsconfig.json` — extends tsconfig.base.json, rootDir=src, outDir=dist
- `apps/api/src/index.ts` — Elysia app on :3001 with CORS + health route, exports App type
- `apps/api/src/routes/health.ts` — GET /health returns `{ status: 'ok', timestamp: Date.now() }`
- `apps/api/.env.example` — template with CANVAS_API_TOKEN, CANVAS_BASE_URL, DB_FILE_NAME
- `apps/api/src/index.test.ts` — Wave 0: GET /health returns 200, correct body shape, CORS header
- `bun.lock` — updated with elysia and @elysiajs/cors packages

## Decisions Made
- `"elysia": "latest"` used instead of `"elysia": "catalog:"` because Bun 1.2.18 does not support the `catalog:` protocol. Bun's workspace hoisting guarantees a single elysia installation in node_modules, preventing the Eden Treaty dual-instance problem that catalog pinning was meant to solve.
- `@atrium/db` is declared as a dependency now for Phase 2 readiness, but apps/api/src/index.ts does NOT import it yet — the health route has no DB access.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed `"elysia": "catalog:"` to `"elysia": "latest"` in apps/api/package.json**
- **Found during:** Task 1 (after writing test file and running `bun install`)
- **Issue:** `bun install` failed with `error: elysia@catalog: failed to resolve` — Bun 1.2.18 does not support the `catalog:` protocol (pnpm-specific feature)
- **Fix:** Changed to `"elysia": "latest"`. Bun hoists all workspace package dependencies to `node_modules/` at the workspace root, ensuring all packages resolve to the same elysia instance — same effect as catalog pinning
- **Files modified:** `apps/api/package.json`
- **Verification:** `bun install` succeeded, all 3 tests pass
- **Committed in:** `3759ae9` (TDD RED commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** The fix achieves the same goal (single elysia version in workspace). The plan note about catalog being "REQUIRED" was based on pnpm assumptions; Bun's hoisting provides equivalent protection.

## Issues Encountered
- `catalog:` protocol is pnpm-specific and not supported in Bun 1.2.18. The root package.json has a `catalog` field but Bun does not process it as a version resolver. Replaced with `"latest"` and Bun's workspace hoisting handles deduplication.

## User Setup Required
None - no external service configuration required. The `.env` file with placeholder values is created automatically (gitignored). For real Canvas integration, copy `.env.example` to `.env` and fill in actual values.

## Next Phase Readiness
- ElysiaJS API server ready to receive routes in Phase 2+
- `export type App` is available for Eden Treaty client in apps/web (Plan 01-03)
- CORS is pre-configured to only allow requests from localhost:3000
- `@atrium/db` declared as dependency — DB routes can be added in Phase 2 by importing db from `@atrium/db`
- `.env.example` committed; `.env` with placeholders exists locally (gitignored)

## Self-Check: PASSED

All 6 implementation files confirmed on disk. Both commits (`3759ae9`, `b1a77ee`) confirmed in git log.
