# Feature Landscape

**Domain:** Student productivity / AI scheduling app with Canvas LMS integration
**Researched:** 2026-03-13
**Confidence note:** Web search and fetch tools were unavailable. All findings are from training knowledge (cutoff August 2025) covering Reclaim.ai, Motion, Structured, Notion, and Canvas LMS. Confidence levels reflect this limitation.

---

## Table Stakes

Features users expect from any task + calendar productivity tool. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Calendar block view (Google Calendar-style) | Users expect time-blocked schedules to be visually represented as drag-resizable blocks on a day/week grid | Medium | Day and week views are the minimum; month view can come later |
| Todo / task list synchronized with calendar | Users need a list-mode fallback to see all tasks, not just what's on today's calendar | Low | Toggling between list and calendar is a standard pattern (Motion, Structured both do this) |
| Due date awareness on all tasks | Every task must carry a deadline that scheduling logic respects — missing this makes the tool useless | Low | Required for Canvas-imported and manually added tasks alike |
| Manual task creation | Users always have tasks outside Canvas (personal, other courses, internships) | Low | Without this, the tool only works for 60% of a student's actual workload |
| Fixed event blocking (classes, meetings) | Scheduling must treat recurring fixed events as hard unavailability windows | Medium | Users need to define classes once and have them excluded from schedule slots forever |
| Schedule preferences (work hours, day limits) | Users must define when they are available to work — no tool ships without this | Low | "Work 9am–10pm, max 6 hrs/day" type config. Required for any scheduling engine |
| Task completion marking | Users need to mark tasks done; completed tasks should leave the calendar | Low | Sounds trivial, actually core — without this the calendar fills with stale blocks |
| Assignment status sync from Canvas | If an assignment is submitted in Canvas, it should be auto-marked done in Atrium | Medium | Canvas submission status is exposed in the API. Not doing this means manual double-work for every submission |
| Persistent state between sessions | Schedule and task state must survive page refresh / app restart | Low | SQLite or similar; without this the app is a demo, not a tool |

---

## Differentiators

Features beyond baseline that create competitive advantage for Atrium specifically. These are not expected by default but are high-value when done well.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Canvas LMS auto-import (assignments + due dates) | Eliminates the #1 friction point — students manually entering every Canvas assignment into a separate tool. No competitor does this natively for Canvas. | High | Canvas REST API exposes assignments, due dates, submission status, and course files. Requires Canvas API token setup UX. |
| AI time estimation from assignment content | Time estimates informed by assignment name, description, course, and syllabus content are dramatically more accurate than generic "1hr default" patterns. LLM can infer "Research Paper" vs "Reading Quiz" vs "Lab Report" complexity. | High | Requires feeding Canvas assignment data + course syllabus files into LLM context. Three-layer system (LLM + rules + history) is the right approach. |
| User-defined estimation rules ("lab reports always take 3hrs") | Power users want to override AI guesses with hard rules by assignment type or course. This builds trust in the tool over time. | Low-Medium | Simple rule engine: match by course, assignment type keyword, or regex. Stored in user preferences. |
| Historical time tracking (actual vs estimated) | After a few weeks of use, the tool learns how long this user actually takes on things. Estimates get calibrated to the user over time. | Medium | Requires start/stop tracking per task block. Timer in focus mode is the natural capture point. |
| Unfocused mode (break insertion + deadline-safe rescheduling) | Real students have bad days. Instead of the schedule becoming useless when you skip a block, Unfocused mode inserts recovery time and recalculates to show what's still achievable without missing deadlines. Competitors (Reclaim, Motion) do reschedule on conflict but don't have a named "I'm struggling today" mode. | High | Core algorithm: insert breaks, compress remaining blocks, validate deadline coverage, surface any deadline risks. |
| Real-time schedule adaptation (missed block reschedule) | When a scheduled block passes without completion, the system should offer to reschedule it automatically rather than quietly leaving it behind. | Medium | Trigger on block end without completion event. Offer "reschedule now" with one click. |
| Syllabus-informed estimates | Reading the syllabus PDF or course overview to understand workload expectations for a course makes estimates more contextually accurate. | High | Canvas API exposes course files. PDFs need text extraction. Feed to LLM with prompt for estimate calibration. |
| Assignment-type routing by day ("no coding on Fridays") | Students often want to protect certain days for certain types of work (e.g., hard thinking on Monday/Tuesday, light reading on Friday). This is a preferences-level feature Motion lacks. | Medium | Stored routing rules applied during schedule generation. "Assignment tagged as [type] → prefer [days]" |
| Buffer time before deadlines | Automatically inserting a buffer (e.g., 2 hours before due date) so last-minute completion doesn't feel like a true emergency. Configurable. | Low-Medium | A schedule preference: "always finish assignments N hours before deadline." Applied during slot allocation. |

---

## Anti-Features

Features to deliberately NOT build for v1, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-user auth / accounts | Adds 1–2 phases of auth infrastructure (JWT, sessions, user tables) before any core value is delivered. The entire v1 value prop is personal scheduling. | Single-user, no auth. Canvas token stored locally in config or env. Revisit auth only if deploying to others. |
| Mobile app (iOS/Android) | Doubles the surface area. React Native or Expo adds meaningful complexity for a tool that students primarily use while at a computer. | Web-first. Mobile-responsive web is fine as a stepping stone. |
| Collaboration / shared schedules | Not a team tool. Adding sharing creates access control, merge conflict, and social feature complexity. | Out of scope until explicitly validated. |
| Breaking assignments into sub-steps automatically | Decomposing "Write 10-page paper" into [Outline, Draft, Edit, Final] sounds useful but requires much more sophisticated LLM prompting, sub-task tracking, and scheduling logic. | Defer. Manual sub-task creation can be added later if needed. |
| Grade tracking / GPA calculator | Adjacent to the problem space but not core. Distracts from scheduling focus. | Canvas exposes grade data — could read it later for context, but not surface it as a feature. |
| Social / habit streaks / gamification | Productivity apps that add streaks and badges often become toys rather than tools. | Keep the UX calm and utilitarian. Focus data (actual vs estimated time) is sufficient reward signal. |
| In-app note-taking (Notion-style) | Feature creep. Students already have Notion/Obsidian. Adding notes means competing with entrenched tools on a non-differentiating dimension. | Deep-link to Canvas for assignment context. Let note-taking happen in existing tools. |
| Pomodoro timer (built-in) | Overcomplicates focus mode. Students who want Pomodoro use Forest or Flow. | Unfocused mode handles break scheduling at the schedule level, which is more valuable than a per-session timer. |
| Calendar sync (Google Calendar export) | Bidirectional sync with Google Calendar is technically complex (webhook subscriptions, conflict resolution, duplicate detection). | Atrium IS the calendar. The block view is the primary interface. Export can be added later if users request it. |
| Natural language task creation ("add reading due Thursday") | NLP parsing adds LLM latency on a basic CRUD action. Structured form inputs are faster and more reliable for task creation. | Use structured form with smart defaults. NLP input is a nice-to-have, not a v1 requirement. |

---

## Feature Dependencies

```
Canvas API token setup
  → Canvas assignment import
    → AI time estimation (needs assignment data)
      → Syllabus-informed estimates (needs course files from Canvas)
        → User rules override (layered on top of AI estimate)
          → Historical calibration (layered on top of rules)

Schedule preferences (work hours, day limits, buffer)
  → Schedule generation engine
    → Calendar block view (renders output of engine)
      → Fixed event blocking (feeds into engine as constraints)
        → Manual task creation (additional inputs to engine)
          → Unfocused mode (modifies engine output in real-time)
            → Real-time adaptation on missed blocks

Todo list view
  → Canvas sync status display
    → Completion marking
      → Canvas submission status auto-sync (marks done from Canvas side)

Time tracking (start/stop per block)
  → Historical actual vs estimated data
    → Calibrated AI estimates over time
```

---

## MVP Recommendation

Prioritize for a first usable version:

1. **Canvas assignment import** — the core differentiator that makes Atrium worth using at all. Without it, it's just another task manager.
2. **AI time estimation** — makes the import meaningful; raw Canvas data without estimates can't generate a schedule.
3. **Schedule generation engine** — the core algorithm: take tasks + estimates + availability windows + preferences → produce time-blocked schedule.
4. **Calendar block view** — the primary interface for the output; this is what users interact with daily.
5. **Todo list view with Canvas sync status** — secondary view, but required for overview and completion tracking.
6. **Fixed event blocking** — students need to enter their class schedule; without this the generated schedule will conflict with real life immediately.
7. **Unfocused mode** — genuine differentiator that solves the "what happens when I fall behind" problem competitors don't address well.

Defer to later phases:
- **Historical time tracking**: Requires sufficient usage data to be meaningful. Build the capture mechanism (start/stop timer) in MVP but don't surface insights until there's data.
- **Syllabus-informed estimates**: High complexity (PDF extraction, prompt engineering). Start with LLM inference from assignment name/description only. Add syllabus context in a later phase.
- **Assignment-type routing by day**: Nice preference option but not blocking anything. Add in preferences expansion phase.
- **Real-time missed-block adaptation**: Valuable but can ship as manual reschedule first; auto-trigger is a follow-on.

---

## Canvas LMS Integration Patterns

### What the Canvas REST API Exposes (HIGH confidence — Canvas LMS API is stable and well-documented)

- `GET /api/v1/courses` — all enrolled courses with names and course IDs
- `GET /api/v1/courses/:id/assignments` — assignments with name, description, due_at, points_possible, submission_types
- `GET /api/v1/courses/:id/assignments/:id/submissions/self` — submission status for the current user (submitted, graded, missing)
- `GET /api/v1/courses/:id/files` — course files (syllabus PDFs, course materials)
- `GET /api/v1/users/self/upcoming_events` — upcoming events and due dates across all courses
- `GET /api/v1/users/self/todo` — Canvas's own todo items (assignments not yet submitted)

### Authentication Pattern

Canvas uses Bearer token auth (API access token generated in Canvas user settings). For a single-user personal tool, the token can be stored in `.env` or a local config file — no OAuth flow needed.

### Polling vs Webhooks

Canvas does not offer webhooks for the public REST API. Polling on a schedule (e.g., every 30 minutes or on app load) is the standard approach for Canvas integrations. This is fine for a personal tool.

### Submission Status as Completion Signal

`submission.workflow_state` values: `unsubmitted`, `submitted`, `graded`, `pending_review`. When `submitted` or `graded`, the assignment can be auto-marked complete in Atrium.

---

## Schedule Generation UX Patterns

### Time Blocking Model (MEDIUM confidence — synthesized from Motion, Reclaim.ai patterns)

The canonical model used by AI scheduling tools:

1. User defines availability windows (e.g., Mon-Fri 9am-10pm)
2. Fixed events (classes, meetings) are blocked first as hard constraints
3. Remaining availability is divided into schedulable slots
4. Tasks are assigned to slots respecting: deadline proximity (earlier deadlines first), assignment type preferences, daily work hour caps, buffer-before-deadline rules
5. The schedule is regenerated whenever inputs change (new task added, task completed, preferences updated)

### Regeneration vs Editing Tension

A key UX decision: should the schedule be fully auto-generated (and regenerated on any change), or should users be able to drag blocks manually? Recommendation for Atrium: **auto-generate as default, allow manual overrides that pin blocks** so they survive regeneration. This is how Motion handles it — pinned tasks stay put, unpinned tasks get shuffled to fill gaps.

### Focus vs Unfocused Mode Pattern

- **Focused mode (default)**: Schedule is tightly packed, optimized for deadline coverage and work hour limits. Normal operating mode.
- **Unfocused mode**: Triggered manually by user ("I'm having a rough day"). Inserts configurable break intervals (e.g., 25 min work / 10 min break), compresses remaining blocks proportionally, re-validates that all deadlines are still coverable. Surfaces a warning if some deadlines are now at risk. This is meaningfully different from "reschedule tomorrow" — it keeps the user working, just more gently.

---

## Time Estimation Approaches

### Three-Layer System (HIGH confidence — matches project spec)

| Layer | Mechanism | Accuracy | Build Order |
|-------|-----------|----------|-------------|
| LLM inference | Assignment name + description + course name fed to LLM → estimate in minutes | Medium | Phase 1 |
| User-defined rules | "Lab reports: 180 min", "Weekly readings: 45 min" — keyword/type matching | High for covered cases | Phase 2 |
| Historical calibration | Actual completion time tracked per assignment → adjust future estimates of same type | Highest over time | Phase 3 |

### LLM Prompting for Estimation

The prompt should include: assignment name, description, course name, point value (as a proxy for weight), submission type (essay, quiz, file upload), and ideally relevant syllabus text. The LLM should return a structured estimate (e.g., JSON with `min_minutes`, `likely_minutes`, `max_minutes`) rather than prose.

### Confidence Display

Users should see that an estimate came from LLM inference vs their own rule vs historical data. This builds trust and surfaces where the system needs tuning. A simple badge ("AI estimate" vs "Your rule" vs "Based on history") is sufficient.

---

## Sources

**Note:** Web search and WebFetch were unavailable during this research session. All findings are from training knowledge (cutoff August 2025).

- Canvas LMS REST API documentation (canvas.instructure.com/doc/api) — HIGH confidence, stable and well-documented API
- Reclaim.ai feature set (reclaim.ai) — MEDIUM confidence, training data through mid-2025
- Motion (usemotion.com) — MEDIUM confidence, training data through mid-2025
- Structured (structuredapp.com) — MEDIUM confidence, training data through mid-2025
- Notion (notion.so) — HIGH confidence for general patterns, not scheduling-specific
- General scheduling algorithm patterns — HIGH confidence, well-established in literature
