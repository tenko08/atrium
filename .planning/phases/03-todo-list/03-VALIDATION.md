---
phase: 03
slug: todo-list
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test |
| **Config file** | none — uses bun's built-in test runner |
| **Quick run command** | `bun test apps/api/src/routes/assignments.test.ts` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test apps/api/src/routes/assignments.test.ts`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TODO-02,03,04 | unit | `bun test apps/api/src/routes/assignments.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | TODO-01 | unit | `bun test apps/web/src/utils/groupAssignments.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | TODO-01,02 | manual | browser verify | — | ⬜ pending |
| 03-03-01 | 03 | 3 | TODO-03 | manual | browser verify | — | ⬜ pending |
| 03-03-02 | 03 | 3 | TODO-04 | manual | browser verify | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/routes/assignments.test.ts` — extend with tests for POST, PATCH/:id, DELETE/:id, PATCH/:id/complete
- [ ] `apps/web/src/utils/groupAssignments.test.ts` — unit tests for grouping/sorting logic

*Existing test infrastructure (bun:test, mock.module) covers Phase 3 needs — no new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grouping toggle switches between course and due-date views | TODO-01 | Visual UI interaction | Open app, click toggle, verify sections change |
| Completed task moves to bottom with strikethrough | TODO-02 | Visual DOM ordering | Check a task, verify it moves below incomplete tasks |
| Manual task creation form submits and appears in list | TODO-03 | End-to-end form interaction | Fill inline form, click Add, verify task appears |
| Hover reveals edit/delete icons on manual tasks only | TODO-04 | Hover state verification | Hover Canvas task (no icons), hover manual task (icons appear) |
| Inline edit saves on Enter, cancels on Escape | TODO-04 | Keyboard interaction | Edit a task, press Enter, verify change; edit again, press Escape, verify revert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
