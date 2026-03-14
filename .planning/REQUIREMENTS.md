# Requirements: Atrium

**Defined:** 2026-03-13
**Core Value:** Canvas assignments automatically become a realistic, time-blocked schedule that adapts when you're off-track, so nothing falls through the cracks before the deadline.

## v1 Requirements

### Canvas Integration

- [ ] **CANV-01**: User can connect to Canvas by providing an API token and institution URL
- [ ] **CANV-02**: App reads all assignments across all active courses from Canvas, handling pagination correctly
- [ ] **CANV-03**: App reads assignment due dates with section override support (correct deadlines per student)
- [ ] **CANV-04**: App displays which assignments are new, updated, or unchanged since last sync
- [ ] **CANV-05**: User can trigger a manual Canvas sync at any time

### Todo List

- [ ] **TODO-01**: User can view all Canvas assignments as a todo list, grouped by course or due date
- [ ] **TODO-02**: User can mark assignments as complete from the todo list
- [ ] **TODO-03**: User can manually create tasks not from Canvas (with name, estimated duration, optional due date)
- [ ] **TODO-04**: User can edit or delete manually created tasks

### Time Estimation

- [ ] **EST-01**: App generates an initial time estimate for each assignment using LLM inference (based on assignment name, course, and description)
- [ ] **EST-02**: User can override the estimated duration for any assignment
- [ ] **EST-03**: App tracks actual time spent on assignments to calibrate future estimates (historical calibration)
- [ ] **EST-04**: App shows confidence level or reasoning for each estimate so user can judge quality

### Schedule Engine

- [ ] **SCHED-01**: App auto-generates a time-blocked schedule from all incomplete assignments, respecting due dates and user preferences
- [ ] **SCHED-02**: Schedule includes mandatory gaps and unscheduled slack (not perfectly packed) to be realistically usable
- [ ] **SCHED-03**: User can trigger schedule regeneration at any time
- [ ] **SCHED-04**: App warns user if deadlines cannot be met given available time and current schedule

### Fixed Time Blocking

- [ ] **BLOCK-01**: User can create fixed time blocks (classes, meetings, gym) that the scheduler works around
- [ ] **BLOCK-02**: Fixed blocks can be recurring (e.g., every Tuesday 10am–12pm)
- [ ] **BLOCK-03**: User can edit or delete fixed blocks

### Calendar UI

- [ ] **CAL-01**: User can view their schedule as a time-blocked calendar (day and week views)
- [ ] **CAL-02**: Calendar shows both fixed blocks and scheduled assignment work sessions
- [ ] **CAL-03**: User can drag and drop schedule blocks to manually adjust timing
- [ ] **CAL-04**: Clicking a block shows assignment details (name, course, due date, estimated time)

### Schedule Preferences

- [ ] **PREF-01**: User can set preferred work windows (e.g., only schedule work 9am–10pm)
- [ ] **PREF-02**: Schedule engine respects preferred work windows when generating blocks

## v2 Requirements

### Canvas Integration (Extended)

- **CANV-V2-01**: App reads Canvas submission status and marks submitted assignments complete automatically
- **CANV-V2-02**: App reads course syllabus and files to inform more accurate time estimates
- **CANV-V2-03**: App imports class meeting times from Canvas to auto-create fixed blocks

### Schedule Preferences (Extended)

- **PREF-V2-01**: User can set daily work hour limits (max study hours per day)
- **PREF-V2-02**: User can set a buffer-before-deadline rule (always finish X days early)
- **PREF-V2-03**: User can route certain assignment types to certain days of the week

### Unfocused Mode

- **FOCUS-V2-01**: User can activate unfocused mode, which inserts short breaks into remaining schedule while validating deadline coverage
- **FOCUS-V2-02**: App surfaces a warning if deadline coverage is at risk after adding breaks

### Estimation (Extended)

- **EST-V2-01**: User can define assignment-type rules (e.g., "essays always take 3 hours")
- **EST-V2-02**: Rules take precedence over LLM estimates when defined

### Optional / Stretch

- **STRETCH-01**: Major assignments can be broken into smaller sub-steps with individual estimates
- **STRETCH-02**: Graph view of related assignments (by topic, course, or semester)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user accounts / authentication | Single-user personal tool for v1; added later if needed |
| Mobile app | Web-first; mobile is a separate product decision |
| Real-time Canvas webhooks | Canvas doesn't offer user-facing webhooks; polling is the correct pattern |
| Calendar sync (Google Calendar, iCal export) | Adds integration complexity; out of scope for v1 |
| Collaboration / shared schedules | Single-user tool only |
| Notifications / reminders | Out of scope for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CANV-01 | — | Pending |
| CANV-02 | — | Pending |
| CANV-03 | — | Pending |
| CANV-04 | — | Pending |
| CANV-05 | — | Pending |
| TODO-01 | — | Pending |
| TODO-02 | — | Pending |
| TODO-03 | — | Pending |
| TODO-04 | — | Pending |
| EST-01 | — | Pending |
| EST-02 | — | Pending |
| EST-03 | — | Pending |
| EST-04 | — | Pending |
| SCHED-01 | — | Pending |
| SCHED-02 | — | Pending |
| SCHED-03 | — | Pending |
| SCHED-04 | — | Pending |
| BLOCK-01 | — | Pending |
| BLOCK-02 | — | Pending |
| BLOCK-03 | — | Pending |
| CAL-01 | — | Pending |
| CAL-02 | — | Pending |
| CAL-03 | — | Pending |
| CAL-04 | — | Pending |
| PREF-01 | — | Pending |
| PREF-02 | — | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 ⚠️

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after initial definition*
