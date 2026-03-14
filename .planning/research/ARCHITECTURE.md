# Architecture Patterns

**Domain:** AI-assisted student scheduling / productivity app
**Project:** Atrium
**Researched:** 2026-03-13
**Confidence:** MEDIUM (no live web research available; based on established patterns for Canvas LMS integrations, LLM pipeline design, and calendar/scheduler apps)

---

## Recommended Architecture

Atrium is a single-user, single-tenant app. The architecture follows a **layered pipeline** — Canvas is the data source, an estimation layer adds intelligence, a scheduling engine turns tasks into time blocks, and a calendar UI renders the output. Each layer can be built and tested independently.

```
┌────────────────────────────────────────────────────────────────────┐
│  FRONTEND (TanStack Start / React)                                  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Calendar UI  │  │  Todo List   │  │  Preferences  │             │
│  │  (block view) │  │  (task list) │  │  (settings)   │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘             │
│         └─────────────────┼─────────────────┘                      │
│                           │ TanStack Query (client cache)           │
└───────────────────────────┼────────────────────────────────────────┘
                            │ HTTP / Elysia Routes
┌───────────────────────────┼────────────────────────────────────────┐
│  BACKEND (ElysiaJS)        │                                        │
│                           ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  API Layer  (REST routes — assignments, schedule, prefs)   │    │
│  └─────────┬──────────────────────────────────┬──────────────┘    │
│            │                                  │                    │
│  ┌─────────▼──────────┐          ┌────────────▼───────────────┐   │
│  │  Canvas Sync Layer  │          │  Schedule Engine            │   │
│  │  - Pull assignments │          │  - Build ScheduleBlocks     │   │
│  │  - Pull files/syllabus│        │  - Constraint satisfaction  │   │
│  │  - Track sync state │          │  - Unfocused mode adapter   │   │
│  └─────────┬──────────┘          └────────────┬───────────────┘   │
│            │                                  │                    │
│  ┌─────────▼──────────┐          ┌────────────▼───────────────┐   │
│  │  Time Estimator     │          │  Persistence Layer          │   │
│  │  - LLM inference    │          │  (SQLite via Bun/libsql)    │   │
│  │  - User rules       │          │                             │   │
│  │  - Historical data  │          └─────────────────────────────┘   │
│  └─────────────────────┘                                           │
└───────────────────────────────────────────────────────────────────┘
                            │
                 ┌──────────▼──────────┐
                 │  External Services  │
                 │  - Canvas LMS API   │
                 │  - OpenAI/Anthropic │
                 └─────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Inputs | Outputs | Communicates With |
|-----------|---------------|--------|---------|-------------------|
| **Canvas Sync** | Fetch assignments, due dates, submission status, course files from Canvas REST API. Cache results locally to avoid redundant API calls. | Canvas API token, course list | Raw Assignment rows, File metadata | Time Estimator, Persistence |
| **Time Estimator** | Produce a duration estimate (minutes) for each assignment. Combines LLM inference, user-defined rules, and historical actuals. | Assignment record, syllabus text, user rules, history | `TimeEstimate` record per assignment | Schedule Engine, Persistence |
| **Schedule Engine** | Turn the list of estimated assignments + user preferences into time-blocked ScheduleBlock records. Handles deadline constraints, daily hour limits, preferred windows, fixed blocks. | Assignments with estimates, Preferences, fixed events | `ScheduleBlock[]` for the planning horizon | Calendar UI, Todo List, Persistence |
| **Unfocused Mode Adapter** | Mutate an existing schedule to insert breaks while guaranteeing deadline coverage. Not a full regeneration — a targeted patch on the current day's blocks. | Current day's ScheduleBlocks, break policy | Updated ScheduleBlocks for today | Schedule Engine, Calendar UI |
| **Calendar UI** | Render ScheduleBlocks as a Google Calendar-style block view. Allow drag-to-reschedule, click-to-complete, add-manual-event. | ScheduleBlocks, Assignments | User actions (complete, move, add) | API Layer |
| **Todo List** | Flat list of all assignments with due date, estimate, completion status, and Canvas sync badge. Allows inline manual task creation. | Assignments, TimeEstimates | User actions (mark done, set rule) | API Layer |
| **Preferences UI** | Edit daily work hour limits, preferred work windows, buffer-before-deadline, assignment-type routing, and user rules for estimation. | Current Preferences | Updated Preferences | API Layer |
| **API Layer** | ElysiaJS routes. Orchestrates sync triggers, exposes CRUD for preferences/manual tasks, returns schedule data. | HTTP requests | JSON responses | All backend components |
| **Persistence** | Single SQLite database (via Bun's native SQLite or libsql). Tables for all domain models. | Domain objects | Persisted + queried data | All backend components |

---

## Data Flow

### Primary Pipeline: Canvas Assignment → Scheduled Block

```
1. CANVAS SYNC
   Canvas API
   → GET /api/v1/courses
   → GET /api/v1/courses/:id/assignments (due_at, name, description, submission_types)
   → GET /api/v1/courses/:id/files (syllabus, rubrics)
   → Upsert into assignments table (keyed on canvas_id)
   → Mark newly seen assignments as needs_estimate = true

2. TIME ESTIMATION
   For each assignment where needs_estimate = true:
     a. Check user rules (exact match on assignment type or course pattern)
        → If rule matches, emit estimate from rule; skip LLM
     b. Run LLM inference prompt with:
        - assignment name, description, course name
        - relevant syllabus excerpt (if available)
        - user's historical median for similar assignments
        - user's stated experience level
        → Parse structured JSON response: { estimate_minutes, confidence, reasoning }
     c. Store TimeEstimate record; link to Assignment

3. SCHEDULE GENERATION
   Trigger: manual "Regenerate" action OR new assignments synced
   Input: all incomplete assignments with estimates + Preferences + fixed events
   Algorithm:
     a. Build "available slots" list from Preferences
        (daily window, minus fixed events, minus already-completed blocks)
     b. Sort assignments by urgency score:
        urgency = (deadline_proximity_weight × days_until_due)
               + (estimate_size_weight × estimate_minutes)
               + (buffer_before_deadline)  ← pulled from Preferences
     c. Greedy-fit with deadline constraint check:
        For each assignment (sorted by urgency, most urgent first):
          - Find earliest available slot ≥ estimate_minutes
          - If assignment has a routing preference (e.g., "no coding after 9pm"), skip non-matching slots
          - Assign slot → emit ScheduleBlock
          - If no valid slot before deadline: flag as UNSCHEDULABLE and surface warning
     d. Persist ScheduleBlocks

4. UNFOCUSED MODE
   Trigger: user enables "unfocused mode" mid-session
   Input: remaining blocks for today
     a. Split remaining blocks into chunks with break gaps
     b. Recheck: do all deadlines still fit within available time today + future days?
     c. If not: surface which assignments need tomorrow intervention
     d. Update today's ScheduleBlocks in-place (do not regenerate whole schedule)

5. CALENDAR RENDER
   GET /schedule?start=today&end=+7days
   → Return ScheduleBlocks joined with Assignment title, course color
   → Frontend renders as positioned block elements on time grid
```

### Secondary Flows

```
Manual task add:
  User → Todo List / Calendar UI
  → POST /tasks (title, duration_override, due_at)
  → Insert as Assignment with source = "manual"
  → Trigger schedule regeneration for affected days

Manual fixed-event add:
  User → Calendar UI (click empty slot)
  → POST /events (title, start_at, end_at, recurring?)
  → Insert as FixedEvent
  → Trigger schedule regeneration for affected days

Completion tracking:
  User marks block done → PATCH /schedule-blocks/:id { completed_at }
  → If actual_minutes provided: write to completion_history
  → Re-run estimation confidence update for that assignment type
  → Free the slot for future scheduling
```

---

## Key Data Models

### Assignment

```typescript
interface Assignment {
  id: string;                      // local UUID
  canvas_id: string | null;        // null for manual tasks
  source: "canvas" | "manual";
  title: string;
  description: string | null;
  course_id: string | null;
  course_name: string | null;
  due_at: Date;
  submission_type: string | null;  // "online_upload", "online_text_entry", etc.
  is_submitted: boolean;           // from Canvas submission status
  is_completed: boolean;           // local completion flag
  completed_at: Date | null;
  synced_at: Date | null;
  needs_estimate: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### TimeEstimate

```typescript
interface TimeEstimate {
  id: string;
  assignment_id: string;           // FK → Assignment
  estimate_minutes: number;        // primary estimate used by scheduler
  confidence: "high" | "medium" | "low";
  source: "rule" | "llm" | "manual_override" | "historical";
  llm_reasoning: string | null;    // stored for debugging / display
  rule_id: string | null;          // FK → UserRule if source = "rule"
  actual_minutes: number | null;   // filled in when assignment completed
  created_at: Date;
}
```

### ScheduleBlock

```typescript
interface ScheduleBlock {
  id: string;
  assignment_id: string | null;    // null for break blocks
  event_id: string | null;         // FK → FixedEvent if a fixed event
  block_type: "work" | "break" | "fixed";
  title: string;                   // denormalized for fast render
  course_color: string | null;     // denormalized from course
  start_at: Date;
  end_at: Date;
  duration_minutes: number;
  is_completed: boolean;
  completed_at: Date | null;
  actual_minutes: number | null;
  generated_at: Date;              // when this block was last scheduled
  notes: string | null;
}
```

### Preference

```typescript
interface Preference {
  id: string;                      // single row, always id = "default"
  work_start_time: string;         // "09:00" (HH:mm)
  work_end_time: string;           // "22:00"
  max_daily_hours: number;         // hard cap
  buffer_before_deadline_hours: number;  // don't schedule within N hours of due
  preferred_session_length_minutes: number;  // chunk size for long assignments
  break_between_sessions_minutes: number;
  unfocused_break_minutes: number; // break size in unfocused mode
  scheduling_horizon_days: number; // how far ahead to schedule (default 14)
}
```

### UserRule

```typescript
interface UserRule {
  id: string;
  match_type: "course_name" | "assignment_title_contains" | "submission_type";
  match_value: string;             // e.g., "lab report", "CS 101", "online_upload"
  duration_minutes: number;        // fixed estimate when rule matches
  priority: number;                // higher = checked first
  created_at: Date;
}
```

### FixedEvent

```typescript
interface FixedEvent {
  id: string;
  title: string;
  start_at: Date;
  end_at: Date;
  recurrence_rule: string | null;  // iCal RRULE string for recurring events
  color: string | null;
  created_at: Date;
}
```

### CompletionHistory (for ML/historical estimation)

```typescript
interface CompletionHistory {
  id: string;
  assignment_id: string;
  course_name: string | null;
  submission_type: string | null;
  estimated_minutes: number;
  actual_minutes: number;
  ratio: number;                   // actual / estimated, for calibration
  recorded_at: Date;
}
```

---

## Patterns to Follow

### Pattern 1: Greedy Deadline-Aware Scheduling (not full constraint satisfaction)

**What:** Sort assignments by urgency (deadline proximity + buffer preference), then greedily assign each to the earliest fitting available slot. After each placement, verify the remaining assignments still fit before their deadlines.

**When:** Single user, moderate assignment counts (10–100 active). Full CSP (constraint satisfaction programming) is overkill and harder to debug. Greedy with deadline validation catches infeasible schedules cheaply.

**Why not full CSP:** CSP solvers (like Google OR-Tools) add significant complexity and a large dependency. For student-scale scheduling (dozens of tasks, not thousands), a well-ordered greedy approach with backtracking only on deadline violations performs identically to an optimal solver and is far easier to explain in warnings to the user.

**When to upgrade to CSP:** If users report the scheduler leaves gaps that could obviously fit tasks, or if the assignment count exceeds ~200 active items, revisit. Not needed for v1.

```typescript
function generateSchedule(
  assignments: AssignmentWithEstimate[],
  preferences: Preference,
  fixedEvents: FixedEvent[],
  horizon: number = 14
): ScheduleBlock[] {
  const slots = buildAvailableSlots(preferences, fixedEvents, horizon);
  const sorted = sortByUrgency(assignments, preferences.buffer_before_deadline_hours);
  const blocks: ScheduleBlock[] = [];

  for (const assignment of sorted) {
    const slot = findEarliestFittingSlot(
      slots,
      assignment.estimate_minutes,
      assignment.due_at,
      assignment.routing_preference
    );
    if (!slot) {
      emitWarning(assignment, "UNSCHEDULABLE");
      continue;
    }
    blocks.push(slotToBlock(slot, assignment));
    consumeSlot(slots, slot);
  }

  return blocks;
}
```

### Pattern 2: LLM as Structured Estimator, Not Orchestrator

**What:** The LLM receives a structured prompt and must return a structured JSON response (`{ estimate_minutes, confidence, reasoning }`). It does NOT make scheduling decisions or tool calls. It is a pure estimator.

**When:** Always. The LLM is one input among three (rules, LLM, history). Keeping it narrowly scoped prevents unpredictable behavior and makes estimates debuggable.

**Why:** Giving the LLM broader control (e.g., "plan my day") produces non-deterministic schedules that are hard to test and hard for users to understand. Structured estimation is auditable.

```typescript
const ESTIMATE_PROMPT = `
You are estimating study time for a student assignment.
Assignment: {title}
Course: {course_name}
Description: {description}
Submission type: {submission_type}
Syllabus excerpt: {syllabus_excerpt}
Student's historical median for {course_name}: {historical_median} minutes

Respond with JSON only:
{
  "estimate_minutes": <integer>,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one sentence>"
}
`;
```

### Pattern 3: Canvas Sync as a Background Pull, Not a Push

**What:** Atrium polls Canvas on demand (manual sync button) or on a schedule (e.g., every 15 minutes while the app is open). It does NOT use Canvas webhooks (Canvas doesn't offer them for assignment changes in standard deployments).

**When:** Always for v1. Canvas webhooks exist for some events but require institutional setup. Token-based polling is universally available.

**Implementation:** Track `synced_at` on each course. On sync, fetch assignments modified after `synced_at`. Upsert on `canvas_id`. Mark newly seen or changed assignments as `needs_estimate = true`.

### Pattern 4: Schedule Regeneration is Explicit, Not Automatic

**What:** The schedule is regenerated when the user explicitly triggers it, or when a sync produces new assignments. It is NOT reactively regenerated on every preference change or every block completion.

**When:** Always for v1. Auto-regeneration on every change causes jarring calendar shifts mid-day. Explicit regeneration gives the user control.

**Partial exception:** Completing a block should immediately free that slot visually (mark complete in-place). Full regeneration happens separately.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing the Schedule as a Derived View Inside the Database

**What:** Regenerating the schedule by querying the DB and writing back to the DB in a tight loop, treating `schedule_blocks` as a materialized view rather than a mutable schedule.

**Why bad:** Schedule blocks need to survive partial edits (user drags a block, marks one done). If they're treated as auto-generated view data, manual edits get overwritten on next regeneration.

**Instead:** Treat ScheduleBlocks as first-class persisted records. Regeneration creates new blocks for _future_ slots only, preserving completed or manually-moved blocks. Add a `user_modified: boolean` flag so the regenerator skips modified blocks.

### Anti-Pattern 2: Calling the LLM Synchronously in the API Request/Response Cycle

**What:** Making the Canvas sync endpoint wait for LLM estimates before returning.

**Why bad:** LLM calls can take 2–10 seconds each. With 30 new assignments, sync becomes a 60–300 second blocking operation.

**Instead:** Canvas sync completes immediately, setting `needs_estimate = true`. A background job (or lazy evaluation on schedule generation) runs estimation. Show a "Estimating..." state in the UI for un-estimated assignments.

### Anti-Pattern 3: One Giant "Generate Schedule" God Function

**What:** A single function that fetches Canvas data, calls LLM, runs scheduling, and writes to DB.

**Why bad:** Untestable, hard to partially re-run (e.g., "only re-estimate this one assignment"), impossible to add loading states.

**Instead:** Three separate, independently callable services: `CanvasSyncService`, `TimeEstimatorService`, `SchedulerService`. Each can be invoked in isolation.

### Anti-Pattern 4: Per-Request SQLite Connection Creation

**What:** Opening a new SQLite connection for every API request in ElysiaJS.

**Why bad:** SQLite performs best with a single persistent connection (WAL mode). Recreating connections has overhead and can cause locking issues.

**Instead:** Initialize one SQLite connection at app startup, enable WAL mode (`PRAGMA journal_mode=WAL`), and share the connection instance across all Elysia handlers via a service singleton or plugin context.

### Anti-Pattern 5: Storing Canvas API Token in Plaintext in the Database

**What:** Saving the Canvas API token in the preferences table as a plain string.

**Why bad:** SQLite is a local file. If the file is readable by other processes or backed up unencrypted, the token is exposed.

**Instead:** Store the token in a `.env` file (excluded from version control), accessed via `process.env.CANVAS_API_TOKEN`. For a single-user local app, this is sufficient for v1.

---

## Suggested Build Order

Dependencies flow upward. Each phase should produce working, demo-able software.

```
Phase 1: Persistence Foundation
  → Define all DB tables (assignments, schedule_blocks, preferences,
    fixed_events, time_estimates, user_rules, completion_history)
  → Set up Bun SQLite with WAL mode
  → Write typed repository functions (no ORM needed for this scale)
  No UI yet. Validate with unit tests against the DB.

Phase 2: Canvas Sync
  → CanvasSyncService: fetch courses, assignments, submission status
  → Upsert into assignments table
  → Expose GET /assignments and POST /sync endpoints
  Deliverable: terminal can trigger sync and see assignment list.

Phase 3: Todo List UI (read-only)
  → TanStack Start frontend
  → Assignment list view reading from /assignments
  → Shows: title, course, due date, completion status
  → Manual task creation (POST /tasks)
  Deliverable: visible list of Canvas assignments in the browser.

Phase 4: Time Estimator
  → UserRule matching (no LLM yet)
  → LLM estimation via OpenAI/Anthropic API
  → Store TimeEstimate records
  → Background estimation: sync sets needs_estimate, a trigger runs estimator
  Deliverable: assignments in the list show estimated durations.

Phase 5: Schedule Engine (core)
  → Preference model + defaults
  → Available slot builder
  → Greedy scheduler with deadline validation
  → POST /schedule/generate endpoint
  Deliverable: schedule_blocks table populated; API returns blocks as JSON.

Phase 6: Calendar UI
  → Time-grid calendar view (7-day or daily)
  → Render ScheduleBlocks as positioned elements
  → Mark block complete action
  → Add fixed event (click empty slot)
  Deliverable: visual schedule matches what's in the DB.

Phase 7: Preferences + User Rules
  → Preferences editor UI
  → UserRule CRUD UI
  → Wire preferences into scheduler
  Deliverable: user can tune the schedule and regenerate.

Phase 8: Unfocused Mode
  → Break insertion algorithm
  → Deadline coverage check after breaks inserted
  → Toggle in UI
  Deliverable: "I'm unfocused" button modifies today's blocks safely.

Phase 9: Historical Calibration
  → CompletionHistory recording when blocks completed with actual time
  → Calibration factor fed back into LLM estimation prompt
  → Display estimated vs actual in todo list
  Deliverable: estimates improve over time.
```

**Key dependency observations:**
- Phases 1 and 2 are pure backend; they block everything else
- Phase 3 (Todo List) can begin before estimation is complete — show "Estimating..." badge
- Phase 5 (Schedule Engine) requires Phase 4 (estimates must exist to schedule)
- Phase 6 (Calendar UI) requires Phase 5 (blocks must exist to render)
- Phases 7, 8, 9 are additive enhancements on top of a working core

---

## Scheduling Algorithm Detail

### Urgency Score

```
urgency_score = (days_until_due × -1)          // nearer deadline = higher score
              + (estimate_minutes / 60 × 0.5)  // longer tasks get slightly higher priority
              + (is_buffer_zone ? 10 : 0)       // bonus if within buffer window
```

Assignments are sorted descending by urgency score. Most urgent scheduled first.

### Available Slot Construction

```
For each day in [today, today + horizon_days]:
  slot_start = max(now, day + work_start_time)
  slot_end = day + work_end_time
  Remove FixedEvent intervals from the slot
  Remove already-completed ScheduleBlocks from the slot
  Remove buffer zone (buffer_before_deadline_hours before due_at)
  Split remaining time into session_length_minutes chunks with break gaps
  → emit list of (start, end, duration_available) tuples
```

### Deadline Safety Check

After each greedy assignment, verify:
```
remaining_assignments_total_minutes ≤ remaining_available_minutes_before_earliest_deadline
```
If this fails, surface a warning: "Assignment X cannot be scheduled before its deadline."

### Routing Preferences

Future extension: Assignments can have a `preferred_time_of_day: "morning" | "afternoon" | "evening" | null`. The slot finder skips slots outside the preferred window but falls back to any slot if no preferred slots are available before the deadline.

---

## Scalability Considerations

| Concern | At v1 (single user, ~50 active assignments) | At stretch (multi-user, ~500/user) |
|---------|---------------------------------------------|-------------------------------------|
| DB | SQLite, single file, WAL mode | Migrate to PostgreSQL (Turso/libsql for hosted SQLite as intermediate step) |
| LLM calls | Sequential background jobs, synchronous queue | Batch requests, parallel estimation |
| Schedule generation | < 100ms for greedy on 50 tasks | Still fast; only needs change if task count exceeds ~1000 |
| Canvas API rate limits | 3600 req/hour (Canvas default); fine for single user | Need per-user token management and rate limiting layer |
| Frontend state | TanStack Query cache + optimistic updates | Same — TanStack Query scales well |

---

## Sources

- Canvas LMS REST API documentation (canvas.instructure.com/doc/api) — HIGH confidence on API shape, endpoint paths, and rate limits (well-documented, stable API)
- TanStack Start and TanStack Query official docs — HIGH confidence on data loading patterns
- ElysiaJS documentation — HIGH confidence on plugin/context patterns for DB sharing
- Scheduling algorithm design (greedy vs CSP) — HIGH confidence; well-established CS domain knowledge
- LLM structured output patterns — HIGH confidence; standard practice in LLM application design
- SQLite WAL mode and connection management — HIGH confidence; SQLite official documentation
- **Note:** No live web research was available during this research session. All findings are from training data (cutoff August 2025). Canvas API structure, TanStack Start patterns, and ElysiaJS architecture are all stable and unlikely to have changed materially. Flag for validation: specific ElysiaJS plugin API for SQLite singleton injection.
