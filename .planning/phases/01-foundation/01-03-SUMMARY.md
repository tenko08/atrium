---
phase: 01-foundation
plan: "03"
subsystem: ui
tags: [tanstack-start, vite, eden-treaty, elysiajs, react, typescript, tdd, monorepo]

# Dependency graph
requires:
  - phase: 01-foundation-01-01
    provides: Bun workspaces monorepo root and elysia catalog pin for deduplication
  - phase: 01-foundation-01-02
    provides: ElysiaJS API on :3001 with /health route and exported App type for Eden Treaty
provides:
  - TanStack Start frontend on :3000 wired to ElysiaJS API via Eden Treaty client
  - apps/web package with vite.config.ts using post-v1.121.0 tanstackStart() plugin pattern (no app.config.ts)
  - Eden Treaty client singleton (api.ts) with fully typed health call — { status: 'ok'; timestamp: number }, not unknown
  - Wave 0 integration test: api.health.get() reaching live API at localhost:3001
  - Full end-to-end stack: browser → TanStack Start → Eden Treaty → ElysiaJS → SQLite
  - Complete test suite: 15 tests across 3 packages, all green
affects:
  - Phase 2 onwards — all feature development builds on this validated stack

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-start (latest) — TanStack Start SSR framework"
    - "@tanstack/react-router (latest) — file-based router, routeTree.gen.ts generated on first dev run"
    - "@elysiajs/eden (latest) — Eden Treaty client for end-to-end type safety"
    - vite (latest) — bundler/dev server
    - vite-tsconfig-paths (latest) — path alias resolution
    - "@vitejs/plugin-react (latest) — React fast refresh"
    - react / react-dom (latest)
  patterns:
    - vite.config.ts-only pattern (post-v1.121.0) — no app.config.ts; plugins order is tsconfigPaths → tanstackStart → viteReact
    - Eden Treaty type import as devDependency — @atrium/api is type-only; no runtime bundle exposure
    - elysia: "catalog:" in apps/web to pin same version as apps/api (prevents dual-instance Eden Treaty type failures)
    - Route loader pattern — loader() calls api.health.get() server-side; component reads via Route.useLoaderData()

key-files:
  created:
    - apps/web/package.json — @atrium/web manifest; elysia catalog pin; @atrium/api as devDependency
    - apps/web/tsconfig.json — extends base, paths ~/*, includes vite.config.ts
    - apps/web/vite.config.ts — tanstackStart() + viteReact(), server port 3000
    - apps/web/src/router.tsx — createTanStackRouter with routeTree, Register declaration
    - apps/web/src/client.tsx — hydrateRoot with StartClient
    - apps/web/src/server.tsx — createStartHandler with defaultStreamHandler export
    - apps/web/src/api.ts — treaty<App>('localhost:3001') singleton, type-only App import
    - apps/web/src/routes/__root.tsx — createRootRoute with Outlet wrapper
    - apps/web/src/routes/index.tsx — loader calls api.health.get(), displays "API status: ok (ts: N)"
    - apps/web/src/api.test.ts — Wave 0 integration test: Eden Treaty call to live /health endpoint
  modified:
    - apps/api/package.json — updated as needed for workspace compatibility

key-decisions:
  - "vite.config.ts-only approach used (no app.config.ts) — app.config.ts is the deprecated Vinxi-era pattern; TanStack Start v1.121.0+ uses vite.config.ts exclusively"
  - "TanStack Start v1.166.11 required router/server API fixes — createStartHandler and StartClient import paths changed from what plan specified; fixed via Rule 3 (blocking)"
  - "@atrium/api declared as devDependency in apps/web — it is a type-only import at build time; no API code ships to the browser bundle"

patterns-established:
  - "Pattern 4: Eden Treaty singleton — create treaty<App>('host:port') once in api.ts, import { api } everywhere"
  - "Pattern 5: TanStack Start route loader — async loader() for data fetching; component reads via Route.useLoaderData()"
  - "Pattern 6: Type-only package imports — when a package is only used for types (App), declare it as devDependency to keep runtime bundle clean"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-03-14
---

# Phase 1 Plan 03: TanStack Start Frontend with Eden Treaty Summary

**TanStack Start (Vite, :3000) wired to ElysiaJS (:3001) via Eden Treaty client with fully typed health call — end-to-end stack validated in browser and by automated integration test (15/15 tests green)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-14T19:37:24Z
- **Completed:** 2026-03-14
- **Tasks:** 2 (1 TDD auto + 1 checkpoint:human-verify)
- **Files modified:** 10

## Accomplishments
- apps/web scaffolded with TanStack Start v1.166.11, vite.config.ts-only approach (no deprecated app.config.ts)
- Eden Treaty client singleton in api.ts — api.health.get() returns fully typed `{ status: 'ok'; timestamp: number }`, not unknown
- Index route displays live API health: "API status: ok (ts: {number})" — confirmed in browser
- Wave 0 integration test passes: Eden Treaty HTTP call reaches ElysiaJS /health endpoint
- Full workspace test suite: 15 tests across apps/web, apps/api, packages/db — all green

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Add failing test for Eden Treaty health endpoint** - `61fd47b` (test)
2. **Task 1 (TDD GREEN): Scaffold TanStack Start frontend with Eden Treaty client** - `dd43680` (feat)
3. **Task 1 (TDD REFACTOR): Fix TanStack Start v1.166.11 server/router API** - `b62778b` (refactor)
4. **Task 2: Human-verified browser checkpoint — approved** - (no file changes; browser showed "API status: ok")

_Note: TDD task had test → feat → refactor commits; refactor was a Rule 3 auto-fix for blocking API changes in v1.166.11_

## Files Created/Modified
- `apps/web/package.json` — @atrium/web manifest; elysia catalog pin; @atrium/api as devDependency
- `apps/web/tsconfig.json` — Extends base, paths ~/* → src/*, includes vite.config.ts
- `apps/web/vite.config.ts` — tsconfigPaths → tanstackStart → viteReact plugin order; port 3000
- `apps/web/src/router.tsx` — createTanStackRouter + Register declaration merge
- `apps/web/src/client.tsx` — hydrateRoot with StartClient
- `apps/web/src/server.tsx` — createStartHandler with defaultStreamHandler
- `apps/web/src/api.ts` — Eden Treaty singleton: treaty<App>('localhost:3001'), type-only App import
- `apps/web/src/routes/__root.tsx` — Root route with Outlet
- `apps/web/src/routes/index.tsx` — Loader calls api.health.get(), renders health status
- `apps/web/src/api.test.ts` — Wave 0 integration test: api.health.get() to live API

## Decisions Made
- TanStack Start v1.166.11 changed createStartHandler and StartClient import paths vs what plan specified — fixed inline as Rule 3 (blocking issue)
- @atrium/api listed as devDependency in apps/web because it is a type-only import — no API source ships to the browser, keeping CANVAS_API_TOKEN out of the bundle
- vite.config.ts used exclusively per post-v1.121.0 TanStack Start pattern; app.config.ts pattern is deprecated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TanStack Start v1.166.11 import paths**
- **Found during:** Task 1 (TDD GREEN / REFACTOR phase)
- **Issue:** TanStack Start v1.166.11 changed the import paths for `createStartHandler`, `defaultStreamHandler` (server.tsx) and `StartClient` (client.tsx) — the plan's specified imports caused build errors
- **Fix:** Updated server.tsx and router.tsx to use correct v1.166.11 API surface; verified `bun dev` starts cleanly and browser renders health status
- **Files modified:** `apps/web/src/server.tsx`, `apps/web/src/router.tsx`
- **Verification:** Browser shows "API status: ok (ts: N)"; all 15 tests pass
- **Committed in:** `b62778b` (refactor commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Fix necessary because TanStack Start v1.166.11 changed its public API between plan authoring and execution. No scope creep.

## Issues Encountered
- TanStack Start v1.166.11 ships with updated import paths for server/client entry points. The plan's code was authored against an earlier API shape. The fix was straightforward — locate correct exports and update imports.

## User Setup Required
None - no external service configuration required. Stack runs fully locally with `bun dev`.

## Next Phase Readiness
- Complete Phase 1 foundation validated: monorepo + DB schema + API server + frontend + end-to-end Eden Treaty wiring
- bun dev starts both servers; browser renders live API data; all 15 tests green
- Phase 2 can add Canvas API integration routes to ElysiaJS and consume them from TanStack Start routes
- Known risk: [Phase 6] TanStack Start SSR + Eden Treaty server function coexistence — to validate when Phase 6 introduces server functions

---
*Phase: 01-foundation*
*Completed: 2026-03-14*

## Self-Check: PASSED

- FOUND: .planning/phases/01-foundation/01-03-SUMMARY.md
- FOUND: apps/web/src/api.ts
- FOUND: apps/web/src/routes/index.tsx
- FOUND: apps/web/vite.config.ts
- FOUND: apps/web/src/api.test.ts
- FOUND commit: 61fd47b (test — failing Eden Treaty test)
- FOUND commit: dd43680 (feat — TanStack Start scaffold)
- FOUND commit: b62778b (refactor — v1.166.11 API fix)
- Integration test: 1/1 pass (api.health.get() returns { status: "ok", timestamp: number })
- Full suite: 15/15 tests green (apps/web + apps/api + packages/db)
