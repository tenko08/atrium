# Project Research Summary

**Project:** Atrium — Student Productivity & AI Scheduling App
**Domain:** AI-assisted student scheduling with Canvas LMS integration
**Researched:** 2026-03-13
**Confidence:** MEDIUM

## Executive Summary

Atrium is a single-user, local-first productivity tool that differentiates itself from competitors like Reclaim.ai and Motion by natively integrating with Canvas LMS and providing AI-powered time estimation. The recommended approach treats the app as a layered pipeline: Canvas is the data source, a three-signal estimator (LLM + user rules + historical actuals) adds intelligence, a greedy deadline-aware scheduling engine converts tasks to time blocks, and a FullCalendar-based block view renders the output. Each layer can be built and tested independently, which is the correct order of construction — the architecture research strongly validates a phase-by-phase backend-first build.

The recommended stack is opinionated and well-matched to the project's constraints: TanStack Start + ElysiaJS (Bun) + SQLite (Drizzle ORM) + Vercel AI SDK. The single-user, local nature of the app makes SQLite the right database choice with zero infrastructure overhead. The primary DX win is the ElysiaJS Eden Treaty client providing end-to-end TypeScript safety between the backend and frontend. The schedule engine should use a greedy deadline-first algorithm rather than full constraint satisfaction — it is simpler, testable, and sufficient for the scale of 10–100 active assignments.

The two greatest risks are on the Canvas integration side (pagination, due date overrides, and rate limits that can silently corrupt data) and on the scheduling side (over-optimization producing a psychologically impossible calendar, and Unfocused Mode naively deferring work past deadlines). Both categories of risk are avoidable if the correct patterns are established in the foundational phases — retrofitting them later is significantly more expensive. The feature research is clear: the Canvas auto-import + AI estimation combination is the core differentiator and must ship in the MVP; everything else is additive.

## Key Findings

### Recommended Stack

The stack is well-suited to the project domain. TanStack Start provides SSR/SPA hybrid rendering with type-safe routing; ElysiaJS on Bun gives a performant, type-safe API server; Drizzle ORM over SQLite eliminates infrastructure overhead while maintaining TypeScript safety. The Vercel AI SDK abstracts LLM provider choice and provides structured output via Zod schemas. FullCalendar v6 is the correct choice for time-block calendar UI — no alternative is as mature for drag-and-drop week/day views. All version numbers require live verification before installation (research was conducted without access to live package registries).

**Core technologies:**
- **TanStack Start + TanStack Router**: Full-stack React framework — type-safe routing, SSR/SPA hybrid, native TanStack Query integration
- **ElysiaJS on Bun**: API server — Bun-native, end-to-end type safety via Eden Treaty client, fast cold starts
- **Drizzle ORM + SQLite (better-sqlite3 or bun:sqlite)**: Persistence — zero-infra local database, type-safe queries, WAL mode for concurrency
- **Vercel AI SDK (`ai` package)**: LLM abstraction — provider-agnostic (OpenAI/Anthropic), structured output via `generateObject` + Zod
- **FullCalendar React (v6)**: Calendar UI — time-grid block view, drag-and-drop, most mature option available
- **date-fns + date-fns-tz**: Date handling — tree-shakeable, immutable, best TypeScript types, timezone-aware
- **Zustand**: Client UI state — lightweight, sufficient for single-user app (current view, modal state)
- **shadcn/ui + Tailwind CSS**: Styling — copy-paste components, Tailwind-native, avoids bundle bloat from full component libraries
- **Zod**: Schema validation — Canvas API response parsing, LLM structured output, ElysiaJS route schemas

**Do not use:** Prisma (Bun compatibility issues), Redux (overkill), MUI/Chakra (fight with FullCalendar), React Router (TanStack Router is already included), any npm Canvas API package (none are well-maintained).

### Expected Features

**Must have (table stakes):**
- Calendar block view (Google Calendar-style day/week grid) — users expect this as the primary interface
- Todo/task list synchronized with calendar — list-mode fallback for overview
- Due date awareness on all tasks — foundational to scheduling logic
- Manual task creation — tasks outside Canvas must be supported
- Fixed event blocking (classes, recurring meetings) — required for schedule accuracy
- Schedule preferences (work hours, daily limits, buffer) — scheduling engine cannot function without this
- Task completion marking — without this the calendar fills with stale blocks
- Canvas submission status auto-sync — marks done when submitted in Canvas
- Persistent state between sessions — SQLite makes this straightforward

**Should have (differentiators):**
- Canvas LMS auto-import (assignments + due dates) — eliminates the #1 friction point; no competitor does this natively
- AI time estimation from assignment content — three-layer system: LLM inference + user rules + historical actuals
- User-defined estimation rules ("lab reports always take 3 hours") — builds user trust over time
- Historical time tracking with actual vs estimated comparison — estimates improve with usage
- Unfocused mode (break insertion + deadline-safe rescheduling) — named "I'm struggling today" mode competitors lack
- Real-time adaptation on missed blocks — offer one-click reschedule when a block passes uncompleted
- Buffer time before deadlines — configurable "finish N hours before due" preference
- Estimate confidence display (AI / rule / history badge) — surfaces estimation source for trust

**Defer to v2+:**
- Syllabus-informed estimates (high complexity: PDF extraction + prompt engineering)
- Assignment-type routing by day ("no coding on Fridays")
- Multi-user auth / accounts
- Google Calendar export / bidirectional sync
- Mobile app (iOS/Android)
- Collaboration / shared schedules
- Natural language task creation
- Pomodoro timer

### Architecture Approach

Atrium follows a layered pipeline architecture where each layer has a single responsibility and can be built and tested in isolation. The Canvas Sync layer pulls data from the Canvas REST API and upserts into SQLite. The Time Estimator consumes raw assignment data and produces duration estimates via three signals. The Schedule Engine consumes estimated assignments plus user preferences and produces ScheduleBlocks using a greedy deadline-aware algorithm. The Unfocused Mode Adapter patches today's blocks without regenerating the full schedule. The frontend renders ScheduleBlocks via FullCalendar and communicates back to ElysiaJS via the Eden Treaty typed client.

**Major components:**
1. **Canvas Sync** — Polls Canvas REST API, handles pagination, rate limits, and overrides; upserts assignments to SQLite
2. **Time Estimator** — Combines LLM inference (Vercel AI SDK), user-defined keyword rules, and historical actuals to produce `TimeEstimate` records
3. **Schedule Engine** — Greedy deadline-aware scheduler; builds available slots from preferences + fixed events, sorts assignments by urgency score, assigns to earliest fitting slots
4. **Unfocused Mode Adapter** — Patches current day's blocks with break intervals; validates deadline coverage and surfaces conflicts rather than silently deferring
5. **ElysiaJS API Layer** — REST routes with Eden Treaty type safety; orchestrates sync triggers, exposes CRUD for preferences/tasks/schedule
6. **Calendar UI** — FullCalendar time-grid rendering ScheduleBlocks; drag-to-reschedule, click-to-complete, manual event creation
7. **Todo List** — Flat assignment list with Canvas sync status badges; inline manual task creation
8. **Persistence** — Single SQLite database with WAL mode; shared singleton connection across all ElysiaJS handlers

**Key data models:** `Assignment`, `TimeEstimate`, `ScheduleBlock`, `Preference`, `UserRule`, `FixedEvent`, `CompletionHistory`

### Critical Pitfalls

1. **Canvas pagination ignored** — Canvas returns paginated results via `Link` headers; without following them you silently miss assignments. Build a generic paginator with `per_page=100` before any sync logic is written.
2. **Canvas due date overrides missing** — Always pass `include[]=overrides` when fetching assignments; per-student and per-section overrides exist and will produce wrong deadlines if ignored.
3. **Canvas rate limit causes silent failures** — Read `X-Rate-Limit-Remaining` on every response; implement exponential backoff on `403`/`429`; sequence sync requests with concurrency limit of 2.
4. **LLM estimates are confidently wrong** — Never use raw LLM output as the schedule duration. Use LLM as the prior in a three-signal system. Prompt for min/typical/max ranges. Default to pessimistic (75th percentile). Cap at 8 hours.
5. **Schedule over-optimization produces unusable calendar** — Mandate minimum 15-minute gaps between blocks, cap consecutive focus at 90 minutes, reserve 10-15% daily slack before deadline pressure forces full fill.
6. **Unfocused Mode defers work past deadlines** — Implement constraint-aware reflow that re-solves the schedule from current time forward; surface deadline conflicts explicitly rather than silently rescheduling past due dates.
7. **Canvas API token stored client-side or in DB** — Store exclusively server-side in `.env`; never expose to the browser; add `.env` to `.gitignore` before first commit.

## Implications for Roadmap

Based on the architecture's dependency chain and the pitfall research's phase warnings, the following 9-phase structure is recommended. Each phase produces working, demo-able software.

### Phase 1: Foundation — Database + Project Scaffolding
**Rationale:** All other phases depend on the database schema and the TanStack Start / ElysiaJS project structure. Establishing the Eden Treaty type-safe client pattern and SQLite WAL mode here prevents retrofitting later. The type boundary between TanStack Start and ElysiaJS must be established on day one.
**Delivers:** Working monorepo scaffold; all SQLite tables defined; WAL mode enabled; Eden Treaty client wired; `.env` setup with Canvas token; `bun:sqlite` singleton connection
**Addresses:** Persistent state (table stakes)
**Avoids:** Pitfall 8 (TanStack Start + ElysiaJS type boundary), Pitfall 10 (SQLite write contention), Pitfall 2 (Canvas token security)

### Phase 2: Canvas Sync
**Rationale:** Canvas auto-import is the core differentiator; everything else (estimation, scheduling) depends on having assignment data. The pagination, override, and rate-limit pitfalls must be solved here — they cannot be retrofitted.
**Delivers:** `CanvasSyncService` with pagination, `include[]=overrides`, rate-limit-aware fetch wrapper; upsert of courses + assignments into SQLite; `GET /assignments` and `POST /sync` endpoints
**Uses:** Native `fetch` (Bun), Zod for Canvas response validation, ElysiaJS endpoints
**Implements:** Canvas Sync architecture component
**Avoids:** Pitfall 1 (pagination), Pitfall 3 (overrides), Pitfall 4 (rate limits), Pitfall 13 (ungraded assignment noise), Pitfall 14 (submission vs assignment state)

### Phase 3: Todo List UI
**Rationale:** First visible output. Building a read-only todo list before the schedule engine lets you validate Canvas sync data in the browser and unblock frontend development without needing estimation or scheduling logic. Manual task creation gives the app value even before scheduling.
**Delivers:** TanStack Start frontend; assignment list with due date, course, completion status; Canvas sync status badge; manual task creation form; `POST /tasks` endpoint
**Uses:** TanStack Query for data fetching, shadcn/ui for list components, Tailwind CSS
**Avoids:** Pitfall 15 (ElysiaJS validation errors not surfaced to frontend)

### Phase 4: Time Estimator
**Rationale:** Estimates are required before the schedule engine can run. The three-signal pipeline (rules → LLM → history) must be designed upfront. LLM calls are asynchronous and must not block the sync response — the `needs_estimate` background queue pattern is established here.
**Delivers:** `UserRule` CRUD; `TimeEstimatorService` with rule matching + LLM inference via Vercel AI SDK; `TimeEstimate` records; background estimation queue (sync sets `needs_estimate`, trigger runs estimator); "Estimating..." badge in Todo List
**Uses:** Vercel AI SDK `generateObject` with Zod schema, `@ai-sdk/openai` or `@ai-sdk/anthropic`, gpt-4o-mini / claude-3-haiku
**Implements:** Time Estimator architecture component
**Avoids:** Pitfall 5 (LLM uncalibrated estimates — range prompts, 3-signal design), Pitfall 12 (context window overflow — pre-process syllabus to 500-token summary), Pitfall 2 (async LLM not blocking API)

### Phase 5: Schedule Engine
**Rationale:** The core algorithm. All inputs (assignments, estimates, preferences, fixed events) now exist. Greedy deadline-aware scheduling is the right approach — not full CSP. Human-factors constraints (mandatory gaps, 90-min cap, slack reserve) must be built in here, not added later.
**Delivers:** `Preference` model + defaults; available slot builder; greedy urgency-scored scheduler; deadline safety check with `UNSCHEDULABLE` warnings; `POST /schedule/generate` endpoint; `ScheduleBlock` records in SQLite
**Implements:** Schedule Engine architecture component
**Avoids:** Pitfall 6 (over-optimized calendar — mandatory 15-min gaps, 90-min cap, 10-15% slack), Pitfall 7 (constraint model must be present before Unfocused Mode is built)

### Phase 6: Calendar UI
**Rationale:** First visual schedule. FullCalendar renders ScheduleBlocks as positioned time-grid elements. TanStack Query (not raw loaders) must handle mutable schedule state here to ensure invalidation works correctly after mutations.
**Delivers:** FullCalendar time-grid 7-day view; ScheduleBlock rendering with course colors; mark-complete action; add fixed event (click empty slot); drag-to-reschedule (block pinning); UTC-to-local time zone conversion in browser
**Uses:** `@fullcalendar/react`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `date-fns-tz`
**Avoids:** Pitfall 9 (stale loader state — use TanStack Query for mutable schedule data), Pitfall 16 (time zone inconsistency — UTC in DB, convert in browser only)

### Phase 7: Preferences + User Rules UI
**Rationale:** The schedule engine is working but uses hardcoded defaults. This phase makes Atrium configurable and enables user-defined estimation rules — a key differentiator. Wires preferences into the scheduler for regeneration.
**Delivers:** Preferences editor (work hours, daily limits, buffer, session length, break duration, scheduling horizon); `UserRule` CRUD UI (course/type/keyword matching with duration overrides); preferences persisted to SQLite; schedule regeneration respects all preferences
**Uses:** shadcn/ui form components, Zustand for preferences panel open/close state

### Phase 8: Unfocused Mode
**Rationale:** The differentiating feature. The scheduling engine's constraint model (Phase 5) must already exist before this phase — Unfocused Mode is a targeted patch on today's blocks, not a full regeneration. It must surface deadline conflicts rather than silently deferring.
**Delivers:** Break insertion algorithm for current day; deadline coverage re-validation after break insertion; conflict surface UI ("Assignment X cannot fit before Friday — options: ..."); "I'm unfocused today" toggle in calendar UI; distinction between short-term reflow and multi-hour fall-behind escalation
**Implements:** Unfocused Mode Adapter architecture component
**Avoids:** Pitfall 7 (naive deferral — constraint-aware reflow with explicit conflict surfacing)

### Phase 9: Historical Calibration + Actuals
**Rationale:** Additive enhancement. Requires sufficient usage data to be meaningful. Captures actual completion times to improve future estimates. Closes the feedback loop of the three-signal estimation system.
**Delivers:** Start/stop timer per block; `CompletionHistory` recording (actual vs estimated, ratio); calibration factor fed back into LLM estimation prompt; estimated vs actual display in Todo List; estimate improvement over time
**Implements:** CompletionHistory data model; historical signal in Time Estimator

### Phase Ordering Rationale

- Phases 1 and 2 are pure backend and block everything else — no UI can be meaningful without Canvas data
- Phase 3 (Todo List) can start before Phase 4 completes — show "Estimating..." badges for un-estimated assignments
- Phase 5 (Schedule Engine) requires Phase 4 — estimates must exist to schedule
- Phase 6 (Calendar UI) requires Phase 5 — blocks must exist to render
- Phases 7, 8, 9 are additive enhancements on a working core and can be reordered based on user feedback
- The 9-phase structure mirrors the architecture's dependency graph exactly; each phase delivers a working vertical slice

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Canvas Sync):** Verify institution-specific Canvas API rate limit header names (`X-Rate-Limit-Remaining` vs `X-Request-Cost` varies by deployment). Verify current `include[]=overrides` behavior for assignment list endpoint.
- **Phase 4 (Time Estimator):** Verify Vercel AI SDK current version (v3 vs v4 API may differ). Verify `generateObject` Zod schema syntax for current version. Research optimal prompting for min/typical/max time range output.
- **Phase 6 (Calendar UI):** Verify FullCalendar v6 React API for drag-and-drop block pinning pattern. Verify TanStack Start loader vs TanStack Query boundary for mutable data.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** SQLite WAL mode, Drizzle schema definition, and TanStack Start + ElysiaJS monorepo scaffold are well-documented patterns.
- **Phase 3 (Todo List):** Standard TanStack Query + shadcn/ui list rendering.
- **Phase 5 (Schedule Engine):** Greedy deadline-first scheduling is a well-established algorithm; no novel research needed.
- **Phase 7 (Preferences UI):** Standard form CRUD with shadcn/ui.
- **Phase 9 (Historical Calibration):** Standard ratio-based calibration math; no novel research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | All versions unverified against live registries. TanStack Start was in RC/1.0 phase through 2025 and may have breaking changes. ElysiaJS Eden Treaty 1.x stable. Drizzle, date-fns, Zustand are stable. |
| Features | MEDIUM-HIGH | Canvas API feature surface is well-documented and stable. Competitor feature analysis (Motion, Reclaim.ai) based on training data through mid-2025 — may have evolved. Core differentiators (Canvas import, Unfocused Mode) are well-reasoned. |
| Architecture | HIGH | Greedy scheduling, layered pipeline, SQLite WAL mode, LLM as structured estimator — all established patterns with strong documentation. The build order is derived from clear dependency analysis. |
| Pitfalls | MEDIUM-HIGH | Canvas API pagination and override pitfalls are well-documented API behaviors. LLM calibration and over-scheduling are well-studied problems. TanStack Start integration pitfalls reflect its beta-era state. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **TanStack Start SSR model stability:** Research was conducted when TanStack Start was in beta/RC. Verify at project init that the SSR model and file-based routing have stabilized. Check whether `createServerFn` and Eden Treaty coexist cleanly in the current release.
- **ElysiaJS Eden Treaty + TanStack Start server functions:** Thin documentation on calling Eden Treaty from TanStack Start server functions (SSR context) vs browser context. Test this boundary in Phase 1 scaffolding before building API routes.
- **Institution-specific Canvas API behavior:** Rate limit headers, pagination behavior, and assignment override support can vary by Canvas deployment version. Validate against the actual target institution's Canvas instance during Phase 2.
- **Vercel AI SDK v3 vs v4 breaking changes:** Verify `generateObject` API signature and Zod integration pattern for the current release before Phase 4.
- **Syllabus file fetching approach:** Canvas's `/courses/:id/front_page` as a syllabus source vs file downloads — test which approach yields usable content for the target institution before building the syllabus-informed estimation pipeline.
- **bun:sqlite vs better-sqlite3:** Research recommends `bun:sqlite` (Bun's native driver) over `better-sqlite3` for Bun compatibility. Verify the Drizzle ORM adapter for `bun:sqlite` is stable before Phase 1 database setup.

## Sources

### Primary (HIGH confidence)
- Canvas LMS REST API documentation (canvas.instructure.com/doc/api) — assignment endpoints, submission states, pagination, rate limits, file endpoints
- SQLite WAL mode documentation — write-ahead logging, connection management patterns
- TanStack Start documentation (tanstack.com/start) — SSR model, route loaders, server functions
- ElysiaJS documentation (elysiajs.com) — Eden Treaty, plugin/context patterns, Bun integration
- Drizzle ORM documentation (orm.drizzle.team) — SQLite adapter, migration patterns

### Secondary (MEDIUM confidence)
- Vercel AI SDK documentation (sdk.vercel.ai/docs) — `generateObject`, provider configuration (training data; verify against current release)
- FullCalendar React documentation (fullcalendar.io/docs/react) — v6 API, drag-and-drop interaction plugin
- Reclaim.ai / Motion / Structured feature analysis — competitor scheduling UX patterns (training data through mid-2025)
- Greedy scheduling algorithm literature — deadline-first scheduling, constraint satisfaction vs greedy tradeoffs

### Tertiary (LOW confidence)
- TanStack Start beta-era integration patterns — needs validation against post-1.0 release
- Canvas institution-specific behavior — rate limit headers and deployment-specific API differences require live testing

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
