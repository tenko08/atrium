# Atrium

## What This Is

Atrium is a personal productivity and scheduling app for students. It reads assignments directly from Canvas LMS, uses AI to estimate how long each task will take, and automatically generates a time-blocked daily schedule. When life gets in the way — a missed block, a moment of low focus — it adapts the schedule in real time to keep you on track without last-minute panic.

## Core Value

Canvas assignments automatically become a realistic, time-blocked schedule that adapts when you're off-track, so nothing falls through the cracks before the deadline.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Read assignments, due dates, and submission status from Canvas LMS
- [ ] Read Canvas course materials (syllabi, files) to inform time estimates
- [ ] Auto-generate a time-blocked daily schedule from Canvas assignments
- [ ] Display schedule as a calendar block view (Google Calendar-style)
- [ ] Manually add tasks and events to the schedule
- [ ] Manually block fixed time commitments (classes, meetings)
- [ ] Estimate task duration using AI inference, user-defined rules, and historical data
- [ ] Todo list view of all assignments with Canvas sync status
- [ ] Schedule preferences: daily work hour limits, preferred work windows, buffer before due dates, assignment-type routing by day
- [ ] Unfocused mode: insert breaks and adapt schedule while preserving deadline coverage

### Out of Scope

- Multi-user accounts / authentication — single user personal tool for v1, accounts later if needed
- Graph visualizer of related assignments — optional stretch feature
- Breaking major assignments into sub-steps — optional stretch feature
- Mobile app — web-first

## Context

- Student productivity tool, personal use only for v1
- Canvas LMS has a REST API that exposes assignments, due dates, submission status, and course files — integration is via Canvas API token
- Time estimation should combine: LLM inference (from assignment name, course, description, syllabus content), user-defined rules (e.g., "lab reports always take 3hrs"), and historical tracking (actual vs estimated time)
- Unfocused mode should insert short breaks into remaining schedule blocks but recalculate to ensure deadlines are still met — not just defer everything
- Tech stack chosen: TanStack Start (frontend) + ElysiaJS (backend)

## Constraints

- **Tech Stack**: TanStack Start + ElysiaJS — chosen, not up for debate
- **Scope**: Single user, no auth for v1 — keep it simple and fast to build
- **Phase Size**: Very small phases, at most one major feature per phase — user preference for development approach

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TanStack Start + ElysiaJS | User's chosen stack | — Pending |
| Single user, no auth for v1 | Focus on features first, accounts later | — Pending |
| Calendar block view (not task list) | User wants Google Calendar-style visualization | — Pending |
| AI + rules + history for time estimation | Richer estimates than any single method alone | — Pending |
| Canvas as primary assignment source | User's institution uses Canvas | — Pending |

---
*Last updated: 2026-03-13 after initialization*
