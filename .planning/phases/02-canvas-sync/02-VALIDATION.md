---
phase: 2
slug: canvas-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (or "none — Wave 0 installs") |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CANV-01 | unit | `bun test --run canvas-auth` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CANV-02 | unit | `bun test --run canvas-pagination` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | CANV-03 | unit | `bun test --run canvas-section-overrides` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CANV-04 | unit | `bun test --run sync-status` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CANV-04 | integration | `bun test --run sync-upsert` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | CANV-05 | e2e | `bun test --run sync-ui` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/__tests__/canvas-auth.test.ts` — stubs for CANV-01 (token validation, institution URL)
- [ ] `packages/api/src/__tests__/canvas-pagination.test.ts` — stubs for CANV-02 (Link header following, per_page=100)
- [ ] `packages/api/src/__tests__/canvas-section-overrides.test.ts` — stubs for CANV-03 (section due date resolution)
- [ ] `packages/api/src/__tests__/sync-status.test.ts` — stubs for CANV-04 (new/updated/unchanged detection)
- [ ] `packages/api/src/__tests__/sync-upsert.test.ts` — stubs for CANV-04 (DB upsert with conflict resolution)
- [ ] `packages/db/src/__tests__/schema-migration.test.ts` — verify syncStatus column and canvas_id unique index

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sync Now button triggers live Canvas fetch | CANV-05 | Requires live Canvas account with valid token | Enter real token, click Sync Now, verify assignments appear |
| Section-level due dates display correctly | CANV-03 | Requires real course enrollment data with overrides | Compare displayed due dates vs Canvas calendar for section-specific deadlines |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
