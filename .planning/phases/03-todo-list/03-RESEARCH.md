# Phase 3: Todo List - Research

**Researched:** 2026-04-02
**Domain:** TanStack Start frontend (React) + ElysiaJS backend + Drizzle/SQLite — todo list UX patterns
**Confidence:** HIGH

## Summary

Phase 3 extends the existing flat assignment list (`apps/web/src/routes/index.tsx`) into a full todo list. The schema is already correct — `completed`, `completedAt`, `source`, and `estimatedMin` columns all exist. No DB migration is needed for completion toggling. A new migration is needed only to ensure `syncStatus` column exists (already in migration 0001) — confirmed. The primary work is: (1) four new API routes on `assignmentsRoute`, (2) a grouping/sorting layer on the frontend, (3) completion toggle UI, (4) a manual task creation inline form, and (5) hover-reveal edit/delete controls for manual tasks.

The project uses **inline styles + monospace font** for all existing UI. No Tailwind, no shadcn components are installed — the shadcn skill is present in `.agents/skills/` but the project does NOT have shadcn initialized (no `components.json`, no UI library dependencies in `apps/web/package.json`). All new UI must follow the existing inline-styles pattern.

The Elysia routes currently have no body validation (`t.` schema). Phase 3 should introduce `t.Object()` validation on the new POST/PATCH bodies so Eden Treaty infers correct request types on the frontend. This is the idiomatic pattern for typed Eden Treaty clients.

**Primary recommendation:** Extend `assignmentsRoute` with four typed endpoints, add a grouping utility function (pure JS, no library), and build the todo UI in `index.tsx` using existing patterns (inline styles, `useState`, no external state manager).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Grouping & Sorting**
- D-01: Default grouping is by course — one section per Canvas course, plus a "Manual" section for user-created tasks
- D-02: Within each group, assignments are sorted by due date ascending (soonest first)
- D-03: Users can toggle grouping between course view and due-date view. Due-date view groups as: "Due today", "Due this week", "Due later", "No due date"
- D-04: The toggle is a small UI control (e.g., two buttons or a select) — not a page-level setting, just a view switch

**Completion Behavior**
- D-05: Checking off a task applies strikethrough styling + moves it to the bottom of its group (below incomplete tasks)
- D-06: Completion is a toggle — clicking a checked task unchecks it and moves it back to its position by due date
- D-07: Both Canvas assignments and manual tasks support completion toggling (same behavior for both)

**Manual Task Creation**
- D-08: Creation is via an inline form at the bottom of the "Manual" course section — no modal or popover
- D-09: Form fields: Name (required text input), Duration (separate hour and minute fields), Due date (separate day/month/year + optional time fields; no time defaults to 11:59pm)
- D-10: Due date is optional at creation time. Name is required, duration is required.

**Edit & Delete (Manual Tasks Only)**
- D-11: Hovering a manual task reveals pencil (edit) and trash (delete) icons on the right side of the row
- D-12: Clicking pencil transforms the row inline into editable fields — same structured inputs as creation. Save with Enter or checkmark; cancel with Escape
- D-13: Clicking trash deletes immediately — no confirmation dialog
- D-14: Canvas assignments do NOT show edit/delete icons

### Claude's Discretion
- Exact styling of the grouping toggle control
- How the "Manual" section is positioned relative to course sections
- How to handle manual tasks with no due date in due-date grouping view (put in "No due date" bucket)
- Animation/transition when a task moves to the bottom on completion (or no animation — keep it simple)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TODO-01 | User can view all Canvas assignments as a todo list, grouped by course or due date | Grouping utility function + toggle state in index.tsx |
| TODO-02 | User can mark assignments as complete from the todo list | `PATCH /assignments/:id/complete` endpoint + `completed` column already in schema |
| TODO-03 | User can manually create tasks not from Canvas (with name, estimated duration, optional due date) | `POST /assignments` endpoint + inline form component in Manual section |
| TODO-04 | User can edit or delete manually created tasks | `PATCH /assignments/:id` + `DELETE /assignments/:id` endpoints + hover-reveal inline editor |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Elysia | 1.4.27 (installed `latest`) | Backend routing + typed body validation via `t.Object()` | Already in use; Eden Treaty depends on it for type inference |
| `@elysiajs/eden` | latest (installed) | Eden Treaty typed HTTP client in frontend | Already wired in `apps/web/src/api.ts` |
| Drizzle ORM | latest (installed) | DB queries: `db.insert`, `db.update`, `db.delete` | Already in use in `@atrium/db` |
| React + TanStack Start | latest (installed) | Frontend routing + `useState` for local state | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bun:test` | built-in | Unit testing for new API routes | All new route files get `.test.ts` — existing pattern |
| Elysia `t` (TypeBox) | built-in with Elysia | Request body validation on POST/PATCH | New mutating endpoints MUST use `t.Object()` for Eden Treaty to infer request body types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline styles | shadcn/ui + Tailwind | shadcn is NOT installed in this project; adding it would break existing patterns. Inline styles is locked. |
| `useState` local state | Zustand/Jotai | No external state management in the project; `useState` + loader data is the established pattern |
| Pure JS grouping | lodash `groupBy` | No lodash installed; grouping logic is trivial (2 modes, simple sort) — hand-rolling is correct here |

**Installation:** No new packages required for this phase.

## Architecture Patterns

### Recommended Project Structure
The phase touches three areas:

```
apps/
├── api/src/routes/
│   └── assignments.ts       # Extend: add POST, PATCH /:id, DELETE /:id, PATCH /:id/complete
├── web/src/routes/
│   └── index.tsx            # Extend: grouping logic, completion toggle, creation form, edit/delete
│   └── components/
│       └── (no new files required — keep logic in index.tsx per existing pattern)
packages/db/src/             # No changes needed (schema already complete)
```

### Pattern 1: Elysia Route Extension with Body Validation
**What:** Add typed mutating routes to `assignmentsRoute` using `t.Object()` for body schemas.
**When to use:** All POST and PATCH routes that receive a JSON body. Without `t.Object()`, Eden Treaty cannot infer the request body type on the frontend.
**Example:**
```typescript
// Source: Elysia 1.x docs — https://elysiajs.com/validation/overview.html
import { Elysia, t } from 'elysia'
import { db, schema } from '@atrium/db'
import { eq } from 'drizzle-orm'

export const assignmentsRoute = new Elysia()
  .get('/assignments', async () => {
    return db.select().from(schema.assignments)
  })
  .post('/assignments', async ({ body }) => {
    const now = Date.now()
    const [row] = await db.insert(schema.assignments).values({
      source: 'manual',
      title: body.title,
      estimatedMin: body.estimatedMin,
      dueAt: body.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning()
    return row
  }, {
    body: t.Object({
      title: t.String({ minLength: 1 }),
      estimatedMin: t.Number({ minimum: 1 }),
      dueAt: t.Optional(t.Nullable(t.Number())),
    })
  })
  .patch('/assignments/:id/complete', async ({ params, body }) => {
    const [row] = await db.update(schema.assignments)
      .set({ completed: body.completed, completedAt: body.completed ? Date.now() : null, updatedAt: Date.now() })
      .where(eq(schema.assignments.id, Number(params.id)))
      .returning()
    return row ?? { error: 'not found' }
  }, {
    body: t.Object({ completed: t.Boolean() })
  })
  .patch('/assignments/:id', async ({ params, body }) => {
    // Manual tasks only — guard source === 'manual' for safety
    const [row] = await db.update(schema.assignments)
      .set({ title: body.title, estimatedMin: body.estimatedMin, dueAt: body.dueAt ?? null, updatedAt: Date.now() })
      .where(eq(schema.assignments.id, Number(params.id)))
      .returning()
    return row ?? { error: 'not found' }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1 }),
      estimatedMin: t.Number({ minimum: 1 }),
      dueAt: t.Optional(t.Nullable(t.Number())),
    })
  })
  .delete('/assignments/:id', async ({ params }) => {
    await db.delete(schema.assignments)
      .where(eq(schema.assignments.id, Number(params.id)))
    return { ok: true }
  })
```

### Pattern 2: Grouping Utility (Pure JS)
**What:** A pure function that takes a flat assignment array and returns grouped sections.
**When to use:** Called inside the render path of `index.tsx` based on the active `groupBy` toggle state.
**Example:**
```typescript
// Source: project conventions — no library needed
type Assignment = {
  id: number; title: string; courseName: string | null
  dueAt: number | null; completed: boolean; source: 'canvas' | 'manual'
  syncStatus: string | null; estimatedMin: number | null
}
type Group = { label: string; items: Assignment[] }

function groupByCourse(assignments: Assignment[]): Group[] {
  const map = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const key = a.source === 'manual' ? '__manual__' : (a.courseName ?? 'Unknown')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  const groups: Group[] = []
  for (const [key, items] of map) {
    const label = key === '__manual__' ? 'Manual' : key
    groups.push({ label, items: sortGroup(items) })
  }
  return groups
}

function groupByDueDate(assignments: Assignment[]): Group[] {
  const now = Date.now()
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)
  const weekEnd = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 7)
  const buckets: Record<string, Assignment[]> = {
    'Due today': [], 'Due this week': [], 'Due later': [], 'No due date': []
  }
  for (const a of assignments) {
    if (a.dueAt === null) { buckets['No due date'].push(a); continue }
    if (a.dueAt <= todayEnd.getTime()) buckets['Due today'].push(a)
    else if (a.dueAt <= weekEnd.getTime()) buckets['Due this week'].push(a)
    else buckets['Due later'].push(a)
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items: sortGroup(items) }))
}

function sortGroup(items: Assignment[]): Assignment[] {
  // Incomplete first (sorted by dueAt asc), then completed
  const incomplete = items.filter(a => !a.completed).sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  const complete = items.filter(a => a.completed).sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  return [...incomplete, ...complete]
}
```

### Pattern 3: Inline Form at Bottom of Manual Section
**What:** A form rendered below the manual task list that collects name, duration (hours + minutes), and optional due date.
**When to use:** Always visible at the bottom of the Manual section (not in a modal).
**Key notes:**
- `dueAt` is computed on submit: if no time given, set hours=23, minutes=59 on the parsed date before calling `.getTime()`.
- Duration: `hours * 60 + minutes` stored as `estimatedMin` integer in DB.
- Cancel: clear form fields (no routing).

### Pattern 4: Hover-Reveal Edit/Delete (Manual Tasks Only)
**What:** CSS `:hover` on the row (or `onMouseEnter`/`onMouseLeave` via `useState`) reveals pencil and trash icon buttons. In React with inline styles, use `useState` for hover state since CSS `:hover` doesn't work with inline styles.
**When to use:** Only for rows where `source === 'manual'`.
**Example:**
```typescript
// Source: React inline styles pattern (no CSS classes available)
const [hoveredId, setHoveredId] = useState<number | null>(null)
// On the <li>: onMouseEnter={() => setHoveredId(a.id)} onMouseLeave={() => setHoveredId(null)}
// Controls: {hoveredId === a.id && a.source === 'manual' && (
//   <button onClick={() => startEdit(a)}>✏</button>
//   <button onClick={() => handleDelete(a.id)}>🗑</button>
// )}
// Use text symbols (✏ ✕) or Unicode pencil (&#9998;) and trash (&#128465;) — no icon library installed
```

### Pattern 5: Inline Edit Row
**What:** When editing a manual task, replace the display row with the same structured input fields as creation.
**When to use:** Triggered by pencil icon click.
**Key notes:**
- Save on Enter (keydown handler on the title input) or checkmark button click.
- Cancel on Escape (keydown handler).
- After save: call `PATCH /assignments/:id`, update local `assignments` state, exit edit mode.

### Anti-Patterns to Avoid
- **Importing lodash/date-fns just for grouping/date math:** These operations are 10-20 lines of vanilla JS. Adding a library for this would contradict the zero-dep frontend philosophy.
- **Using a modal/popover for task creation:** D-08 locks inline form at the bottom of the Manual section.
- **Showing edit/delete on Canvas assignments:** D-14 is explicit — Canvas rows are read-only.
- **Relying on Eden Treaty type inference for routes without `t.Object()` body schemas:** Without the body schema, Eden Treaty treats the body as `unknown` and TypeScript errors emerge at the call site.
- **Storing duration as free-text string:** `estimatedMin` is an integer column (minutes). The frontend must convert hours+minutes inputs to a single integer before submission.
- **Not setting `updatedAt` on every mutation:** The `updatedAt` column is not auto-updated by Drizzle — it must be set explicitly in every `.set({})` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request body validation | Custom `if (!body.title)` guards | Elysia `t.Object()` | Validation is built-in; Eden Treaty needs the schema to infer frontend types |
| Unix ms to "Apr 10, 10:00 PM" | Custom date formatter | `formatDueDate()` already in `index.tsx` | Already exists and works; extract to a shared helper or keep inline |
| Sorting completed tasks to bottom | Custom sort algorithm | `sortGroup()` utility from Pattern 2 | 3-line sort covering incomplete-first + null-safe due date |

**Key insight:** The grouping, sorting, and date math here are truly trivial — a few dozen lines of vanilla JS. Every "utility library" option adds a dependency for marginal complexity reduction.

## Runtime State Inventory

> Omitted — this is a greenfield feature phase, not a rename/refactor/migration.

## Common Pitfalls

### Pitfall 1: Eden Treaty loses route types when body schema is missing
**What goes wrong:** New mutating routes added to `assignmentsRoute` without `t.Object()` body schemas produce `unknown` body types on the Eden Treaty client. `api.assignments.post({ title: '...' })` compiles but the TypeScript type has no shape.
**Why it happens:** Eden Treaty uses Elysia's TypeBox schema to statically derive request/response types. No schema = no inference.
**How to avoid:** Always pass `{ body: t.Object({...}) }` as the third argument to `.post()` and `.patch()`.
**Warning signs:** Eden Treaty call site autocomplete shows no body fields, or TypeScript accepts any object without complaint.

### Pitfall 2: `updatedAt` not auto-maintained by Drizzle
**What goes wrong:** After a PATCH, `updatedAt` stays at its old value in the DB.
**Why it happens:** The schema uses `$defaultFn(() => Date.now())` which only fires on INSERT. Drizzle has no `$onUpdateFn` equivalent in the SQLite driver — `updatedAt` must be set manually in every `.set({...})` call.
**How to avoid:** Include `updatedAt: Date.now()` in every `.set({})` in PATCH routes.
**Warning signs:** Rows showing stale `updatedAt` values after edits.

### Pitfall 3: Structured date inputs produce invalid dates silently
**What goes wrong:** If the user enters day=31 month=4 (April), `new Date(year, month-1, day)` produces May 1 silently (JavaScript date overflow). User doesn't see an error.
**Why it happens:** JS `Date` constructor normalises out-of-range values.
**How to avoid:** Validate that the reconstructed date matches the entered values (day, month, year after construction). Show an inline error if not.
**Warning signs:** Due dates appearing one or more days off from what was entered.

### Pitfall 4: `uniqueIndex` on `canvasId` rejects `null` collisions on some SQLite versions
**What goes wrong:** The `uniqueIndex('canvas_id_unique').on(table.canvasId)` in the schema. Per the Phase 2 decision log: "Regular uniqueIndex on canvasId is correct for SQLite — each NULL is distinct so multiple manual assignments won't conflict." This is confirmed correct for SQLite (NULLs are not equal to each other).
**Why it happens:** N/A — this is a non-pitfall, but worth confirming understanding so the planner doesn't add an extra migration.
**How to avoid:** No action needed. Multiple manual tasks (all with `canvasId: null`) will coexist without constraint violations.
**Warning signs:** Only a concern if the DB were PostgreSQL (where this would need `WHERE canvasId IS NOT NULL`).

### Pitfall 5: Hover-reveal state bleeds between rows if implemented with a single `hoveredId` that isn't cleared on delete
**What goes wrong:** If a task is deleted while its row is hovered, `hoveredId` still holds the deleted task's ID. The next render may not show the delete icon properly.
**Why it happens:** State is keyed by `id` — deleted items' IDs are no longer in the list, so this is actually a non-issue visually, but it leaves stale state.
**How to avoid:** On delete, call `setHoveredId(null)` alongside the state update that removes the deleted item.

### Pitfall 6: `PATCH /assignments/:id` params.id is a string, not a number
**What goes wrong:** Drizzle `eq(schema.assignments.id, params.id)` fails or returns no rows because `params.id` is a string `"5"` and the column is `integer`.
**Why it happens:** Elysia URL params are strings by default.
**How to avoid:** Use `Number(params.id)` or add `params: t.Object({ id: t.Numeric() })` to auto-coerce. `t.Numeric()` coerces string to number automatically.

## Code Examples

Verified patterns from existing codebase:

### Drizzle `.returning()` after insert/update
```typescript
// Source: Drizzle ORM docs + confirmed in packages/db schema
const [row] = await db.insert(schema.assignments).values({ ... }).returning()
// row is the full inserted record including auto-generated id, createdAt, updatedAt
```

### Drizzle delete with condition
```typescript
// Source: Drizzle ORM docs
import { eq } from 'drizzle-orm'
await db.delete(schema.assignments).where(eq(schema.assignments.id, id))
```

### Elysia route registration pattern (from apps/api/src/index.ts)
```typescript
// New routes follow the same export + .use() pattern
import { assignmentsRoute } from './routes/assignments' // same file, extended
const app = new Elysia()
  .use(cors(...))
  .use(healthRoute)
  .use(syncRoute)
  .use(assignmentsRoute)  // already registered
```

### Eden Treaty typed call for new endpoints
```typescript
// Source: apps/web/src/api.ts — existing treaty client
// After adding t.Object() body schema to POST /assignments:
const res = await api.assignments.post({ title: 'Read ch. 5', estimatedMin: 60, dueAt: 1775000000000 })
// For PATCH /:id/complete — Eden Treaty path param syntax:
const res = await api.assignments({ id: String(assignmentId) }).complete.patch({ completed: true })
```

### Due date construction with 11:59pm default
```typescript
// Source: project conventions — pure JS
function buildDueAt(day: string, month: string, year: string, hour?: string, minute?: string): number {
  const d = new Date(Number(year), Number(month) - 1, Number(day),
    hour ? Number(hour) : 23,
    minute ? Number(minute) : 59,
    0, 0)
  return d.getTime()
}
```

### Mocking Drizzle in Bun tests (established pattern from assignments.test.ts)
```typescript
// Source: apps/api/src/routes/assignments.test.ts
mock.module('@atrium/db', () => ({
  db: {
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([mockRow]) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([mockRow]) }) }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
  schema: { assignments: {} },
}))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `<ul>` list in index.tsx | Grouped sections with toggle | Phase 3 | Grouping logic added in-place; no new routing |
| GET /assignments only | GET + POST + PATCH/:id + PATCH/:id/complete + DELETE/:id | Phase 3 | assignmentsRoute extended; same file |
| No body validation on routes | `t.Object()` on all mutating routes | Phase 3 | Required for Eden Treaty type inference |

**Deprecated/outdated in this project:**
- The flat `assignments.map(...)` render in `index.tsx` is replaced with grouped section rendering in Phase 3.

## Open Questions

1. **Should `GET /assignments` return all fields including `estimatedMin`?**
   - What we know: Current response returns all columns from `db.select().from(schema.assignments)` — `estimatedMin` is already returned.
   - What's unclear: Phase 4 will display estimates; Phase 3 form needs to store duration as `estimatedMin`. The column and return are already correct.
   - Recommendation: No change needed. The column is already exposed.

2. **How should the Manual section be ordered relative to course sections?**
   - What we know: D-01 says "one section per Canvas course, plus a 'Manual' section." Position is Claude's discretion.
   - Recommendation: Place "Manual" at the bottom of the course-grouped view (after all Canvas course sections). This matches the user mental model of Canvas assignments as primary content.

3. **No time provided for due date — what timezone to use?**
   - What we know: `dueAt` is stored as unix ms. `new Date(year, month-1, day, 23, 59)` uses the browser's local timezone.
   - Recommendation: Use browser local timezone (JavaScript `new Date(...)` default) — consistent with how Canvas due dates are displayed after `formatDueDate()` runs `toLocaleDateString`. Document this assumption in code comments.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Runtime + test runner | ✓ | 1.2.18 | — |
| Node.js | Dev tooling | ✓ | 23.6.0 | — |
| SQLite (via bun:sqlite) | DB | ✓ | built-in with Bun | — |
| Elysia | API routes | ✓ | 1.4.27 | — |

No missing dependencies. This phase requires no new packages.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bun:test (built-in) |
| Config file | none — bun auto-discovers `*.test.ts` files |
| Quick run command | `bun test apps/api/src/routes/assignments.test.ts` |
| Full suite command | `bun test` (from repo root) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TODO-01 | `GET /assignments` returns all rows needed for grouping (source, courseName, dueAt, completed) | unit | `bun test apps/api/src/routes/assignments.test.ts` | ✅ (extend existing) |
| TODO-02 | `PATCH /assignments/:id/complete` toggles `completed` boolean and sets/clears `completedAt` | unit | `bun test apps/api/src/routes/assignments.test.ts` | ❌ Wave 0 |
| TODO-03 | `POST /assignments` creates a manual task with correct `source: 'manual'`, `title`, `estimatedMin`, `dueAt` | unit | `bun test apps/api/src/routes/assignments.test.ts` | ❌ Wave 0 |
| TODO-04 | `PATCH /assignments/:id` updates title/estimatedMin/dueAt; `DELETE /assignments/:id` removes the row | unit | `bun test apps/api/src/routes/assignments.test.ts` | ❌ Wave 0 |

**Frontend grouping logic** (course view, due-date view, sort order, completed-to-bottom) is pure JS and can be extracted to a testable utility:
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `groupByCourse` partitions by courseName + Manual bucket | unit | `bun test apps/web/src/utils/groupAssignments.test.ts` | ❌ Wave 0 |
| `groupByDueDate` assigns today/this week/later/no date buckets correctly | unit | `bun test apps/web/src/utils/groupAssignments.test.ts` | ❌ Wave 0 |
| `sortGroup` places completed tasks after incomplete, sorts by dueAt asc | unit | `bun test apps/web/src/utils/groupAssignments.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test apps/api/src/routes/assignments.test.ts`
- **Per wave merge:** `bun test` (full suite, currently 37 tests, all passing)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `apps/api/src/routes/assignments.test.ts` — covers TODO-02, TODO-03, TODO-04
- [ ] `apps/web/src/utils/groupAssignments.test.ts` — covers grouping logic for TODO-01
- [ ] `apps/web/src/utils/groupAssignments.ts` — extract grouping function so it's testable (not buried in component)

## Sources

### Primary (HIGH confidence)
- Direct code reading: `apps/web/src/routes/index.tsx`, `apps/api/src/routes/assignments.ts`, `packages/db/src/schema/assignments.ts`, `apps/api/src/index.ts` — all patterns verified from source
- Direct code reading: `apps/api/src/routes/assignments.test.ts` — Bun mock.module pattern confirmed
- Direct code reading: `packages/db/drizzle/0000_*.sql`, `0001_*.sql` — confirmed schema columns (completed, completedAt, syncStatus, estimatedMin all exist)
- Direct code reading: `apps/web/package.json` — confirmed NO shadcn/Tailwind dependency installed
- `node_modules/elysia/package.json` — Elysia 1.4.27 installed version confirmed

### Secondary (MEDIUM confidence)
- Elysia docs pattern for `t.Object()` body validation and `t.Numeric()` param coercion — consistent with version 1.x docs at https://elysiajs.com/validation/overview.html
- Drizzle ORM `.returning()` after insert/update — standard pattern documented at https://orm.drizzle.team

### Tertiary (LOW confidence)
- None — all critical claims verified from project source files directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from package.json and node_modules
- Architecture: HIGH — patterns extracted directly from existing working code
- Pitfalls: HIGH — identified from schema inspection (uniqueIndex null behavior confirmed in STATE.md decisions) and Elysia/Drizzle mechanics
- Test patterns: HIGH — existing test files confirm bun:test + mock.module approach

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable stack; Elysia/Drizzle/Bun are on `latest` pins — check if major versions bumped before implementing)
