---
status: partial
phase: 02-canvas-sync
source: [02-VERIFICATION.md]
started: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Auto-sync on page load renders real Canvas assignments
expected: Page loads and immediately shows Canvas assignments without user interaction
result: [pending]

### 2. Sync Now button shows spinner during in-flight request
expected: Button shows spinner and "Syncing..." text while request is in progress
result: [pending]

### 3. Last synced timestamp appears after successful sync
expected: "Last synced X ago" text appears below Sync Now button after sync completes
result: [pending]

### 4. Red error text on sync failure (invalid CANVAS_BASE_URL)
expected: Red error message appears near Sync Now button when Canvas is unreachable
result: [pending]

### 5. MissingCredentials blocks entire page when CANVAS_API_TOKEN is absent
expected: Full-page blocking screen shows exact env var names when token is missing
result: [pending]

### 6. Orange dot appears on re-synced assignments that changed on Canvas
expected: Assignments that changed since last sync show an orange dot
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
