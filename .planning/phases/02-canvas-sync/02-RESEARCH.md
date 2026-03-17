# Phase 2: Canvas Sync - Research

**Researched:** 2026-03-16
**Domain:** Canvas LMS REST API + Elysia backend service + Drizzle SQLite upsert + TanStack Start frontend
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Canvas API token and institution URL are read from `.env` only — `CANVAS_API_TOKEN` and `CANVAS_BASE_URL` in `apps/api/.env`
- No settings UI, no DB-stored credentials
- Single-user personal tool; multi-user auth is explicitly out of scope for v1
- App auto-syncs on page load (fires automatically when the frontend mounts)
- A "Sync Now" button is always visible for on-demand refresh (satisfies CANV-05)
- The Sync Now button shows a spinner + "Syncing..." text while running
- When idle: button shows "↻ Sync Now"
- After completing: "Last synced X ago" timestamp shown beneath the button
- No result summary (new/updated counts) — just the timestamp
- Each assignment row shows a colored dot next to the name to indicate sync status:
  - Green dot = new assignment (first seen this sync)
  - Orange dot = updated assignment (changed since last sync)
  - No dot = unchanged
- Dot state is derived from comparing incoming Canvas data to what was previously stored
- If sync fails (Canvas unreachable, API error, timeout), show inline error text near the button: "Sync failed — Canvas unreachable" in red
- Previous data stays visible and usable; user can retry via Sync Now button
- If `CANVAS_API_TOKEN` or `CANVAS_BASE_URL` is missing from `.env`, show a blocking error state — full-page message instructing the user to add the variables to `apps/api/.env`
- Nothing else in the app renders until this is resolved

### Claude's Discretion
- Canvas API pagination strategy (Link header vs offset)
- Section due-date override lookup logic (per-student override vs default course deadline)
- Rate limit handling implementation (backoff strategy, retry count)
- How "sync status" is stored — a column on `assignments` or computed at query time
- Exact red/green/orange color tokens used

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANV-01 | User can connect to Canvas by providing an API token and institution URL | `.env` credential loading + blocking error screen when missing + validation via test API call on startup |
| CANV-02 | App reads all assignments across all active courses from Canvas, handling pagination correctly | Canvas `GET /api/v1/courses` + `GET /api/v1/courses/:id/assignments` with Link header pagination; `per_page=100` maximizes throughput |
| CANV-03 | App reads assignment due dates with section override support (correct deadlines per student) | Canvas `include[]=overrides` parameter on assignments; AssignmentOverride object with `course_section_id` + `due_at`; lookup user's section via enrollment then apply matching override |
| CANV-04 | App displays which assignments are new, updated, or unchanged since last sync | Add `syncStatus` column (`new` / `updated` / `unchanged`) to assignments table written at upsert time; frontend reads column for colored-dot display |
| CANV-05 | User can trigger a manual Canvas sync at any time | `POST /sync` Elysia endpoint; frontend "Sync Now" button calls via Eden Treaty |
</phase_requirements>

---

## Summary

Phase 2 is a focused backend data-plumbing phase. The API server fetches all assignments from Canvas (across all active student courses, with full pagination), resolves the correct due date per section, and upserts into the existing SQLite `assignments` table. A minimal frontend UI shows sync state (button + spinner + timestamp + per-row color dots) and a full-page blocking error if credentials are absent.

The main technical complexity lives in three areas: (1) **pagination** — Canvas returns 10 items/page by default; we follow `rel="next"` Link headers sequentially until exhausted; (2) **section overrides** — each assignment may have override objects with per-section due dates; we resolve the correct `due_at` by matching the user's enrolled section; (3) **sync status tracking** — we need to add a `syncStatus` column to the assignments table and a new Drizzle migration so the frontend can show new/updated/unchanged dots.

**Primary recommendation:** Build a `canvasService.ts` module in `apps/api/src/` that handles all Canvas HTTP calls and upsert logic, and expose a single `POST /sync` route. The frontend uses TanStack Start's loader for the auto-sync on mount and a button handler for on-demand sync, both via Eden Treaty.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia | latest (already installed) | `POST /sync` route + response typing | Project's locked backend framework |
| `@atrium/db` (Drizzle + bun:sqlite) | workspace | Upsert assignments into SQLite | Project's locked ORM/DB layer |
| Bun native `fetch` | built-in | Canvas API HTTP calls | No extra dependency; Bun's fetch is standards-compliant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` `sql` helper | already installed | `excluded.*` references in upsert `set` clause | Required for multi-column upserts from conflicting row values |
| `drizzle-kit` | already installed | Generate new migration for `syncStatus` column | Needed whenever schema changes |
| Eden Treaty (`@elysiajs/eden`) | already installed | Frontend calls to `POST /sync` | Project pattern for typed API calls from `apps/web` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun native fetch | `node-fetch` or `axios` | No reason to add a dependency; Bun fetch is full-featured |
| `onConflictDoUpdate` upsert | delete + re-insert | Upsert is atomic and preserves row `id`; delete/re-insert breaks FK refs |
| `syncStatus` column | Computed at query time | Column approach is simpler to query and doesn't require re-fetching Canvas data for comparison |

**Installation:** No new runtime packages needed. Only a new Drizzle migration file is required.

---

## Architecture Patterns

### Recommended File Structure for Phase 2
```
apps/api/src/
├── routes/
│   ├── health.ts            # existing
│   └── sync.ts              # NEW — POST /sync endpoint
├── services/
│   └── canvasService.ts     # NEW — all Canvas API calls + upsert logic
└── index.ts                 # register syncRoute (existing pattern)

packages/db/
├── drizzle/
│   └── 0001_canvas_sync_status.sql  # NEW migration: add syncStatus column
└── src/schema/
    └── assignments.ts       # ADD syncStatus column definition
```

### Pattern 1: Canvas Service Module

**What:** Isolated service that owns all Canvas HTTP interaction. The Elysia route calls `runSync()` and returns the result. No Canvas logic in route handlers.

**When to use:** Always — keeps route handler thin and service testable in isolation.

**Example (verified against Canvas API docs and project patterns):**
```typescript
// apps/api/src/services/canvasService.ts

const BASE_URL  = process.env.CANVAS_BASE_URL   // e.g. "https://school.instructure.com"
const API_TOKEN = process.env.CANVAS_API_TOKEN

async function canvasFetch(path: string): Promise<Response> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  })
  if (res.status === 429) {
    // Respect rate limit: wait 1 second and retry once
    await Bun.sleep(1000)
    return canvasFetch(path)
  }
  if (!res.ok) throw new Error(`Canvas API ${res.status}: ${path}`)
  return res
}

// Follow Link header pagination until rel="next" is absent
async function canvasFetchAll<T>(initialPath: string): Promise<T[]> {
  const results: T[] = []
  let url: string | null = `${BASE_URL}/api/v1${initialPath}`
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    })
    if (!res.ok) throw new Error(`Canvas fetch failed: ${res.status}`)
    const page: T[] = await res.json()
    results.push(...page)
    url = extractNextLink(res.headers.get('Link'))
  }
  return results
}

function extractNextLink(header: string | null): string | null {
  if (!header) return null
  // Link: <https://...>; rel="next", <https://...>; rel="last"
  const match = header.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}
```

### Pattern 2: Drizzle Upsert with `syncStatus`

**What:** Insert-or-update on `canvas_id` conflict. Set `syncStatus` to `'new'` for first insert, `'updated'` for changed rows, `'unchanged'` for identical rows.

**When to use:** All Canvas assignment writes go through this path.

**Example (verified against Drizzle docs):**
```typescript
// Source: https://orm.drizzle.team/docs/guides/upsert
import { sql } from 'drizzle-orm'
import { db, schema } from '@atrium/db'

// Before upsert: fetch existing canvas_ids from DB to compute status
const existing = await db
  .select({ canvasId: schema.assignments.canvasId, updatedAt: schema.assignments.updatedAt })
  .from(schema.assignments)
  .where(eq(schema.assignments.source, 'canvas'))

const existingMap = new Map(existing.map(r => [r.canvasId, r.updatedAt]))

// Determine sync status per assignment
const rows = canvasAssignments.map(a => ({
  source: 'canvas' as const,
  canvasId: String(a.id),
  title: a.name,
  courseId: String(a.course_id),
  courseName: a.course_name ?? null,
  description: a.description ?? null,
  dueAt: a.resolved_due_at ? new Date(a.resolved_due_at).getTime() : null,
  syncStatus: existingMap.has(String(a.id))
    ? 'updated'   // simplistic; refine to 'unchanged' when content matches
    : 'new',
  updatedAt: Date.now(),
}))

await db.insert(schema.assignments)
  .values(rows)
  .onConflictDoUpdate({
    target: schema.assignments.canvasId,
    set: {
      title:       sql.raw(`excluded.${schema.assignments.title.name}`),
      dueAt:       sql.raw(`excluded.${schema.assignments.dueAt.name}`),
      description: sql.raw(`excluded.${schema.assignments.description.name}`),
      syncStatus:  sql.raw(`excluded.${schema.assignments.syncStatus.name}`),
      updatedAt:   sql.raw(`excluded.${schema.assignments.updatedAt.name}`),
    },
  })
```

### Pattern 3: Section Override Resolution

**What:** Canvas assignments have a default `due_at`. If the student's section has an override, that override's `due_at` is the correct deadline.

**When to use:** After fetching each assignment (or batch), resolve due date before persisting.

**Canvas API call (from CONTEXT.md canonical ref + API docs):**
```
GET /api/v1/courses/:course_id/assignments?include[]=overrides&per_page=100
```

Each assignment response includes an `overrides` array when `include[]=overrides` is passed. Each override object:
```json
{
  "id": 987,
  "course_section_id": "456",
  "due_at": "2026-04-15T23:59:59Z",
  "title": "Section A Override"
}
```

Resolution logic:
```typescript
// Determine the user's section IDs for this course upfront
// GET /api/v1/courses/:id/enrollments?user_id=self
// enrollment.course_section_id

function resolvedue_at(
  assignment: CanvasAssignment,
  userSectionIds: Set<string>
): string | null {
  if (assignment.overrides) {
    for (const override of assignment.overrides) {
      if (override.course_section_id && userSectionIds.has(String(override.course_section_id))) {
        return override.due_at  // section-specific due date wins
      }
    }
  }
  return assignment.due_at ?? null  // fall back to course default
}
```

### Pattern 4: Elysia Sync Route

**What:** Thin route handler. Validates env vars, delegates to `canvasService.runSync()`, returns structured response.

```typescript
// apps/api/src/routes/sync.ts
import { Elysia } from 'elysia'
import { runSync } from '../services/canvasService'

export const syncRoute = new Elysia()
  .post('/sync', async () => {
    if (!process.env.CANVAS_API_TOKEN || !process.env.CANVAS_BASE_URL) {
      return { ok: false, error: 'missing_credentials' as const }
    }
    try {
      const result = await runSync()
      return { ok: true, syncedAt: Date.now(), ...result }
    } catch (err) {
      return { ok: false, error: 'canvas_unreachable' as const }
    }
  })
```

Registration in `apps/api/src/index.ts`:
```typescript
import { syncRoute } from './routes/sync'
// ...
const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .use(healthRoute)
  .use(syncRoute)   // ADD
  .listen(3001)
```

### Pattern 5: Frontend Auto-Sync + Button (TanStack Start)

**What:** TanStack Start loader fires sync on route mount (satisfies "auto-sync on page load"). Button calls same endpoint imperatively.

```typescript
// apps/web/src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../api'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  loader: async () => {
    // Auto-sync on mount
    await api.sync.post()
    const { data, error } = await api.health.get()
    return { health: data, error: error ? String(error.value ?? error.status) : null }
  },
  component: function IndexPage() {
    const { health, error } = Route.useLoaderData()
    const [syncing, setSyncing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

    const handleSync = async () => {
      setSyncing(true)
      setSyncError(null)
      const { data } = await api.sync.post()
      if (data?.ok) {
        setLastSyncedAt(data.syncedAt)
      } else {
        setSyncError('Sync failed — Canvas unreachable')
      }
      setSyncing(false)
    }
    // ...
  }
})
```

### Pattern 6: Schema Migration for `syncStatus`

**What:** Add `syncStatus` column to `assignments` table via Drizzle migration.

**Schema change:**
```typescript
// packages/db/src/schema/assignments.ts — add this field:
syncStatus: text('sync_status', { enum: ['new', 'updated', 'unchanged'] }),
```

**Run migration generation:**
```bash
cd packages/db && bunx drizzle-kit generate
```
This produces `packages/db/drizzle/0001_canvas_sync_status.sql`.

Then apply:
```bash
cd packages/db && bunx drizzle-kit migrate
```

### Anti-Patterns to Avoid

- **Storing Canvas credentials in DB or frontend:** Never. They live only in `apps/api/.env`. The frontend never sees them.
- **Calling Canvas API from `apps/web`:** CANVAS_API_TOKEN must not appear in browser bundle. All Canvas calls go through `apps/api`.
- **Single-item fetching per assignment for overrides:** Pass `include[]=overrides` on the assignments list call — it returns all overrides in one response per page.
- **Blocking the entire sync on one 429:** Retry only the failed request; do not restart the whole sync.
- **Using `per_page` below 100:** Canvas allows up to 100. Using the maximum minimizes round trips.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination | Custom offset loop | Follow `rel="next"` Link header | Canvas docs say Link headers are the correct approach; offsets can drift if data changes mid-fetch |
| Upsert | Delete + re-insert | Drizzle `onConflictDoUpdate` | Atomic, preserves row IDs, FK refs from other tables remain intact |
| Rate-limit backoff | Complex exponential backoff | Single retry after 1s sleep on 429 | Canvas docs say well-behaved single-threaded clients rarely get throttled; simple retry is sufficient |
| Link header parsing | Regex from scratch | Inline regex `/<([^>]+)>;\s*rel="next"/` | One-liner; no library needed for this simple format |
| "Time ago" formatting | Custom date math | `Intl.RelativeTimeFormat` (built-in JS) | Browser built-in, no dependency |

**Key insight:** Canvas pagination via Link headers is the correct protocol-level approach. Offset/page-number pagination is fragile if records are inserted or deleted between pages.

---

## Common Pitfalls

### Pitfall 1: Forgetting `per_page=100`
**What goes wrong:** Canvas defaults to 10 items per page. A course with 50 assignments takes 5 round trips instead of 1.
**Why it happens:** Default is undocumented to beginners.
**How to avoid:** Always append `?per_page=100` (or `&per_page=100`) to assignments and courses list calls.
**Warning signs:** Sync takes unexpectedly long; assignment count in DB is low.

### Pitfall 2: Not following `rel="next"` until absent
**What goes wrong:** Only first page of assignments is fetched; CANV-02 fails (pagination not handled correctly).
**Why it happens:** Code checks for `rel="last"` (which Canvas sometimes omits) instead of looping on `rel="next"`.
**How to avoid:** Loop: fetch page → push results → extract `rel="next"` → repeat until `rel="next"` is absent.
**Warning signs:** Missing assignments in DB; total count doesn't match Canvas.

### Pitfall 3: Using default `due_at` when section override exists
**What goes wrong:** CANV-03 fails — wrong deadline stored for students in non-default sections.
**Why it happens:** `due_at` on the assignment object is the course-wide default, not the section-specific one.
**How to avoid:** Always pass `include[]=overrides` and resolve via `resolvedue_at()` before upsert.
**Warning signs:** Due dates are off by days/weeks for some assignments.

### Pitfall 4: Missing `CANVAS_BASE_URL` trailing slash handling
**What goes wrong:** Fetch URL becomes `https://school.instructure.com//api/v1/...` (double slash) if user adds trailing slash.
**Why it happens:** String concatenation without normalizing the base URL.
**How to avoid:** Strip trailing slash from `CANVAS_BASE_URL` before use: `BASE_URL.replace(/\/$/, '')`.
**Warning signs:** All Canvas API calls fail with 404.

### Pitfall 5: `canvas_id` uniqueness constraint absent from schema
**What goes wrong:** `onConflictDoUpdate` needs a unique constraint or unique index on `canvas_id` to work. Without it, Drizzle/SQLite throws "no unique index found for column".
**Why it happens:** Current schema defines `canvas_id` as nullable `text` with no uniqueness constraint.
**How to avoid:** Add `UNIQUE` constraint on `canvas_id` in the migration. In Drizzle schema: use `uniqueIndex('canvas_id_idx').on(assignments.canvasId)` or `.unique()` on the column for non-null canvas rows. Because `canvas_id` is nullable (manual assignments), a partial unique index is preferred: unique where `canvas_id IS NOT NULL`.
**Warning signs:** Drizzle error at upsert: "no unique index" or duplicate canvas rows accumulating.

### Pitfall 6: Rate limit header name variation across institutions
**What goes wrong:** Some Canvas deployments use different header casing or omit `X-Rate-Limit-Remaining`.
**Why it happens:** Flagged in STATE.md: "rate limit header names vary by institution deployment."
**How to avoid:** Do not rely on rate limit headers for throttling decisions in Phase 2. Use a simple 429-triggered retry (1 second, once) as the sole rate-limit strategy. Validate headers against the actual Canvas instance during testing.
**Warning signs:** 429 errors without expected headers present.

### Pitfall 7: `syncStatus` computed wrong for "unchanged" rows
**What goes wrong:** Every sync marks all rows as `'updated'` because the upsert always fires.
**Why it happens:** Naive implementation sets `'updated'` on any conflict, even when content didn't change.
**How to avoid:** Before upserting, hash or compare key fields (`title`, `dueAt`) against the DB value. Only set `'updated'` when at least one field differs; set `'unchanged'` otherwise. After the sync completes, reset all `'new'`/`'updated'` rows that were NOT in the current Canvas response set to `'unchanged'` — or simply reset all to `'unchanged'` first, then mark only the affected rows.
**Warning signs:** Every assignment shows an orange dot on every sync.

---

## Code Examples

Verified patterns from official sources:

### Drizzle Upsert (from https://orm.drizzle.team/docs/guides/upsert)
```typescript
import { sql } from 'drizzle-orm'

await db.insert(schema.assignments)
  .values(rows)
  .onConflictDoUpdate({
    target: schema.assignments.canvasId,
    set: {
      title:      sql.raw(`excluded.${schema.assignments.title.name}`),
      dueAt:      sql.raw(`excluded.${schema.assignments.dueAt.name}`),
      syncStatus: sql.raw(`excluded.${schema.assignments.syncStatus.name}`),
      updatedAt:  sql.raw(`excluded.${schema.assignments.updatedAt.name}`),
    },
  })
```

### Canvas Pagination Loop (from https://canvas.instructure.com/doc/api/file.pagination.html)
```typescript
async function fetchAll<T>(startUrl: string, token: string): Promise<T[]> {
  const results: T[] = []
  let url: string | null = startUrl
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Canvas ${res.status}`)
    results.push(...(await res.json() as T[]))
    const link = res.headers.get('Link')
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  return results
}
```

### Canvas Auth Header (from canvas.instructure.com API intro)
```
Authorization: Bearer <CANVAS_API_TOKEN>
```
The token is a user-generated "Access Token" from Canvas Settings > Approved Integrations.

### Bun Test Pattern for Elysia Routes (from existing `apps/api/src/index.test.ts`)
```typescript
import { describe, test, expect } from 'bun:test'
import { Elysia } from 'elysia'

// Build app without .listen() — test against in-process handler
const app = new Elysia().use(syncRoute)

test('POST /sync returns ok:true', async () => {
  const res = await app.handle(new Request('http://localhost/sync', { method: 'POST' }))
  expect(res.status).toBe(200)
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas offset pagination (`?page=N`) | Link header following (`rel="next"`) | Canvas API always used Link headers as the canonical approach | More robust; handles inserts/deletes between pages |
| Separate override API call per assignment | `include[]=overrides` on list endpoint | Canvas API feature (always available) | Single batch call instead of N+1 calls |

**Deprecated/outdated:**
- `?page=N` offset pagination: While Canvas accepts it, the docs explicitly say Link headers are the correct approach and `rel="last"` may be omitted; offset pagination is not recommended.

---

## Schema Change Required

The existing `assignments` table (see `packages/db/src/schema/assignments.ts`) does **not** have a `syncStatus` column or a unique constraint on `canvas_id`. Both are required for Phase 2.

**Required migration adds:**
1. `sync_status TEXT` column with `CHECK(sync_status IN ('new', 'updated', 'unchanged'))` — nullable (NULL = never synced / manual assignments)
2. `UNIQUE` constraint on `canvas_id` — partial (only when `canvas_id IS NOT NULL`). In SQLite this is done as a partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS canvas_id_unique ON assignments(canvas_id) WHERE canvas_id IS NOT NULL`

Drizzle schema:
```typescript
syncStatus: text('sync_status', { enum: ['new', 'updated', 'unchanged'] }),
```
Plus a unique index defined in the table export:
```typescript
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
// ... in table definition, add after all columns:
}, (table) => ({
  canvasIdUnique: uniqueIndex('canvas_id_unique').on(table.canvasId),
}))
```
Note: SQLite's partial unique index (`WHERE canvas_id IS NOT NULL`) must be added in the raw migration SQL since Drizzle doesn't natively support partial indexes on SQLite as of early 2026.

---

## Open Questions

1. **Partial unique index support in Drizzle for SQLite**
   - What we know: Drizzle's `uniqueIndex()` on a nullable column will create a regular unique index, which treats each NULL as distinct (SQLite behavior) — meaning multiple manual assignments (null canvas_id) will work fine. This may actually be acceptable.
   - What's unclear: Whether this is sufficient or if an explicit partial index is needed.
   - Recommendation: Use `uniqueIndex('canvas_id_unique').on(table.canvasId)` in Drizzle — SQLite's NULL handling (each NULL is distinct) means manual assignments won't conflict. Verify with a test in `schema.test.ts`.

2. **User's enrolled section ID**
   - What we know: Canvas enrollments API returns `course_section_id` per enrollment. `GET /api/v1/courses/:id/enrollments?user_id=self` returns the current user's enrollment including section.
   - What's unclear: Whether a student can be in multiple sections per course (edge case).
   - Recommendation: Collect all section IDs for the user in a Set per course; any matching override wins. Document the multi-section edge case.

3. **"Unchanged" detection granularity**
   - What we know: The simplest approach is: if `canvasId` already exists → mark `'updated'`; if not → mark `'new'`. But that incorrectly marks unchanged rows.
   - What's unclear: Whether users will find orange dots on every sync annoying (they likely will).
   - Recommendation: Compare at minimum `title` and `dueAt` before upsert. If both match, write `'unchanged'`. After a sync completes, optionally reset all `'new'`/`'updated'` to `'unchanged'` on the next load (not same sync).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None — Bun discovers `*.test.ts` files automatically |
| Quick run command | `cd apps/api && bun test` |
| Full suite command | `bun test --cwd /Users/unalai/Documents/CS/atrium` (runs all workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANV-01 | `POST /sync` returns `{ ok: false, error: 'missing_credentials' }` when env vars absent | unit | `cd apps/api && bun test` | ❌ Wave 0 |
| CANV-01 | Blocking error screen shown in frontend when credentials missing | manual | — | manual only |
| CANV-02 | Pagination loop fetches all pages (mocked Canvas responses) | unit | `cd apps/api && bun test` | ❌ Wave 0 |
| CANV-02 | Assignments from all courses appear in DB after sync | integration | requires live Canvas token | manual |
| CANV-03 | `resolvedue_at()` returns override `due_at` when section matches | unit | `cd apps/api && bun test` | ❌ Wave 0 |
| CANV-03 | Falls back to default `due_at` when no matching section override | unit | `cd apps/api && bun test` | ❌ Wave 0 |
| CANV-04 | New assignment gets `syncStatus = 'new'` after first sync | unit | `cd packages/db && bun test` | ❌ Wave 0 |
| CANV-04 | Existing assignment gets `syncStatus = 'updated'` when title changes | unit | `cd packages/db && bun test` | ❌ Wave 0 |
| CANV-04 | Unchanged assignment gets `syncStatus = 'unchanged'` | unit | `cd packages/db && bun test` | ❌ Wave 0 |
| CANV-05 | `POST /sync` returns 200 and `{ ok: true, syncedAt: number }` | unit | `cd apps/api && bun test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && bun test`
- **Per wave merge:** `bun test --cwd /Users/unalai/Documents/CS/atrium` (full suite across all packages)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/sync.test.ts` — covers CANV-01, CANV-05
- [ ] `apps/api/src/services/canvasService.test.ts` — covers CANV-02 (pagination), CANV-03 (override resolution)
- [ ] `packages/db/src/schema/sync_status.test.ts` (or extend `schema.test.ts`) — covers CANV-04 upsert syncStatus behavior

---

## Sources

### Primary (HIGH confidence)
- `https://canvas.instructure.com/doc/api/file.pagination.html` — Link header format, rel="next" strategy, per_page parameter
- `https://canvas.instructure.com/doc/api/assignments.html` — Assignment object fields, include[]=overrides, AssignmentOverride object
- `https://canvas.instructure.com/doc/api/courses.html` — GET /api/v1/courses, enrollment_type/state filters
- `https://canvas.instructure.com/doc/api/file.throttling.html` — X-Request-Cost, X-Rate-Limit-Remaining headers, 429 handling, leaky bucket algorithm
- `https://orm.drizzle.team/docs/guides/upsert` — onConflictDoUpdate, excluded.* pattern, SQLite upsert
- Project source: `packages/db/src/schema/assignments.ts` — existing column names, types
- Project source: `apps/api/src/index.test.ts` — Elysia test-without-listen pattern
- Project source: `apps/web/src/api.ts` — Eden Treaty client pattern

### Secondary (MEDIUM confidence)
- `https://canvas.instructure.com/doc/api/all_resources.html` — confirmed overrides endpoint on assignments
- Community: Canvas rate limit header names vary by institution (confirmed in STATE.md + throttling docs)

### Tertiary (LOW confidence)
- Canvas `per_page` maximum: Community sources suggest 100 is the practical max; official docs do not state an explicit maximum.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed in project; no new dependencies needed
- Canvas API (pagination, auth, overrides): HIGH — verified against official Canvas docs
- Architecture patterns: HIGH — follow established Elysia + Drizzle patterns from Phase 1 codebase
- Schema migration requirement: HIGH — confirmed current schema lacks `syncStatus` and canvas_id uniqueness
- Rate limit handling: MEDIUM — Canvas docs confirm 429 + X-Rate-Limit-Remaining exists; header name variation is a known risk
- Pitfalls: HIGH — derived from API docs + codebase analysis

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Canvas API is stable; Drizzle/Elysia are on "latest" so re-verify if major versions change)
