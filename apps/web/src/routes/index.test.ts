/**
 * Tests for todo list index page logic
 * - Form validation: title required, duration > 0, date overflow guard
 * - These are the pure behaviors that can be unit tested outside the React component
 */
import { describe, it, expect } from 'bun:test'
import { buildDueAt } from '../utils/groupAssignments'

// ---------------------------------------------------------------------------
// Validation logic matching ManualTaskCreationForm (Task 3)
// ---------------------------------------------------------------------------

function validateCreateForm(
  title: string,
  hours: string,
  minutes: string,
  day: string,
  month: string,
  year: string,
  dueHour?: string,
  dueMinute?: string,
): { titleError: string | null; durationError: string | null; dateError: string | null; dueAt: number | null } {
  let titleError: string | null = null
  let durationError: string | null = null
  let dateError: string | null = null
  let dueAt: number | null = null

  if (!title.trim()) {
    titleError = 'Name is required'
  }

  const h = Number(hours || '0')
  const m = Number(minutes || '0')
  const totalMin = h * 60 + m
  if (totalMin < 1) {
    durationError = 'Duration is required'
  }

  if (day || month || year) {
    const result = buildDueAt(day, month, year, dueHour || undefined, dueMinute || undefined)
    if (result !== null && typeof result === 'object' && 'error' in result) {
      dateError = result.error
    } else {
      dueAt = result as number | null
    }
  }

  return { titleError, durationError, dateError, dueAt }
}

describe('ManualTaskCreationForm validation', () => {
  it('requires title — empty title produces Name is required error', () => {
    const { titleError } = validateCreateForm('', '1', '0', '', '', '')
    expect(titleError).toBe('Name is required')
  })

  it('requires title — whitespace-only title produces Name is required error', () => {
    const { titleError } = validateCreateForm('   ', '1', '0', '', '', '')
    expect(titleError).toBe('Name is required')
  })

  it('requires duration > 0 — 0h 0m produces Duration is required error', () => {
    const { durationError } = validateCreateForm('Read ch 5', '0', '0', '', '', '')
    expect(durationError).toBe('Duration is required')
  })

  it('requires duration > 0 — empty hours/minutes (treated as 0) produces Duration is required error', () => {
    const { durationError } = validateCreateForm('Read ch 5', '', '', '', '', '')
    expect(durationError).toBe('Duration is required')
  })

  it('accepts 0 hours and 30 minutes as valid (30 min total > 0)', () => {
    const { durationError } = validateCreateForm('Read ch 5', '0', '30', '', '', '')
    expect(durationError).toBeNull()
  })

  it('valid form with no due date returns no errors and null dueAt', () => {
    const result = validateCreateForm('Read ch 5', '2', '30', '', '', '')
    expect(result.titleError).toBeNull()
    expect(result.durationError).toBeNull()
    expect(result.dateError).toBeNull()
    expect(result.dueAt).toBeNull()
  })

  it('valid form with a valid due date returns correct dueAt', () => {
    const result = validateCreateForm('Read ch 5', '2', '0', '15', '6', '2026')
    expect(result.dateError).toBeNull()
    expect(result.dueAt).toBeTypeOf('number')
    const date = new Date(result.dueAt!)
    expect(date.getDate()).toBe(15)
    expect(date.getMonth()).toBe(5) // June = 5
    expect(date.getFullYear()).toBe(2026)
    // No time given → defaults to 23:59
    expect(date.getHours()).toBe(23)
    expect(date.getMinutes()).toBe(59)
  })

  it('invalid date (April 31) produces date error', () => {
    const result = validateCreateForm('Read ch 5', '1', '0', '31', '4', '2026')
    expect(result.dateError).toBe('Invalid date — check day, month, and year')
  })

  it('partial date fields (day only) still try to build due date', () => {
    // day='15', month='', year='' → buildDueAt('15','','') → all empty check fails
    // since month and year are empty strings, they truthy-check as '' which is falsy
    // but 'day' is truthy → condition triggers
    const result = validateCreateForm('Read ch 5', '1', '0', '15', '', '')
    // buildDueAt('15', '', '') → d=15, m=NaN, y=NaN → NaN date → coherence check fails
    expect(result.dateError).toBeTruthy()
  })

  it('all three date fields present with explicit time returns correct timestamp', () => {
    const result = validateCreateForm('Task', '1', '0', '1', '1', '2027', '14', '30')
    expect(result.dateError).toBeNull()
    expect(result.dueAt).toBeTypeOf('number')
    const date = new Date(result.dueAt!)
    expect(date.getHours()).toBe(14)
    expect(date.getMinutes()).toBe(30)
  })
})

describe('estimatedMin computation', () => {
  it('converts hours and minutes to total minutes', () => {
    const h = 2
    const m = 30
    expect(h * 60 + m).toBe(150)
  })

  it('hours only — no minutes', () => {
    const h = 3
    const m = 0
    expect(h * 60 + m).toBe(180)
  })

  it('minutes only — no hours', () => {
    const h = 0
    const m = 45
    expect(h * 60 + m).toBe(45)
  })
})
