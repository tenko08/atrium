# Phase 1: Foundation - Research

**Researched:** 2026-03-13
**Domain:** TanStack Start + ElysiaJS + Drizzle ORM + bun:sqlite — monorepo scaffolding
**Confidence:** HIGH

## Summary

This phase scaffolds a greenfield Bun workspaces monorepo with three packages (`apps/web`, `apps/api`, `packages/db`), wires TanStack Start (frontend SSR) and ElysiaJS (backend API) as separate servers on ports 3000 and 3001, defines the full SQLite schema via Drizzle ORM, and validates the end-to-end stack with a test API call via the Eden Treaty typed client.

TanStack Start underwent a major migration in v1.121.0 (June 2025): `app.config.ts` and Vinxi are gone; the framework is now a Vite plugin configured in `vite.config.ts` and source code lives in `src/` (not `app/`). This is the current stable pattern. Eden Treaty type-sharing across workspace packages requires all Elysia packages to pin to exactly the same version — version skew causes cryptic type errors. Bun 1.3.9 (February 2026) ships a native parallel script runner (`bun run --parallel --filter`), eliminating the need for `concurrently`.

**Primary recommendation:** Scaffold each workspace package independently with its own `package.json`, wire them with `workspace:*` references, use `bun run --parallel --filter './apps/*' dev` at the root, and run `PRAGMA journal_mode = WAL` immediately after opening the SQLite connection before any Drizzle usage.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Structure**
- Bun workspaces monorepo with separate packages: `apps/web` (TanStack Start), `apps/api` (ElysiaJS), `packages/db` (Drizzle schema + migrations + client)
- `apps/web` imports the Elysia app type directly from `apps/api` for Eden Treaty type inference — no separate types package
- `packages/db` is `@atrium/db`; only `apps/api` imports it at runtime (web never touches the DB directly)

**SQLite Schema**
- Define **full schemas** for all 6 tables in Phase 1 — no skeleton-only tables. Downstream phases write data without schema changes.
- Single `assignments` table with a `source` column (`'canvas' | 'manual'`) and nullable `canvas_id` — covers both Canvas assignments and manually-created tasks in one table, no UNION queries needed
- `schedule_blocks` links to assignments via `assignment_id` FK — each row is one scheduled work session for one assignment; includes `is_manual` flag for user-dragged blocks

**Dev Server**
- Two separate ports: TanStack Start on `:3000`, ElysiaJS on `:3001`
- Single `bun dev` command in workspace root starts both using `concurrently` (or equivalent)
- CORS handled server-side via `@elysiajs/cors` with `origin: 'http://localhost:3000'` — no proxy needed
- Eden Treaty in `apps/web` points to `http://localhost:3001`

### Claude's Discretion

- Column definitions for `time_estimates`, `fixed_events`, `preferences`, and `completion_history` tables — should follow the same patterns (integer PKs, unix ms timestamps, FK references where applicable)
- WAL mode enablement (required by success criteria — implementation detail)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-start` | latest (post v1.121.0) | Full-stack React SSR framework | Official TanStack Start package after Vite migration |
| `@tanstack/react-router` | latest | File-based routing (peer dep of Start) | Required by TanStack Start |
| `elysia` | latest stable | Type-safe HTTP backend framework | Bun-first, Eden Treaty source |
| `@elysiajs/eden` | latest stable | Type-safe API client (Eden Treaty) | Official typed client for Elysia |
| `@elysiajs/cors` | latest stable | CORS middleware for Elysia | Official plugin, needed for cross-origin `:3000` → `:3001` |
| `drizzle-orm` | latest stable | TypeScript ORM | bun:sqlite adapter, type inference, migration support |
| `drizzle-kit` | latest stable (devDep) | Schema codegen and migrations | Official Drizzle toolchain |
| `bun:sqlite` | built-in | SQLite driver | Zero-dependency, built into Bun |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vite-tsconfig-paths` | latest | Resolves TypeScript path aliases in Vite | Required for `~/` import aliases in TanStack Start |
| `@vitejs/plugin-react` | latest | React transform (Vite plugin) | Required peer dep for TanStack Start |
| `vite` | latest | Build tool underlying TanStack Start | Core build toolchain |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate ElysiaJS server on `:3001` | Elysia embedded in TanStack Start server routes | Official ElysiaJS docs show the embedded approach as the "integration" path; separate server is also valid and explicitly decided by user — gives cleaner separation and avoids TanStack Start's SSR complexity bleeding into API routes |
| `bun run --parallel --filter` | `concurrently` npm package | `concurrently` is still valid and was in the original plan; however Bun 1.3.9 (Feb 2026) ships native parallel runner with workspace-aware output — fewer dependencies is better |

**Installation (root workspace):**
```bash
# Run from workspace root
bun add -D concurrently  # or skip if using bun --parallel (see Dev Server section)
```

**Installation per package:**
```bash
# apps/web
bun add @tanstack/react-start @tanstack/react-router vite @vitejs/plugin-react vite-tsconfig-paths react react-dom
bun add @elysiajs/eden

# apps/api
bun add elysia @elysiajs/cors
bun add -D bun-types

# packages/db
bun add drizzle-orm
bun add -D drizzle-kit @types/bun
```

---

## Architecture Patterns

### Recommended Project Structure
```
atrium/                          # workspace root
├── bunfig.toml                  # CRITICAL: hoist nitro for TanStack Start
├── package.json                 # private: true, workspaces, root dev script
├── tsconfig.base.json           # shared TS config extended by packages
├── apps/
│   ├── web/                     # TanStack Start frontend
│   │   ├── package.json
│   │   ├── vite.config.ts       # tanstackStart() + viteReact() + tsconfigPaths()
│   │   ├── tsconfig.json        # extends ../../tsconfig.base.json
│   │   └── src/
│   │       ├── client.tsx       # hydrateRoot / StartClient
│   │       ├── server.tsx       # createStartHandler (SSR entry)
│   │       ├── router.tsx       # createRouter()
│   │       ├── api.ts           # Eden Treaty client singleton
│   │       └── routes/
│   │           └── __root.tsx   # root layout
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # Elysia app entry + .listen(3001)
│           └── routes/
│               └── health.ts    # test route for Phase 1 validation
├── packages/
│   └── db/
│       ├── package.json         # name: @atrium/db
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # exports { db, schema }
│           ├── client.ts        # Database connection + WAL pragma
│           └── schema/
│               ├── index.ts     # re-exports all tables
│               ├── assignments.ts
│               ├── timeEstimates.ts
│               ├── scheduleBlocks.ts
│               ├── fixedEvents.ts
│               ├── preferences.ts
│               └── completionHistory.ts
└── drizzle/                     # generated migration files (in packages/db)
```

### Pattern 1: Bun Workspace Root package.json
**What:** Workspace root declares all packages, runs parallel dev via bun's native runner.
**When to use:** Always — this is the monorepo entry point.

```json
// package.json (workspace root)
{
  "name": "atrium",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --parallel --filter './apps/*' dev",
    "build": "bun run --filter './apps/*' build"
  }
}
```

**Alternative using concurrently** (if `bun run --parallel` is not available or causes issues):
```json
{
  "scripts": {
    "dev": "concurrently \"bun run --cwd apps/api dev\" \"bun run --cwd apps/web dev\""
  },
  "devDependencies": {
    "concurrently": "^9"
  }
}
```

### Pattern 2: bunfig.toml — CRITICAL for Nitro Hoisting
**What:** TanStack Start uses Nitro internally. Bun's default isolated linking causes Nitro to not be found.
**When to use:** Any Bun monorepo with TanStack Start.

```toml
# bunfig.toml (workspace root)
[install]
publicHoistPattern = ["nitro*", "@tanstack*"]
```

After adding this, run `rm -rf node_modules bun.lockb && bun install`.

### Pattern 3: TanStack Start vite.config.ts (current — post v1.121.0)
**What:** TanStack Start is a Vite plugin. `app.config.ts` does NOT exist in current versions.
**When to use:** Current standard; `app.config.ts` is deprecated/removed.

```typescript
// apps/web/vite.config.ts
// Source: https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),   // MUST come before tanstackStart
    tanstackStart(),   // MUST come before viteReact
    viteReact(),
  ],
  server: {
    port: 3000,
  },
})
```

### Pattern 4: TanStack Start Minimum Entry Files
**What:** `src/` directory (not `app/` — that's the old Vinxi convention).
**When to use:** New TanStack Start projects.

```typescript
// apps/web/src/router.tsx
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  return createTanStackRouter({ routeTree })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

```typescript
// apps/web/src/client.tsx
import { hydrateRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { StartClient } from '@tanstack/react-start/client'
import { createRouter } from './router'

const router = createRouter()
hydrateRoot(document, <StrictMode><StartClient router={router} /></StrictMode>)
```

```typescript
// apps/web/src/server.tsx
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({ createRouter })(defaultStreamHandler)
```

### Pattern 5: ElysiaJS Server with Eden Treaty Export
**What:** Elysia app on port 3001, exporting its type for Eden Treaty.
**When to use:** Separate API server pattern (as decided).

```typescript
// apps/api/src/index.ts
// Source: https://elysiajs.com/eden/treaty/overview
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))
  .listen(3001)

export type App = typeof app

console.log(`API running at http://localhost:3001`)
```

```json
// apps/api/package.json scripts
{
  "scripts": {
    "dev": "bun --watch src/index.ts"
  }
}
```

### Pattern 6: Eden Treaty Client in apps/web
**What:** Import Elysia `App` type from `apps/api` for full type inference.
**When to use:** Any component or loader in `apps/web` that calls the API.

```typescript
// apps/web/src/api.ts
// Source: https://elysiajs.com/eden/treaty/overview
import { treaty } from '@elysiajs/eden'
import type { App } from '../../api/src/index'  // type-only import

export const api = treaty<App>('localhost:3001')
```

**IMPORTANT:** This is a type-only import path reference. In the workspace package.json for `apps/web`, add:
```json
{
  "dependencies": {
    "apps-api": "workspace:*"
  }
}
```
...OR use the direct relative path reference with `type` import (no runtime dependency needed — TypeScript resolves the type at compile time only). Verify the approach that works cleanly in your Bun workspace.

### Pattern 7: Drizzle + bun:sqlite Client with WAL
**What:** Database client with WAL mode enabled before Drizzle wraps it.
**When to use:** Single instantiation in `packages/db/src/client.ts`.

```typescript
// packages/db/src/client.ts
// Source: https://orm.drizzle.team/docs/connect-bun-sqlite
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

const sqlite = new Database(process.env.DB_FILE_NAME ?? 'atrium.db')
// Enable WAL mode BEFORE drizzle wraps the connection
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { schema }
```

### Pattern 8: Drizzle Schema Conventions
**What:** All 6 tables defined in Phase 1. Conventions: integer PKs, unix ms timestamps, FK references.
**When to use:** All schema files in `packages/db/src/schema/`.

```typescript
// packages/db/src/schema/assignments.ts
// Source: https://orm.drizzle.team/docs/connect-bun-sqlite
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const assignments = sqliteTable('assignments', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  source:       text('source', { enum: ['canvas', 'manual'] }).notNull(),
  canvasId:     text('canvas_id'),                    // null for manual tasks
  title:        text('title').notNull(),
  courseId:     text('course_id'),
  description:  text('description'),
  dueAt:        integer('due_at'),                    // unix ms, nullable
  estimatedMin: integer('estimated_min'),              // minutes
  completed:    integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedAt:  integer('completed_at'),               // unix ms
  createdAt:    integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt:    integer('updated_at').notNull().$defaultFn(() => Date.now()),
})
```

```typescript
// packages/db/src/schema/scheduleBlocks.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { assignments } from './assignments'

export const scheduleBlocks = sqliteTable('schedule_blocks', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  startAt:      integer('start_at').notNull(),         // unix ms
  endAt:        integer('end_at').notNull(),            // unix ms
  isManual:     integer('is_manual', { mode: 'boolean' }).notNull().default(false),
  createdAt:    integer('created_at').notNull().$defaultFn(() => Date.now()),
})
```

### Pattern 9: Drizzle Config and Migrations
```typescript
// packages/db/drizzle.config.ts
// Source: https://orm.drizzle.team/docs/get-started/bun-sqlite-new
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/schema/index.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE_NAME ?? 'atrium.db',
  },
})
```

```typescript
// packages/db/src/migrate.ts — run programmatically on API startup
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './client'

migrate(db, { migrationsFolder: './drizzle' })
```

### Pattern 10: .env for Canvas API Token
```bash
# apps/api/.env
CANVAS_API_TOKEN=your_token_here
CANVAS_BASE_URL=https://your-institution.instructure.com
DB_FILE_NAME=./atrium.db
```

The Canvas API token is **only** read server-side in `apps/api`. `apps/web` never has access to `process.env.CANVAS_API_TOKEN` — it only calls the Elysia API over HTTP. Never expose this to TanStack Start client-side code.

### Anti-Patterns to Avoid
- **Using `app.config.ts`:** This is the old Vinxi-era TanStack Start API. Current versions use `vite.config.ts` only.
- **Putting source in `app/` directory:** Old convention. Current default is `src/`.
- **Enabling WAL after `drizzle()`:** Call `sqlite.run('PRAGMA journal_mode = WAL')` before passing `sqlite` to `drizzle()`, not after.
- **Importing `@atrium/db` in `apps/web`:** The DB package is server-only. Web talks to the API over HTTP.
- **Mismatched Elysia versions:** If `apps/api` and `apps/web` both depend on `elysia` but at different versions, Bun may install two separate instances and Eden Treaty type inference breaks silently.
- **Forgetting `PRAGMA foreign_keys = ON`:** SQLite does not enforce FKs by default. Must be set per connection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-origin headers | Custom middleware | `@elysiajs/cors` | Handles preflight, credentials, origin matching correctly |
| Schema migrations | Manual SQL files | `drizzle-kit generate` + `migrate()` | Handles migration history, checksums, ordering |
| Parallel dev server startup | Shell `&` backgrounding or custom scripts | `bun run --parallel --filter` or `concurrently` | Handles SIGINT propagation, colored output, process groups |
| TypeScript path aliases in Vite | Custom resolver | `vite-tsconfig-paths` | Reads existing tsconfig, no duplication |
| WAL mode SQLite | Custom `sqlite3` wrapper | `bun:sqlite` + PRAGMA | Direct pragma is the correct mechanism; Drizzle has no WAL abstraction |

**Key insight:** Eden Treaty's type safety comes from exporting the Elysia `App` type — any boilerplate typed client layer between web and api packages is unnecessary and breaks inference.

---

## Common Pitfalls

### Pitfall 1: Nitro Package Not Found in Bun Monorepo
**What goes wrong:** `bun dev` in `apps/web` throws `Cannot find package 'nitro'` or related ENOENT error.
**Why it happens:** Bun's default isolated linker does not hoist `nitro` to the workspace root, but TanStack Start's Vite plugin expects it to be resolvable from the project root.
**How to avoid:** Add to `bunfig.toml` at workspace root:
```toml
[install]
publicHoistPattern = ["nitro*", "@tanstack*"]
```
Then delete `node_modules` and `bun.lockb` everywhere and run `bun install`.
**Warning signs:** `Error: Cannot find package 'nitro'` on first `bun dev`.

### Pitfall 2: Eden Treaty Type Inference Breaks Across Workspaces
**What goes wrong:** `api.health.get()` returns `unknown` type instead of the inferred type, or TypeScript errors about "private property" mismatches.
**Why it happens:** Bun installs two separate copies of `elysia` — one in `apps/api/node_modules` and one in `apps/web/node_modules` — when versions differ between package.json files. Eden Treaty needs both sides to resolve to the exact same Elysia instance.
**How to avoid:** Pin `elysia` and `@elysiajs/eden` to identical versions in all packages. Use Bun's catalog feature in root `package.json`:
```json
{
  "catalog": {
    "elysia": "1.x.x"
  }
}
```
Then in each child package: `"elysia": "catalog:"`.
**Warning signs:** Return type of Eden Treaty calls is `unknown` instead of the route response type.

### Pitfall 3: Using Old `app.config.ts` / `app/` Directory Convention
**What goes wrong:** Build fails, routes not found, or examples from pre-June-2025 tutorials don't work.
**Why it happens:** TanStack Start migrated from Vinxi to Vite in v1.121.0. The old `app.config.ts` file and `app/` source directory are from the Vinxi era and are now removed.
**How to avoid:** Always use `vite.config.ts` for configuration and `src/` as the source directory. Delete any `app.config.ts` if starting from an old template.
**Warning signs:** `app.config.ts` referenced in documentation you're following; `@tanstack/start` as the package name instead of `@tanstack/react-start`.

### Pitfall 4: Foreign Keys Not Enforced Without PRAGMA
**What goes wrong:** You insert a `schedule_blocks` row with a non-existent `assignment_id` and it silently succeeds.
**Why it happens:** SQLite has FK support compiled in but it's disabled by default per-connection.
**How to avoid:** Run `sqlite.run('PRAGMA foreign_keys = ON')` immediately after opening the database, before any reads or writes.
**Warning signs:** DELETE on an `assignments` row doesn't cascade-delete its `schedule_blocks`.

### Pitfall 5: TanStack Start RC / Memory Leak Status
**What goes wrong:** Unexpected memory growth in long-running dev session.
**Why it happens:** As of September 2025, TanStack Start is still in RC status with a known memory leak issue documented in the release announcement.
**How to avoid:** For Phase 1 (dev only), this is acceptable. Restart `bun dev` if the process grows. Note this for production deployment in a later phase.
**Warning signs:** Memory usage climbs steadily over time in dev mode.

### Pitfall 6: Plugin Ordering in vite.config.ts
**What goes wrong:** Routes not found, HMR broken, or React transform errors.
**Why it happens:** TanStack Start's plugin must run before the React plugin to intercept server function transforms.
**How to avoid:** Order must be: `tsconfigPaths()` → `tanstackStart()` → `viteReact()`.
**Warning signs:** Route files not recognized, or React-related build errors in `src/routes/`.

---

## Code Examples

### Health Route (ElysiaJS)
```typescript
// apps/api/src/index.ts
// Source: https://elysiajs.com/eden/treaty/overview
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .get('/health', () => ({
    status: 'ok' as const,
    timestamp: Date.now(),
  }))
  .listen(3001)

export type App = typeof app
```

### Eden Treaty Call from Browser
```typescript
// apps/web/src/api.ts
// Source: https://elysiajs.com/eden/treaty/overview
import { treaty } from '@elysiajs/eden'
import type { App } from '../../api/src/index'

export const api = treaty<App>('localhost:3001')

// Usage in a component or loader:
const { data, error } = await api.health.get()
// data is typed as { status: 'ok'; timestamp: number }
```

### Drizzle Schema with Enum Text
```typescript
// packages/db/src/schema/assignments.ts
// Source: https://orm.drizzle.team/docs/connect-bun-sqlite
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const assignments = sqliteTable('assignments', {
  id:       integer('id').primaryKey({ autoIncrement: true }),
  source:   text('source', { enum: ['canvas', 'manual'] }).notNull(),
  canvasId: text('canvas_id'),
  // ... other columns
})
```

### WAL + FK Pragma Setup
```typescript
// packages/db/src/client.ts
// Source: https://github.com/drizzle-team/drizzle-orm/issues/4968
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'

const sqlite = new Database(process.env.DB_FILE_NAME ?? 'atrium.db')
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA foreign_keys = ON')
export const db = drizzle(sqlite)
```

### Bun Workspace Root Dev Script
```json
// package.json (root)
// Source: https://bun.com/docs/pm/filter
{
  "name": "atrium",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --parallel --filter './apps/*' dev"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app.config.ts` + Vinxi | `vite.config.ts` + Vite plugin | v1.121.0, June 2025 | Old tutorials/templates won't work; must use new structure |
| `app/` source directory | `src/` source directory | v1.121.0, June 2025 | File paths in routes, entry points differ |
| `@tanstack/start` package | `@tanstack/react-start` package | v1.x | Package name changed with framework-specific adapters |
| `createAPIFileRoute()` | `createServerFileRoute()` | v1.x Vite migration | Old API route creation is deprecated |
| `ssr.tsx` + `client.tsx` required | Both optional (TanStack Start handles defaults) | v1.x Vite migration | Less boilerplate needed |
| `concurrently` for parallel dev | `bun run --parallel --filter` | Bun v1.3.9, Feb 2026 | Native, no extra dependency |

**Deprecated/outdated:**
- `app.config.ts`: Removed in v1.121.0 — delete it if present
- `@tanstack/start` (without framework suffix): Replaced by `@tanstack/react-start`
- Vinxi dependency: Should not appear in new projects

---

## Open Questions

1. **Eden Treaty type import path resolution**
   - What we know: `apps/web` needs to import `type { App }` from `apps/api/src/index.ts`
   - What's unclear: Whether to use a `workspace:*` dependency in package.json or a direct relative TypeScript path. There's a GitHub issue (#1518) about version mismatches causing type inference failures.
   - Recommendation: Add `"@atrium/api": "workspace:*"` to `apps/web/package.json`, export `App` from a stable location in `apps/api`, and use `import type { App } from '@atrium/api'`. If type inference still breaks, pin both packages to identical Elysia versions using the catalog pattern.

2. **TanStack Start RC memory leak**
   - What we know: As of September 2025 RC announcement, a memory leak was acknowledged
   - What's unclear: Whether this was fixed in subsequent RC iterations by March 2026
   - Recommendation: For Phase 1 dev-only purposes, this is not a blocker. Log it as a concern for Phase 8 (production deployment).

3. **`bun run --parallel --filter` vs `concurrently` reliability**
   - What we know: Bun 1.3.9 (Feb 2026) adds native support; `concurrently` is the battle-tested fallback
   - What's unclear: Whether `bun run --parallel` correctly handles Ctrl+C termination for both processes
   - Recommendation: Try `bun run --parallel --filter './apps/*' dev` first. If SIGINT propagation is broken (i.e., Ctrl+C doesn't kill both processes), fall back to `concurrently`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in — `bun:test`) |
| Config file | None required — Bun auto-discovers `*.test.ts` files |
| Quick run command | `bun test --filter health` |
| Full suite command | `bun test` (from workspace root or per-package) |

Bun ships a built-in test runner compatible with Jest APIs. No separate install needed. For this infrastructure phase, tests are integration/smoke tests verifying the stack is wired correctly.

### Phase Requirements → Test Map

This is an infrastructure phase with no named requirement IDs. The success criteria map to the following tests:

| Success Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-------------------|----------|-----------|-------------------|-------------|
| SC-1: `bun dev` starts without errors | API server responds on :3001 | smoke | `bun test apps/api/src/index.test.ts` | Wave 0 |
| SC-2: All 6 SQLite tables exist with WAL | Tables created + WAL enabled | integration | `bun test packages/db/src/schema.test.ts` | Wave 0 |
| SC-3: Eden Treaty call reaches Elysia | GET /health returns typed data | integration | `bun test apps/web/src/api.test.ts` | Wave 0 |
| SC-4: Canvas token not exposed to browser | `CANVAS_API_TOKEN` absent from web bundle | manual | Manual bundle inspection | N/A |

> SC-4 (token exposure) cannot be fully automated but can be verified by checking `bun build` output for the string `CANVAS_API_TOKEN`.

### Sampling Rate
- **Per task commit:** `bun test --filter health` (smoke test only, < 5s)
- **Per wave merge:** `bun test` (full suite across all packages)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/db/src/schema.test.ts` — verifies all 6 tables exist, WAL mode enabled, FK enforcement
- [ ] `apps/api/src/index.test.ts` — verifies Elysia starts, `/health` returns 200
- [ ] `apps/web/src/api.test.ts` — verifies Eden Treaty client reaches live API (requires API running)

---

## Sources

### Primary (HIGH confidence)
- [https://orm.drizzle.team/docs/connect-bun-sqlite](https://orm.drizzle.team/docs/connect-bun-sqlite) — Drizzle bun:sqlite setup, WAL pragma
- [https://orm.drizzle.team/docs/get-started/bun-sqlite-new](https://orm.drizzle.team/docs/get-started/bun-sqlite-new) — Full Drizzle + bun:sqlite new project guide
- [https://elysiajs.com/eden/treaty/overview](https://elysiajs.com/eden/treaty/overview) — Eden Treaty client setup and type export
- [https://elysiajs.com/plugins/cors](https://elysiajs.com/plugins/cors) — CORS plugin configuration
- [https://bun.com/docs/guides/ecosystem/tanstack-start](https://bun.com/docs/guides/ecosystem/tanstack-start) — Bun + TanStack Start official guide
- [https://bun.com/docs/guides/install/workspaces](https://bun.com/docs/guides/install/workspaces) — Bun workspaces setup
- [https://bun.com/docs/pm/filter](https://bun.com/docs/pm/filter) — Bun `--filter` flag for workspace scripts

### Secondary (MEDIUM confidence)
- [https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/](https://blog.logrocket.com/migrating-tanstack-start-vinxi-vite/) — TanStack Start Vinxi→Vite migration, new vite.config.ts and src/ structure
- [https://github.com/masrurimz/tanstack-start-elysia-better-auth-bun](https://github.com/masrurimz/tanstack-start-elysia-better-auth-bun) — Reference monorepo with TanStack Start + Elysia separate server pattern
- [https://tanstack.com/blog/announcing-tanstack-start-v1](https://tanstack.com/blog/announcing-tanstack-start-v1) — v1.0 RC announcement, status and known issues
- [https://elysiajs.com/integrations/tanstack-start](https://elysiajs.com/integrations/tanstack-start) — Official Elysia + TanStack Start integration (shows embedded approach; separate server also valid)

### Tertiary (LOW confidence — needs validation during implementation)
- [https://github.com/elysiajs/elysia/issues/1518](https://github.com/elysiajs/elysia/issues/1518) — Eden type problem in workspaces; version pinning solution
- [https://github.com/TanStack/router/issues/6235](https://github.com/TanStack/router/issues/6235) — Nitro hoisting bug in Bun monorepos
- Bun v1.3.9 blog — parallel script runner; verified via documentation but exact flag behavior should be tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from official docs and official Bun guides
- Architecture: HIGH — confirmed by official monorepo examples and reference implementations
- Pitfalls: MEDIUM — Nitro hoisting and Eden type issues confirmed from GitHub issues; TanStack Start RC status from official blog
- Validation approach: HIGH — Bun test is built-in, no extra setup needed

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (TanStack Start is moving fast; verify no breaking changes in RC if > 30 days pass)
