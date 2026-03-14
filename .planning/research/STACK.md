# Technology Stack

**Project:** Atrium — Student Productivity & AI Scheduling App
**Researched:** 2026-03-13
**Verification status:** TRAINING DATA ONLY — all external tools (WebSearch, WebFetch, Context7) were denied during this research session. All version numbers and library recommendations are based on knowledge through August 2025. Versions MUST be verified before installation.

---

## Recommended Stack

### Core Framework

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| TanStack Start | ~1.x | Full-stack React meta-framework | Already chosen. File-based routing, SSR/SPA hybrid, first-class TanStack Query integration. Built on Vinxi/Vite. |
| TanStack Router | ~1.x | Type-safe client-side routing | Ships with TanStack Start. Full TypeScript route tree, search param validation, nested layouts. Do not replace with React Router. |
| TanStack Query | ~5.x | Server state / async data management | Native integration with TanStack Start's `createServerFn`. Handles Canvas API polling, cache invalidation, background refetch. |
| React | ~19.x | UI layer | TanStack Start renders React. No choice here. |
| TypeScript | ~5.4+ | Type safety across stack | Non-negotiable for a project with complex scheduling logic, Canvas API shapes, and AI response parsing. |

### Backend

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| ElysiaJS | ~1.x | HTTP API server | Already chosen. Bun-native, end-to-end type safety via Eden Treaty, fast cold starts. Excellent plugin system. |
| Bun | ~1.x runtime | JavaScript runtime | ElysiaJS is designed for Bun. Do not run ElysiaJS on Node — you lose the primary performance and DX advantages. |
| @elysiajs/eden | ~1.x | Type-safe client from Elysia | Generates a typed API client from your Elysia app. Eliminates manual API typing between TanStack Start and ElysiaJS. Use this — it's the main DX win of the ElysiaJS choice. |
| @elysiajs/cors | ~1.x | CORS plugin | Needed for cross-origin requests from TanStack Start dev server to ElysiaJS during development. |
| @elysiajs/swagger | ~1.x | OpenAPI/Swagger docs | Zero-config API docs. Useful for Canvas API integration debugging and AI response schemas. |
| Zod | ~3.x | Schema validation | Use with `@elysiajs/zod` (or Elysia's built-in type provider) to validate Canvas API responses and AI outputs. Elysia has native Zod integration. |

### Database / Persistence

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| better-sqlite3 | ~9.x | SQLite driver for Node/Bun | Single-user local persistence. SQLite is the right call for a personal tool — zero infra, file-based, no connection overhead. `better-sqlite3` is synchronous and fast. |
| Drizzle ORM | ~0.30+ | Type-safe SQL query builder | Best SQLite ORM for the TanStack/Bun ecosystem in 2025. Generates TypeScript types from schema. Drizzle Kit handles migrations. Prefer over Prisma (Prisma has overhead and Bun support is inconsistent). |
| Drizzle Kit | ~0.21+ | Migration CLI | Companion to Drizzle ORM. Generates and runs SQLite migrations. |

**Why not Prisma:** Prisma's query engine binary has had reliability issues with Bun. Drizzle is lighter, fully TS-native, and its SQLite support is mature. For a single-user app, Prisma's features (multi-DB, Studio) are unnecessary overhead.

**Why not LibSQL/Turso:** Single-user local app — no need for remote or edge SQLite. Keep it simple.

### Canvas LMS Integration

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| Native `fetch` (Bun built-in) | — | Canvas REST API HTTP client | Canvas has no official JS SDK. Use Bun's native `fetch`. Build a typed wrapper around the Canvas API endpoints you need (assignments, submissions, courses, files). Do not reach for `axios` or `node-fetch`. |
| Zod | ~3.x | Validate Canvas API responses | Canvas API responses are not typed. Parse and validate every response with Zod schemas. This is how you get type safety for Canvas data. |
| `@extractus/article-extractor` or similar | — | Parse Canvas file/syllabus content | For reading syllabus PDFs/HTML to feed to LLM for time estimation. Investigate at implementation time. |

**Canvas API specifics:**
- Authentication: Bearer token (user provides their Canvas API token in app settings — no OAuth for v1 single-user tool)
- Base URL: configurable (e.g., `https://canvas.instructure.com` or institution-specific)
- Pagination: Canvas uses `Link` header pagination — your fetch wrapper MUST handle this
- Rate limits: Canvas imposes rate limits; implement simple retry with exponential backoff
- Relevant endpoints: `GET /api/v1/courses`, `GET /api/v1/courses/:id/assignments`, `GET /api/v1/courses/:id/files`, `GET /api/v1/users/self/todo_items`

**No npm package recommendation for Canvas client:** There is no well-maintained, broadly-used Canvas API TypeScript client as of mid-2025. Build a thin typed wrapper in-house (~200 LOC). This is straightforward given Canvas's consistent REST patterns.

### AI / LLM Integration

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| Vercel AI SDK (`ai`) | ~3.x / ~4.x | LLM abstraction layer | Provider-agnostic. Works with OpenAI, Anthropic, and others through a unified interface. Supports structured output (Zod schemas). Streaming. Works in server-side Bun/Node contexts. |
| `@ai-sdk/openai` | latest | OpenAI provider for AI SDK | GPT-4o-mini is the right model for time estimation — cheap, fast, good enough. Not GPT-4o unless estimates need heavy reasoning. |
| `@ai-sdk/anthropic` | latest | Anthropic provider (optional) | Claude Haiku/Sonnet as alternative provider. Include as optional; let user configure which backend. |
| Zod | ~3.x | Structured LLM output | AI SDK's `generateObject` uses Zod schemas to enforce structured responses. Required for reliable time estimates. |

**Why Vercel AI SDK over raw OpenAI SDK:** Provider portability, structured output (`generateObject`), streaming support, and active maintenance. Raw `openai` npm package works but locks you to one provider and requires manual structured output handling.

**Model recommendation for time estimation:**
- Use `gpt-4o-mini` (OpenAI) or `claude-3-haiku` (Anthropic) — fast, cheap, sufficient for "how long does a typical intro CS lab report take?"
- Do NOT use `o1`, `o3`, or expensive reasoning models for routine estimation tasks
- Keep prompts focused: assignment name + course + description + syllabus excerpt → estimated hours + confidence

### Calendar / Scheduling UI

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| `@fullcalendar/react` | ~6.x | Calendar block view component | Most mature React calendar with time-block (week/day view) support. Handles drag-and-drop rescheduling. Google Calendar-style out of the box. Actively maintained. |
| `@fullcalendar/daygrid` | ~6.x | Month view plugin | For monthly overview of assignments/deadlines. |
| `@fullcalendar/timegrid` | ~6.x | Time-block day/week view | The primary view — shows scheduled work blocks. |
| `@fullcalendar/interaction` | ~6.x | Drag and drop | Enables manual block dragging/resizing. Required for "reschedule by dragging" UX. |

**Why FullCalendar over alternatives:**
- `react-big-calendar`: less maintained, worse TypeScript support, no built-in drag-and-drop
- `@schedule-x/react` (newer): interesting but immature ecosystem as of 2025
- Rolling your own: weeks of work for features FullCalendar ships in one import
- FullCalendar's license: free for open-source/personal use; premium plugins require a license but are not needed here

### Date / Time Handling

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| `date-fns` | ~3.x | Date manipulation | Tree-shakeable, immutable, TypeScript-native. Use for schedule calculations: adding durations, finding next available block, checking deadline proximity. |
| `date-fns-tz` | ~3.x | Timezone support | Students have timezone-aware Canvas due dates. Required for correct deadline display. |

**Why not `dayjs`:** Fine library, but `date-fns` v3 has better TypeScript types and the `date-fns-tz` companion is well-integrated. Either works — pick `date-fns` for consistency.

**Why not `luxon`:** Heavier, less tree-shakeable. Overkill for this use case.

**Why not native `Temporal` API:** Not fully available in all browsers as of mid-2025. Use `date-fns` now, migrate to Temporal later.

### Styling

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| Tailwind CSS | ~3.x or ~4.x | Utility-first CSS | Standard for TanStack/React ecosystem in 2025. Fast to build with, easy to override FullCalendar styles. |
| shadcn/ui | latest | Accessible component primitives | Copy-paste component library built on Radix UI + Tailwind. Use for inputs, modals, dropdowns, preferences UI. Do NOT use a full component library (MUI, Chakra) — they are overkill and fight with FullCalendar's styling model. |
| Radix UI | ~1.x | Accessible primitives (via shadcn) | Shadcn/ui brings this transitively. Headless, accessible, composable. |

**Tailwind v3 vs v4:** Tailwind v4 was in beta/RC as of mid-2025. If stable by time of build, use v4 (no config file, CSS-first, faster). If not, stay on v3. Verify at project init time.

### State Management

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| TanStack Query | ~5.x | Server/async state | Already in the stack. Handles all Canvas API data, AI responses, schedule data from ElysiaJS. |
| Zustand | ~4.x | Local UI state | Lightweight client state for: current view (day/week/month), unfocused mode toggle, active task selection, preferences panel open/close. Do NOT use Redux — massively overkill for a single-user personal app. |

**What goes in TanStack Query vs Zustand:**
- TanStack Query: anything fetched from ElysiaJS or Canvas (assignments, schedule, AI estimates)
- Zustand: pure UI state that doesn't need persistence or server sync (selected date, modal open state, current view mode)
- Do NOT store derived data in Zustand if TanStack Query can derive it

### Testing

| Technology | Version (unverified) | Purpose | Why |
|------------|---------------------|---------|-----|
| Vitest | ~1.x or ~2.x | Unit / integration tests | Vite-native, fast, identical API to Jest. TanStack Start uses Vite — Vitest is the natural choice. |
| `@testing-library/react` | ~14.x | Component testing | Industry standard for React component tests. Pairs with Vitest. |
| Bun test runner | built-in | ElysiaJS backend unit tests | Bun ships with a built-in test runner (`bun test`). Use it for ElysiaJS route tests and scheduling logic tests. No need to add Vitest to the backend. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend runtime | Bun | Node.js | ElysiaJS is designed for Bun; Node loses the DX/performance benefits |
| ORM | Drizzle | Prisma | Bun/Prisma compatibility issues; Prisma is heavier; Drizzle is better for SQLite |
| LLM client | Vercel AI SDK | Raw openai npm | AI SDK is provider-agnostic, handles structured output, better DX |
| Calendar UI | FullCalendar | react-big-calendar | FullCalendar has better TS support, drag-and-drop, more active maintenance |
| Date library | date-fns | dayjs / luxon | date-fns has best TS types; date-fns-tz companion handles Canvas timezone dates |
| Component lib | shadcn/ui | MUI / Chakra | shadcn is copy-paste (no bundle bloat), Tailwind-native, fights less with FullCalendar |
| Client state | Zustand | Redux / Jotai | Zustand is minimal and sufficient; Redux is overkill for single-user local app |
| Canvas client | Hand-rolled fetch wrapper | npm canvas-api packages | No well-maintained TS Canvas SDK exists; thin wrapper is ~200 LOC and fully typed |
| Database | SQLite (better-sqlite3 + Drizzle) | PostgreSQL / MySQL | Single-user local app; zero infra overhead; file-based is perfect here |

---

## Installation

```bash
# --- TanStack Start project init ---
npx create-tsrouter-app@latest atrium --framework=react --template=start

# --- Backend (in /server or separate Bun project) ---
bun add elysia @elysiajs/eden @elysiajs/cors @elysiajs/swagger

# --- Database ---
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3

# --- Validation ---
bun add zod

# --- AI ---
bun add ai @ai-sdk/openai @ai-sdk/anthropic

# --- Calendar UI ---
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction

# --- Date handling ---
bun add date-fns date-fns-tz

# --- Styling (TanStack Start scaffold likely includes Tailwind) ---
# shadcn/ui init:
npx shadcn-ui@latest init

# --- State ---
bun add zustand

# --- Testing ---
bun add -d vitest @testing-library/react @testing-library/jest-dom
```

> **Warning:** All versions above are unverified against live registries. Run `npm info [package] version` or check npmjs.com before pinning versions. TanStack Start in particular was evolving rapidly through 2024-2025 and its scaffold command may have changed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| TanStack Start | LOW-MEDIUM | Framework was in RC/1.0 phase through 2025; ecosystem solidifying but may have breaking changes. Cannot verify current version. |
| ElysiaJS + Eden | MEDIUM | ElysiaJS 1.x was stable; Eden Treaty type-sync is the primary DX win. Verify Bun runtime version compatibility. |
| Drizzle ORM + SQLite | MEDIUM | Drizzle was the clear winner for Bun/SQLite as of mid-2025. API was stabilizing but had minor breaking changes between 0.2x versions. |
| Vercel AI SDK | MEDIUM | AI SDK v3/v4 was the dominant choice; verify whether v4 API differs significantly. `generateObject` with Zod is the right pattern. |
| FullCalendar React | MEDIUM-HIGH | FullCalendar v6 was stable and the dominant choice for time-block calendar UI. |
| Canvas API integration | HIGH (pattern) / LOW (library) | REST API patterns are stable; no JS SDK to verify. The fetch-wrapper approach is correct. |
| date-fns | HIGH | Mature, stable library. Version 3 API is settled. |
| shadcn/ui | MEDIUM | Actively updated; component availability and API may have evolved. |
| Zustand | HIGH | Stable v4 API, minimal surface area. |

---

## Sources

- Training data through August 2025 (all recommendations)
- All external verification tools (WebSearch, WebFetch, Context7) were unavailable during this research session
- **Action required:** Verify all versions against npmjs.com, official changelogs, and Context7 before committing to specific version pins
- TanStack Start docs: https://tanstack.com/start/latest
- ElysiaJS docs: https://elysiajs.com/
- Drizzle ORM docs: https://orm.drizzle.team/
- Vercel AI SDK docs: https://sdk.vercel.ai/docs
- FullCalendar React docs: https://fullcalendar.io/docs/react
- Canvas LMS API docs: https://canvas.instructure.com/doc/api/
