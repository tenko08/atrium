---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in — `bun:test`) |
| **Config file** | None required — Bun auto-discovers `*.test.ts` files |
| **Quick run command** | `bun test --filter health` |
| **Full suite command** | `bun test` (from workspace root) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test --filter health`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | SC-2 (tables + WAL) | integration | `bun test packages/db/src/schema.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | SC-1 (bun dev) | smoke | `bun test apps/api/src/index.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 2 | SC-3 (Eden Treaty) | integration | `bun test apps/web/src/api.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | SC-4 (token exposure) | manual | Manual bundle inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/src/schema.test.ts` — verifies all 6 tables exist, WAL mode enabled, FK enforcement
- [ ] `apps/api/src/index.test.ts` — verifies Elysia starts, `/health` returns 200
- [ ] `apps/web/src/api.test.ts` — verifies Eden Treaty client reaches live API (requires API running)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas API token not in browser bundle | SC-4 | String presence in bundle output can't be asserted via bun test alone | Run `bun build apps/web` and grep output for `CANVAS_API_TOKEN` — must not appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
