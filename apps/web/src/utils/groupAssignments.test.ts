import { describe, test, expect } from 'bun:test'
import {
  groupByCourse,
  groupByDueDate,
  sortGroup,
  buildDueAt,
  type Assignment,
} from './groupAssignments'

// Helper to build a minimal Assignment
function makeAssignment(overrides: Partial<Assignment> & { id: number; title: string }): Assignment {
  return {
    courseName: null,
    dueAt: null,
    completed: false,
    source: 'canvas',
    syncStatus: null,
    estimatedMin: null,
    ...overrides,
  }
}

// ------------------------------------------------------------------
// groupByCourse
// ------------------------------------------------------------------
describe('groupByCourse', () => {
  test('two Canvas assignments with same courseName → one group', () => {
    const a1 = makeAssignment({ id: 1, title: 'Essay', courseName: 'English 101' })
    const a2 = makeAssignment({ id: 2, title: 'Reading', courseName: 'English 101' })
    const groups = groupByCourse([a1, a2])
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('English 101')
    expect(groups[0].items).toHaveLength(2)
  })

  test('one Canvas + one manual → Canvas group first, Manual last', () => {
    const canvas = makeAssignment({ id: 1, title: 'Essay', courseName: 'English 101' })
    const manual = makeAssignment({ id: 2, title: 'Buy groceries', source: 'manual' })
    const groups = groupByCourse([canvas, manual])
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('English 101')
    expect(groups[1].label).toBe('Manual')
  })

  test('manual task with no courseName → appears in Manual group (not null-label group)', () => {
    const manual = makeAssignment({ id: 1, title: 'Buy groceries', source: 'manual', courseName: null })
    const groups = groupByCourse([manual])
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Manual')
    expect(groups[0].items[0].id).toBe(1)
  })

  test('empty array → returns []', () => {
    expect(groupByCourse([])).toEqual([])
  })
})

// ------------------------------------------------------------------
// groupByDueDate
// ------------------------------------------------------------------
describe('groupByDueDate', () => {
  test('assignment with dueAt in the past → Due today bucket', () => {
    // Yesterday = clearly in the past, still <= todayEnd
    const yesterday = Date.now() - 24 * 60 * 60 * 1000
    const a = makeAssignment({ id: 1, title: 'Past', dueAt: yesterday })
    const groups = groupByDueDate([a])
    const todayGroup = groups.find(g => g.label === 'Due today')
    expect(todayGroup).toBeDefined()
    expect(todayGroup!.items[0].id).toBe(1)
  })

  test('assignment with dueAt 3 days from now → Due this week bucket', () => {
    const threeDays = Date.now() + 3 * 24 * 60 * 60 * 1000
    const a = makeAssignment({ id: 2, title: 'Soon', dueAt: threeDays })
    const groups = groupByDueDate([a])
    const weekGroup = groups.find(g => g.label === 'Due this week')
    expect(weekGroup).toBeDefined()
    expect(weekGroup!.items[0].id).toBe(2)
  })

  test('assignment with dueAt 10 days from now → Due later bucket', () => {
    const tenDays = Date.now() + 10 * 24 * 60 * 60 * 1000
    const a = makeAssignment({ id: 3, title: 'Later', dueAt: tenDays })
    const groups = groupByDueDate([a])
    const laterGroup = groups.find(g => g.label === 'Due later')
    expect(laterGroup).toBeDefined()
    expect(laterGroup!.items[0].id).toBe(3)
  })

  test('assignment with dueAt=null → No due date bucket', () => {
    const a = makeAssignment({ id: 4, title: 'No date', dueAt: null })
    const groups = groupByDueDate([a])
    const noDueGroup = groups.find(g => g.label === 'No due date')
    expect(noDueGroup).toBeDefined()
    expect(noDueGroup!.items[0].id).toBe(4)
  })

  test('empty buckets are omitted from result', () => {
    const a = makeAssignment({ id: 5, title: 'Only one', dueAt: null })
    const groups = groupByDueDate([a])
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('No due date')
  })
})

// ------------------------------------------------------------------
// sortGroup
// ------------------------------------------------------------------
describe('sortGroup', () => {
  test('incomplete tasks come before completed tasks', () => {
    const done = makeAssignment({ id: 1, title: 'Done', completed: true, dueAt: 1000 })
    const pending = makeAssignment({ id: 2, title: 'Pending', completed: false, dueAt: 2000 })
    const sorted = sortGroup([done, pending])
    expect(sorted[0].id).toBe(2)
    expect(sorted[1].id).toBe(1)
  })

  test('within incomplete group, sorted by dueAt ascending', () => {
    const later = makeAssignment({ id: 1, title: 'Later', completed: false, dueAt: 3000 })
    const sooner = makeAssignment({ id: 2, title: 'Sooner', completed: false, dueAt: 1000 })
    const sorted = sortGroup([later, sooner])
    expect(sorted[0].id).toBe(2)
    expect(sorted[1].id).toBe(1)
  })

  test('item with dueAt=null sorts after items with due dates', () => {
    const withDate = makeAssignment({ id: 1, title: 'Has date', completed: false, dueAt: 5000 })
    const noDate = makeAssignment({ id: 2, title: 'No date', completed: false, dueAt: null })
    const sorted = sortGroup([noDate, withDate])
    expect(sorted[0].id).toBe(1)
    expect(sorted[1].id).toBe(2)
  })

  test('completed items are sorted among themselves by dueAt asc', () => {
    const completedLater = makeAssignment({ id: 1, title: 'C later', completed: true, dueAt: 9000 })
    const completedSooner = makeAssignment({ id: 2, title: 'C sooner', completed: true, dueAt: 1000 })
    const sorted = sortGroup([completedLater, completedSooner])
    expect(sorted[0].id).toBe(2)
    expect(sorted[1].id).toBe(1)
  })
})

// ------------------------------------------------------------------
// buildDueAt
// ------------------------------------------------------------------
describe('buildDueAt', () => {
  test('buildDueAt with day/month/year only → defaults to 23:59 local time', () => {
    const result = buildDueAt('10', '4', '2026')
    expect(typeof result).toBe('number')
    const date = new Date(result as number)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(3) // April = month index 3
    expect(date.getDate()).toBe(10)
    expect(date.getHours()).toBe(23)
    expect(date.getMinutes()).toBe(59)
  })

  test('buildDueAt with explicit hour and minute', () => {
    const result = buildDueAt('10', '4', '2026', '14', '30')
    expect(typeof result).toBe('number')
    const date = new Date(result as number)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(3)
    expect(date.getDate()).toBe(10)
    expect(date.getHours()).toBe(14)
    expect(date.getMinutes()).toBe(30)
  })

  test('buildDueAt with empty strings → null', () => {
    expect(buildDueAt('', '', '')).toBeNull()
  })

  test('buildDueAt April 31 → error (T-05 overflow guard)', () => {
    const result = buildDueAt('31', '4', '2026')
    expect(result).toEqual({ error: 'Invalid date — check day, month, and year' })
  })

  test('buildDueAt Feb 29 in non-leap year 2025 → error', () => {
    const result = buildDueAt('29', '2', '2025')
    expect(result).toEqual({ error: 'Invalid date — check day, month, and year' })
  })
})
