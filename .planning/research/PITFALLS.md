# Domain Pitfalls

**Domain:** Student productivity / AI scheduling app (Canvas LMS + LLM + TanStack Start + ElysiaJS)
**Researched:** 2026-03-13
**Confidence note:** Web search and WebFetch were unavailable during this session. All findings draw from training-time knowledge of the Canvas API (docs circa 2024), TanStack Start (beta-era), ElysiaJS 1.x, and general LLM/scheduling literature. Confidence levels reflect this constraint.

---

## Critical Pitfalls

Mistakes that cause rewrites or block core functionality.

---

### Pitfall 1: Canvas Pagination Ignored on Assignment Fetch

**What goes wrong:** The Canvas REST API returns paginated results with a default page size of 10 and a max of 100. If you call `/api/v1/courses/:id/assignments` without following `Link` headers, you silently get only the first page. Students with many assignments (common in 5-course semesters) see a mysteriously incomplete todo list with no error.

**Why it happens:** The Canvas API follows RFC 5988 Link headers (`rel="next"`, `rel="last"`) rather than returning a total count. Developers who test with a small course miss the issue entirely.

**Consequences:** Missing assignments, broken schedule coverage, loss of user trust. The bug is invisible — no 4xx, no exception.

**Prevention:**
- Implement a generic Canvas paginator on day one. Follow `Link: <url>; rel="next"` until exhausted.
- Use `per_page=100` as the default query param to reduce round trips.
- Log total fetched counts per course after sync for sanity checking.

**Detection:** Seed a test course with 15+ assignments. If sync returns fewer than the Canvas UI shows, pagination is broken.

**Phase:** Canvas integration phase (first API work). Must be solved before any schedule generation.

---

### Pitfall 2: Canvas API Token Scope Is Unrestricted by Default

**What goes wrong:** Canvas personal access tokens (the v1 approach, appropriate for a single-user tool) are not scoped — they carry full read/write access to the user's Canvas account. If the token is leaked (logged, committed to git, exposed in network tab), an attacker can submit assignments, alter grades, or access all course data.

**Why it happens:** Canvas did not support scoped tokens for personal access tokens until recent versions, and many institutions run older Canvas instances. Developers treat the token as a config value and store it carelessly.

**Consequences:** Security incident. For a personal tool this is lower severity than a multi-user breach, but still a serious credential leak.

**Prevention:**
- Store the token exclusively server-side in ElysiaJS. Never expose it to the browser.
- Load from environment variable (`.env`), not hardcoded config.
- Add `.env` to `.gitignore` before the first commit.
- Log that a token is present/absent, not the token value itself.

**Detection:** Search codebase for the literal token string or any `Authorization:` header value being passed to client-side code.

**Phase:** Day 1 environment setup, before any Canvas API code is written.

---

### Pitfall 3: Canvas "Due Date" is Not the Same as "Available Until"

**What goes wrong:** Canvas assignments have three distinct date fields: `due_at`, `unlock_at`, and `lock_at`. Additionally, assignments can have per-student overrides (`assignment_overrides`) that shift these dates. Fetching only `due_at` from the assignments list gives the wrong deadline for students on extension, in different sections, or in courses with availability windows.

**Why it happens:** The assignments list endpoint returns the default `due_at`. Overrides require a separate API call (`/api/v1/courses/:id/assignments?include[]=overrides`). Developers building quickly miss the `include[]` parameter.

**Consequences:** Schedule built around wrong deadlines. Assignments appear available when they're locked. User misses a deadline because the app showed a different date.

**Prevention:**
- Always pass `include[]=overrides` when fetching assignments.
- Pick the most-restrictive applicable date for each student: use the override `due_at` if present, else the default `due_at`.
- Surface `lock_at` in the UI so users know when an assignment closes.

**Detection:** Compare app-shown due dates against Canvas UI for an assignment with a section override.

**Phase:** Canvas integration phase. Bake in from the first assignment sync, not retrofitted later.

---

### Pitfall 4: Canvas Rate Limiting Causes Silent Sync Failures

**What goes wrong:** Canvas enforces per-user API rate limits. The response includes an `X-Rate-Limit-Remaining` header. When the limit is hit, Canvas returns `403` with a `stale=true` flag (or in some deployments, `429`). If the sync code doesn't read these headers and back off, bursts of requests (e.g., fetching all courses + all assignments + all files simultaneously) silently fail or return stale data.

**Why it happens:** Developers issue parallel requests for speed and never test against a Canvas instance with low rate-limit headroom. Tests pass locally; production fails.

**Consequences:** Incomplete sync data. Errors that look like network failures. On some Canvas deployments, repeated rate-limit violations can trigger temporary account throttling.

**Prevention:**
- Read `X-Rate-Limit-Remaining` after every Canvas API response.
- If remaining drops below a threshold (e.g., 100), serialize remaining requests.
- On `403`/`429`, implement exponential backoff with jitter (start at 1s, cap at 30s).
- Sequence initial sync: fetch courses first, then assignments per course sequentially (or with concurrency limit of 2), then files.

**Detection:** Add logging for `X-Rate-Limit-Remaining` during development. Observe it during a full-course sync.

**Phase:** Canvas integration phase. Build the rate-limit-aware fetch wrapper before any multi-course sync logic.

---

### Pitfall 5: LLM Time Estimates Are Confidently Wrong and Uncalibrated

**What goes wrong:** LLMs will produce a specific number ("This assignment will take 2.5 hours") without uncertainty bounds, and that number will be wrong in systematic ways: they underestimate open-ended tasks (research papers, projects), overestimate short structured tasks (reading quizzes, fill-in forms), and have no awareness of the user's personal speed.

**Why it happens:** LLMs are trained on general text, not on time-tracking data for a specific student. They optimize for producing a plausible-sounding answer, not a calibrated estimate. Prompt naivety ("how long will this take?") produces the worst results.

**Consequences:** Schedules are either too aggressive (student can't finish) or bloated with padding. User distrust after the first missed block. The feature feels broken even when the rest of the app works.

**Prevention:**
- Never use raw LLM output as the schedule duration. Use it as one of three inputs: LLM prior, user-defined rules, historical actuals.
- Prompt the LLM for a range, not a point: "Estimate the minimum, typical, and maximum time a college student would need for this assignment."
- Apply a historical correction factor per assignment type once actuals are available. Even three data points improve calibration significantly.
- Default to pessimistic estimates (75th percentile, not median) — students prefer finishing early over running late.
- Cap LLM estimates at a sanity ceiling (e.g., 8 hours for a single task) and flag anything above 4 hours for manual review.

**Detection:** After using the app for a week, compare estimated vs actual durations by assignment type. If error exceeds 50% for any category, the estimation pipeline needs tuning.

**Phase:** Time estimation phase. Design the three-signal pipeline (LLM + rules + history) upfront; don't build LLM-only first and bolt on corrections later.

---

### Pitfall 6: Schedule Over-Optimization Produces an Unusable Calendar

**What goes wrong:** Optimizing a schedule too aggressively (minimize idle time, maximize assignment priority coverage, perfectly respect all preferences simultaneously) produces a calendar that is technically optimal but psychologically impossible to follow: back-to-back 50-minute blocks with no transitions, context-switching between subjects every hour, no slack for meals or unexpected events.

**Why it happens:** Scheduling as a constraint-satisfaction problem naturally tends toward dense packing when the objective is "complete everything before deadlines." The algorithm is correct; the model of human work is wrong.

**Consequences:** User abandons the generated schedule after day one. The app feels hostile rather than helpful.

**Prevention:**
- Build in mandatory minimum gap between blocks (15 minutes) that is not user-configurable in early versions.
- Limit consecutive focused work to 90-minute blocks before forcing a buffer.
- Reserve 10-15% of each day's working hours as unscheduled slack before deadline pressure forces 100% fill.
- Use "good enough" scheduling (greedy earliest-deadline-first with preference soft constraints) rather than optimal scheduling. Perfect is the enemy of useful.
- Show the user how much slack remains in the day, not just what's blocked.

**Detection:** Generate a schedule for a heavy week (4 assignments due, 20 hours of work). If any day shows fewer than 30 minutes of unblocked time during working hours, the algorithm is packing too aggressively.

**Phase:** Schedule generation phase. Encode human-factors constraints as first-class requirements, not post-processing tweaks.

---

### Pitfall 7: "Unfocused Mode" Defers Everything Instead of Adapting

**What goes wrong:** When a user marks blocks as skipped or enters "unfocused mode," the naive implementation is to push everything back. This breaks deadlines on heavy weeks and trains the user that the app will always find a way out. The schedule becomes meaningless.

**Why it happens:** Rescheduling is hard. Deferral is easy to implement and feels helpful in the moment. Developers build deferral first and never revisit.

**Consequences:** User misses deadlines the app "managed." Trust destroyed. The differentiating feature becomes a liability.

**Prevention:**
- Implement deadline-constrained rescheduling: given remaining available time windows and remaining work, find a feasible assignment — if none exists, surface the conflict explicitly ("You cannot complete Assignment X by Friday. Options: drop a block elsewhere, reduce scope, or request an extension.").
- Unfocused mode should insert break blocks and re-solve the schedule from current time forward, not just shift blocks.
- Distinguish between "I need a break now" (short-term reflow) and "I've fallen behind by hours" (conflict escalation).

**Detection:** Simulate a scenario where a user skips 3 hours of scheduled work on a day with a same-day deadline. If the app reschedules the work past the deadline without surfacing an alert, the rescheduling logic is wrong.

**Phase:** Unfocused mode phase (late feature). But the rescheduling engine's constraint model must be built in the schedule generation phase — retrofitting deadline constraints into deferral logic is extremely messy.

---

## Moderate Pitfalls

---

### Pitfall 8: TanStack Start SSR + ElysiaJS API — Type Safety Boundary Break

**What goes wrong:** TanStack Start (built on TanStack Router + Vinxi/Vite) supports server functions that run on the same process as the frontend. ElysiaJS is a separate HTTP server. When you colocate them or bridge between them, type safety can silently break at the boundary: ElysiaJS's Eden treaty client provides end-to-end types, but if you call the Elysia API from TanStack Start server functions (rather than from the browser), the request context differs and Eden's type inference may not cover the full call chain.

**Why it happens:** TanStack Start is relatively new (public beta as of 2024–2025). Its SSR model is not the standard Next.js pattern; documentation on integrating with a separate API process is thin.

**Prevention:**
- Run ElysiaJS as a completely separate process (separate port, separate deploy). Do not attempt to colocate in the same Vite/Vinxi process.
- Use ElysiaJS's Eden Treaty client in both browser components and TanStack Start server functions — keep one typed client, not two fetch patterns.
- Define a strict API contract (Elysia schema with `t.Object`) before building the frontend. The schema is the source of truth.
- Add a CI step that runs `tsc --noEmit` across the monorepo to catch boundary type breaks early.

**Detection:** If you find yourself using untyped `fetch()` calls to the ElysiaJS server anywhere in TanStack Start code, the type boundary has broken.

**Phase:** Project scaffolding phase. Establish the Eden Treaty client pattern in the first phase and never deviate.

---

### Pitfall 9: TanStack Start Loader Data and Stale Schedule State

**What goes wrong:** TanStack Start uses route loaders for data fetching. If the schedule is fetched in a loader and then mutated (a block is completed, unfocused mode triggers a reflow), the loader's cached data goes stale. Without proper invalidation, the displayed schedule and the server state diverge. The user sees a schedule that no longer matches reality.

**Why it happens:** TanStack Router's loader caching is aggressive by default. Mutations that change schedule state must explicitly invalidate the relevant route's loader. Developers accustomed to React Query's mutation-invalidation pattern may miss that TanStack Start's server functions work differently.

**Prevention:**
- Use TanStack Query inside TanStack Start for schedule data (not raw loaders) so that `invalidateQueries` works naturally after mutations.
- Alternatively, use loaders for static reference data (courses, preferences) and TanStack Query for mutable schedule state.
- Identify which routes need real-time-ish data (today's schedule) vs. which can tolerate stale data (historical view) and set cache TTLs accordingly.

**Detection:** Complete a schedule block in the UI and check whether the server state and displayed state agree within one render cycle without a page refresh.

**Phase:** Calendar display phase (first time schedule data is rendered). Establish the caching/invalidation pattern before building mutations.

---

### Pitfall 10: SQLite Write Contention on Schedule Reflow

**What goes wrong:** SQLite has a single write lock. In a Node.js/Bun async server (ElysiaJS runs on Bun), concurrent write operations — e.g., a Canvas sync writing assignments while a schedule reflow writes updated blocks — will queue on the write lock. With naive implementation using `better-sqlite3` (synchronous), async handlers may block the event loop. With an async driver, uncoordinated writes can cause `SQLITE_BUSY` errors.

**Why it happens:** SQLite is often chosen for simplicity in single-user apps (correctly), but developers assume "single user = no concurrency." The app still has multiple concurrent async operations even with one user.

**Prevention:**
- Use WAL (Write-Ahead Logging) mode: `PRAGMA journal_mode=WAL`. This allows concurrent reads and a single writer without blocking reads. Enable this on database initialization, every time.
- Serialize writes through a queue in ElysiaJS (a simple mutex or a dedicated write-handler function that awaits completion before accepting new writes).
- Keep Canvas sync writes and schedule reflow writes in separate transactions with clear boundaries. Do not interleave.
- For Bun + SQLite: use `bun:sqlite` (Bun's native driver) rather than `better-sqlite3`; it is synchronous by design but fast, and Bun handles the event loop integration correctly.

**Detection:** Trigger a Canvas sync and a manual schedule update simultaneously. If you see `SQLITE_BUSY` or stale reads, WAL mode is not enabled or write serialization is missing.

**Phase:** Database setup phase. WAL mode and the write pattern must be established before any concurrent operations are implemented.

---

### Pitfall 11: Canvas Course Files Fetched Eagerly Cause Slow Initial Sync

**What goes wrong:** The requirement to "read Canvas course materials (syllabi, files) to inform time estimates" means fetching file metadata and potentially file content. Canvas course file trees can be large — hundreds of PDFs, slides, and media files per course. Eagerly fetching all file metadata and content on first sync produces a slow, bandwidth-heavy initial load that blocks the user from seeing any schedule.

**Why it happens:** The feature is described as "read files to inform estimates," which developers interpret as "fetch all files." The actual need is narrower: fetch syllabus-like documents (typically 1-2 per course) to extract course expectations.

**Prevention:**
- Fetch only the root folder file list, then filter for likely syllabus documents by name pattern (`syllabus`, `course_outline`, `ENGL*`, `.pdf` files under 5MB).
- Use Canvas's dedicated syllabus endpoint (`/api/v1/courses/:id/front_page` and `/api/v1/courses/:id`) which often contains inline syllabus HTML — no file download needed.
- Make file content fetching lazy and background (after initial schedule is generated, not before).
- Cache fetched syllabus content per course; re-fetch only if the course's `updated_at` changes.

**Detection:** Time the initial sync. If it takes more than 5 seconds before the first schedule appears, file fetching is blocking the critical path.

**Phase:** Canvas integration phase. Design the sync pipeline with lazy file loading from the start.

---

### Pitfall 12: LLM Prompt Context Window Overflow on Syllabus Input

**What goes wrong:** Feeding an entire syllabus PDF (often 10-20 pages, 5,000-15,000 tokens) into an LLM prompt for every time-estimation call is slow, expensive, and unnecessary. At scale (5 courses x 10 assignments each = 50 estimation calls), context stuffing burns through token budgets rapidly and hits model context limits.

**Why it happens:** "Give the LLM all the context it needs" is sensible instinct. Developers include the full syllabus every time rather than pre-processing it once.

**Prevention:**
- Pre-process syllabi once per course at sync time: extract assignment types, typical workload descriptions, grading weights. Store as a short structured summary (500 tokens max).
- Use the summary, not the raw syllabus, in estimation prompts.
- Include only: assignment name, course name, assignment description (truncated to 500 chars), assignment type, course workload summary. Total prompt context under 1,000 tokens per estimation call.
- Cache estimation results per assignment. Re-estimate only when assignment content changes (Canvas `updated_at` field).

**Detection:** Log token counts per estimation call. If any call exceeds 2,000 input tokens, the prompt is over-stuffed.

**Phase:** Time estimation phase. Design the two-stage pipeline (syllabus pre-processing → estimation) before any LLM integration code.

---

## Minor Pitfalls

---

### Pitfall 13: Canvas `submission_types` Not Checked Before Scheduling

**What goes wrong:** Canvas assignments include a `submission_types` array (e.g., `["online_upload"]`, `["none"]`, `["not_graded"]`). Assignments with `submission_types: ["none"]` or `["not_graded"]` are typically administrative placeholders (attendance, participation) that should not appear in the task schedule. Including them creates noise.

**Prevention:** Filter out assignments where `submission_types` is `["none"]` or `["not_graded"]` and `points_possible` is 0 before adding to the todo list. Surface these separately as "ungraded items" if needed.

**Phase:** Canvas integration / todo list phase.

---

### Pitfall 14: Treating Canvas `workflow_state` as Binary

**What goes wrong:** Canvas assignments have a `workflow_state` field with values like `published`, `unpublished`, `deleted`. Fetching only `published` assignments is correct. But the submissions endpoint has its own `workflow_state` (`submitted`, `graded`, `unsubmitted`) which developers conflate with the assignment state. This leads to marking submitted assignments as still needing work.

**Prevention:** Track two separate states: assignment publication state (from assignments endpoint) and submission state (from submissions endpoint). Only surface assignments where submission `workflow_state` is `unsubmitted` or `submitted` (not `graded`).

**Phase:** Canvas integration phase.

---

### Pitfall 15: ElysiaJS Validation Errors Not Surfaced to Frontend

**What goes wrong:** ElysiaJS uses its own schema validation (TypeBox-based `t.*`). When validation fails, Elysia returns a `422` with a structured error body. If the Eden Treaty client or the frontend doesn't explicitly handle `422` responses, the user sees a generic "something went wrong" with no actionable information.

**Prevention:** Add a global error handler in ElysiaJS that formats validation errors consistently. Add a corresponding error display in the React layer that surfaces field-level errors for forms (preferences, manual task creation).

**Phase:** First form-submission phase (preferences / manual task creation).

---

### Pitfall 16: Time Zone Handling Inconsistency Between Canvas and Local Schedule

**What goes wrong:** Canvas stores all timestamps in UTC. The user's schedule must be rendered in their local time zone. If the backend stores schedule blocks in UTC but the frontend renders them naively (or vice versa), blocks appear at the wrong hours — especially severe around DST transitions.

**Prevention:**
- Store all times in the database as UTC ISO 8601 strings.
- Convert to local time exclusively in the frontend rendering layer using the browser's `Intl` API or a library like `date-fns-tz`.
- Never store "local time" in the database.
- Log the user's time zone as a preference at app startup.

**Phase:** Calendar display phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Canvas API scaffolding | Pagination ignored (Pitfall 1), token stored client-side (Pitfall 2) | Build paginator and server-side token storage in Phase 1 |
| Assignment sync | Wrong due dates from missing overrides (Pitfall 3), rate limit failures (Pitfall 4) | Use `include[]=overrides`, add rate-limit-aware fetch wrapper |
| Course file fetching | Eager file fetch blocks initial sync (Pitfall 11) | Lazy file loading, use Canvas syllabus endpoint first |
| Time estimation (LLM) | Uncalibrated point estimates (Pitfall 5), context overflow (Pitfall 12) | Range prompts, two-stage syllabus pipeline, sanity caps |
| Schedule generation | Over-packed calendar (Pitfall 6) | Mandatory gaps, 90-min cap, 10-15% slack reservation |
| Unfocused mode | Naive deferral breaks deadlines (Pitfall 7) | Constraint-aware reflow with conflict surfacing |
| TanStack Start setup | Type boundary breaks with ElysiaJS (Pitfall 8) | Separate processes, Eden Treaty from day one |
| Calendar UI mutations | Stale loader state after block completion (Pitfall 9) | TanStack Query for mutable schedule data |
| Database setup | SQLite write contention (Pitfall 10) | WAL mode + write serialization before any concurrent ops |
| Todo list display | Noise from ungraded assignments (Pitfall 13) | Filter on `submission_types` and `points_possible` |
| Due date display | Submitted assignments still shown as pending (Pitfall 14) | Track assignment state and submission state separately |
| Forms (preferences) | ElysiaJS validation errors swallowed (Pitfall 15) | Global error handler + frontend 422 display |
| Calendar rendering | Time zone shift errors (Pitfall 16) | UTC in DB, convert in browser only |

---

## Sources

All findings are from training-time knowledge (confidence: MEDIUM for Canvas API, HIGH for SQLite/TanStack/ElysiaJS patterns, MEDIUM-HIGH for LLM estimation and scheduling literature). External web sources were unavailable during this research session.

| Area | Confidence | Reason |
|------|------------|--------|
| Canvas API pagination, overrides, rate limits | MEDIUM | Well-documented behavior in training data; no live verification |
| Canvas token auth / credential handling | HIGH | Standard security practice, corroborated across many sources |
| LLM estimation reliability | MEDIUM-HIGH | Well-studied problem in LLM literature; no project-specific validation |
| Scheduling over-optimization | HIGH | Well-established human factors literature |
| TanStack Start + ElysiaJS integration | MEDIUM | TanStack Start was in beta in training data; ecosystem moves fast — verify current docs |
| SQLite WAL mode / write concurrency | HIGH | Stable SQLite behavior, consistent across versions |
| Token budget / context window management | MEDIUM-HIGH | Well-established LLM prompt engineering practice |

**Recommend verifying before Phase 1:**
- Current TanStack Start SSR model (has it stabilized post-beta?)
- ElysiaJS Eden Treaty client compatibility with latest Elysia 1.x
- Canvas API rate limit header names for the specific institution's Canvas deployment (some use `X-Rate-Limit-Remaining`, some differ)
