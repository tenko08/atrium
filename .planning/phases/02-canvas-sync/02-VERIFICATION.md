---
phase: 02-canvas-sync
verified: 2026-04-02T00:00:00Z
status: human_needed
score: 11/11 automated must-haves verified
re_verification: false
human_verification:
  - test: "Page auto-syncs on load with valid Canvas credentials"
    expected: "On first load, the route loader calls /sync and /assignments. The assignment list renders with Canvas data and green dots on first-seen items."
    why_human: "Requires a running server with valid CANVAS_API_TOKEN and CANVAS_BASE_URL to observe real sync behavior"
  - test: "Sync Now button shows spinner while syncing"
    expected: "Clicking Sync Now disables the button, shows 'Syncing...' text, and re-enables after completion"
    why_human: "Transient in-flight UI state cannot be asserted via static code analysis"
  - test: "Last synced X ago timestamp appears after successful sync"
    expected: "After sync completes, a 'Last synced just now' (or similar) label appears below the button"
    why_human: "Depends on live component state update after a real API round-trip"
  - test: "Red error text appears on sync failure"
    expected: "When CANVAS_BASE_URL is set to an invalid URL, clicking Sync Now shows red error text below the button"
    why_human: "Requires manipulating env vars and observing runtime error path"
  - test: "MissingCredentials full-page blocking screen"
    expected: "Removing CANVAS_API_TOKEN from .env and refreshing shows 'Canvas Not Configured' screen with exact env var names, nothing else visible"
    why_human: "Requires env var removal and browser refresh to trigger the credentials-status branch"
  - test: "Sync-status colored dots match actual sync state"
    expected: "New assignments show a green dot (#22c55e), previously-synced updated ones show orange (#f97316), unchanged show no dot"
    why_human: "Correct dot color depends on real Canvas data returning differing syncStatus values across multiple sync cycles"
---

# Phase 02: Canvas Sync — Verification Report

**Phase Goal:** Sync Canvas assignments into the app with real-time status indicators
**Verified:** 2026-04-02
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Canvas pagination fetches ALL pages by following rel=next Link headers until absent | VERIFIED | `extractNextLink` regex present; `canvasFetchAll` loop uses it; pagination integration test (15 canvasService tests pass) |
| 2 | Section due-date overrides resolve correctly when user is enrolled in a non-default section | VERIFIED | `resolveDueAt` iterates overrides, matches `course_section_id` against `userSectionIds`; 4 override resolution tests pass |
| 3 | Sync status is new/updated/unchanged based on canvasId + title + dueAt comparison | VERIFIED | `computeSyncStatus` compares against `existingMap`; 5 status tests pass |
| 4 | assignments table has syncStatus column and unique index on canvas_id | VERIFIED | Schema file line 17: `syncStatus: text('sync_status', { enum: ['new', 'updated', 'unchanged'] })`, line 19: `uniqueIndex('canvas_id_unique').on(table.canvasId)` |
| 5 | POST /sync returns `{ ok: true, syncedAt: number }` on successful sync | VERIFIED | `sync.ts` returns `{ ok: true as const, syncedAt: Date.now(), ...result }`; test passes |
| 6 | POST /sync returns `{ ok: false, error: 'missing_credentials' }` when env vars absent | VERIFIED | Guard at top of handler checks both env vars; 2 missing_credentials tests pass |
| 7 | POST /sync returns `{ ok: false, error: 'canvas_unreachable' }` when Canvas API fails | VERIFIED | Try/catch returns `canvas_unreachable`; test passes |
| 8 | GET /assignments returns all assignments from DB with syncStatus field | VERIFIED | `db.select().from(schema.assignments)` — full row including syncStatus column; field presence test passes |
| 9 | GET /credentials-status returns `{ configured: boolean }` | VERIFIED | Route present in `sync.ts`; 2 credentials-status tests pass |
| 10 | App auto-syncs on page load via the route loader | VERIFIED (code) | `api.sync.post()` called in loader before fetching assignments; requires human verification for live behavior |
| 11 | Assignment rows show green dot for new, orange for updated, no dot for unchanged | VERIFIED (code) | `SyncDot` component renders `#22c55e` for 'new', `#f97316` for 'updated', null otherwise; wired into assignment list render |

**Score:** 11/11 truths verified in code (6 require human verification for live behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/assignments.ts` | syncStatus column + canvas_id unique index | VERIFIED | 21 lines; both present at lines 17 and 19 |
| `packages/db/drizzle/0001_faulty_lucky_pierre.sql` | Migration applying schema changes | VERIFIED | Contains `ALTER TABLE assignments ADD sync_status text` and `CREATE UNIQUE INDEX canvas_id_unique` |
| `apps/api/src/services/canvasService.ts` | Canvas API client with pagination, override resolution, sync status, DB upsert | VERIFIED | 242 lines; exports `runSync`, `extractNextLink`, `resolveDueAt`, `computeSyncStatus`, `canvasFetchAll` |
| `apps/api/src/services/canvasService.test.ts` | Unit tests covering all core behaviors | VERIFIED | 167 lines, 15 test() calls, all passing |
| `apps/api/src/routes/sync.ts` | POST /sync + GET /credentials-status | VERIFIED | 21 lines; both routes present, imports `runSync` |
| `apps/api/src/routes/assignments.ts` | GET /assignments with DB query | VERIFIED | 9 lines; `db.select().from(schema.assignments)` present |
| `apps/api/src/routes/sync.test.ts` | Tests for sync route | VERIFIED | 115 lines, 5 test() calls, all passing |
| `apps/api/src/index.ts` | Route registration for sync and assignments | VERIFIED | `.use(syncRoute).use(assignmentsRoute)` both present |
| `apps/web/src/routes/index.tsx` | Main page with auto-sync loader, credential check, assignment list | VERIFIED | 104 lines; all required patterns present |
| `apps/web/src/components/SyncButton.tsx` | Sync button with idle/syncing/error states + timestamp | VERIFIED | 50 lines; 'Syncing...', 'Sync Now', `timeAgo`, `lastSyncedAt` all present |
| `apps/web/src/components/MissingCredentials.tsx` | Full-page blocking error screen | VERIFIED | 32 lines; contains `CANVAS_API_TOKEN`, `CANVAS_BASE_URL`, `Canvas Not Configured` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `canvasService.ts` | `assignments` schema | `onConflictDoUpdate` targeting `canvasId` | WIRED | Line 224: `.onConflictDoUpdate({ target: schema.assignments.canvasId, ... })` |
| `canvasService.ts` | Canvas API | `fetch` with Bearer token + Link header pagination | WIRED | `canvasFetchOnce` sets `Authorization: Bearer`, `canvasFetchAll` follows `extractNextLink` result |
| `sync.ts` | `canvasService.ts` | `import { runSync }` | WIRED | Line 2: `import { runSync } from '../services/canvasService'`; called at line 10 |
| `assignments.ts` | `@atrium/db` | `db.select()` from assignments table | WIRED | Line 2: `import { db, schema } from '@atrium/db'`; used at line 6 |
| `index.ts` | `sync.ts` | `.use(syncRoute)` | WIRED | Line 10: `.use(syncRoute)` |
| `index.tsx` | `/sync` | `api.sync.post()` in loader | WIRED | Line 26: `const syncRes = await api.sync.post()` |
| `index.tsx` | `/assignments` | `api.assignments.get()` in loader | WIRED | Line 33: `const assignRes = await api.assignments.get()` |
| `index.tsx` | `/credentials-status` | `api['credentials-status'].get()` in loader | WIRED | Line 21: `await api['credentials-status'].get()` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `index.tsx` assignment list | `assignments` state | `api.assignments.get()` → GET /assignments → `db.select().from(schema.assignments)` | Yes — full DB select, no static return | FLOWING |
| `index.tsx` syncError/lastSyncedAt | `syncError`, `lastSyncedAt` | `api.sync.post()` → POST /sync → `runSync()` return value | Yes — real Canvas API response propagated | FLOWING |
| `index.tsx` credential gate | `credentialsConfigured` | `api['credentials-status'].get()` → reads `process.env` at call time | Yes — live env var check | FLOWING |
| `SyncButton.tsx` | `syncing`, `error`, `lastSyncedAt` props | Parent `handleSync` sets via `useState` | Yes — driven by real API responses in parent | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Web app TypeScript compiles | `bun run --cwd apps/web build` | Built in 41ms, 0 errors | PASS |
| Full test suite passes | `bun test` (project root) | 37 pass, 0 fail across 6 files | PASS |
| `extractNextLink` exported from canvasService | `grep 'export function extractNextLink' apps/api/src/services/canvasService.ts` | Match found | PASS |
| `runSync` exported from canvasService | `grep 'export async function runSync' apps/api/src/services/canvasService.ts` | Match found | PASS |
| Migration file exists | `ls packages/db/drizzle/0001_faulty_lucky_pierre.sql` | File present | PASS |
| syncRoute registered in app | `.use(syncRoute)` in `index.ts` | Match found | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CANV-01 | 02-02, 02-03 | User can connect to Canvas by providing an API token and institution URL | SATISFIED | `sync.ts` validates `CANVAS_API_TOKEN`+`CANVAS_BASE_URL`; `MissingCredentials` blocks UI when absent; `credentials-status` route reports configuration state |
| CANV-02 | 02-01 | App reads all assignments across all active courses from Canvas, handling pagination correctly | SATISFIED | `canvasFetchAll` follows `rel="next"` links; `runSync` iterates all courses; pagination integration test passes |
| CANV-03 | 02-01 | App reads assignment due dates with section override support | SATISFIED | `resolveDueAt` resolves overrides per `course_section_id`; `runSync` fetches enrollments per course; 4 override tests pass |
| CANV-04 | 02-01, 02-03 | App displays which assignments are new, updated, or unchanged since last sync | SATISFIED | `computeSyncStatus` distinguishes new/updated/unchanged; `syncStatus` stored in DB; `SyncDot` renders green/orange/none in frontend |
| CANV-05 | 02-02, 02-03 | User can trigger a manual Canvas sync at any time | SATISFIED | POST /sync route present; `SyncButton` calls `handleSync` on click; wired to `api.sync.post()` |

No orphaned requirements — all 5 CANV IDs claimed by plans are fully implemented and traceable to artifacts.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, placeholder returns, hardcoded empty arrays, or stub patterns detected in any phase artifact.

---

### Human Verification Required

The automated layer is fully verified. The following behaviors require running the application with real Canvas credentials to confirm:

#### 1. Auto-sync on page load

**Test:** With valid `CANVAS_API_TOKEN` and `CANVAS_BASE_URL` in `apps/api/.env`, run `bun dev` from the project root and open `http://localhost:3000`.
**Expected:** Page loads, briefly shows no assignments (loader running), then renders a list of Canvas assignments with green dots on newly-seen items.
**Why human:** Route loader executes in a browser context after a live Canvas API call; cannot be asserted via static analysis.

#### 2. Sync Now button spinner behavior

**Test:** With the app running and assignments visible, click the "Sync Now" button.
**Expected:** Button text changes to "Syncing..." and the button is disabled; after sync completes, the button returns to "Sync Now" and a "Last synced just now" label appears below.
**Why human:** Transient in-flight UI state requires real-time observation.

#### 3. Sync error state on bad credentials

**Test:** Set `CANVAS_BASE_URL` to an invalid URL (e.g., `http://invalid.invalid`) in `apps/api/.env`, restart the API, then click Sync Now.
**Expected:** Red error text appears below the button showing the error string.
**Why human:** Requires env manipulation and runtime error path observation.

#### 4. MissingCredentials full-page blocking screen

**Test:** Remove `CANVAS_API_TOKEN` from `apps/api/.env`, restart the API, and refresh `http://localhost:3000`.
**Expected:** The page shows only "Canvas Not Configured" with `CANVAS_API_TOKEN` and `CANVAS_BASE_URL` variable names visible. No assignment list or sync button is rendered.
**Why human:** Requires env var removal and browser refresh to trigger the credentials-status branch.

#### 5. Sync-status dot colors across sync cycles

**Test:** After initial sync (green dots on all new items), make a change to an assignment on Canvas, then click Sync Now again.
**Expected:** The modified assignment shows an orange dot; previously-synced unchanged items show no dot.
**Why human:** Correct dot rendering depends on real Canvas data changing between sync cycles to produce `syncStatus = 'updated'`.

#### 6. Last synced timestamp display

**Test:** After a successful sync, verify the timestamp label reads something like "Last synced just now" and updates relative to wall clock time.
**Expected:** Timestamp uses the `timeAgo` helper to show a human-readable relative time.
**Why human:** Time-based rendering requires a live clock and real `syncedAt` value.

---

### Gaps Summary

No gaps found. All automated must-haves are verified at all four levels (exists, substantive, wired, data-flowing). The phase goal "Sync Canvas assignments into the app with real-time status indicators" is structurally complete:

- The data layer (schema + migration + Canvas service) is fully implemented and tested with 15 unit tests
- The API layer (sync route, assignments route, credentials-status) is fully wired and tested with 5 route tests + 2 assignment tests
- The frontend layer (MissingCredentials, SyncButton, index route) is fully wired with live API calls and builds without TypeScript errors
- All 5 requirement IDs (CANV-01 through CANV-05) are satisfied by concrete implementation

The 6 human verification items are behavioral/visual confirmations that require a running server with real Canvas credentials. They are not gaps — they are integration smoke tests for a feature that is structurally complete.

---

_Verified: 2026-04-02_
_Verifier: Claude (gsd-verifier)_
