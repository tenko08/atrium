import { describe, test, expect, mock, beforeEach } from 'bun:test'
import {
  extractNextLink,
  resolveDueAt,
  computeSyncStatus,
} from './canvasService'

describe('extractNextLink', () => {
  test('returns URL when Link header contains rel="next"', () => {
    const header = '<https://school.instructure.com/api/v1/courses?page=2>; rel="next", <https://school.instructure.com/api/v1/courses?page=5>; rel="last"'
    expect(extractNextLink(header)).toBe('https://school.instructure.com/api/v1/courses?page=2')
  })

  test('returns null when Link header has no rel="next"', () => {
    const header = '<https://school.instructure.com/api/v1/courses?page=5>; rel="last"'
    expect(extractNextLink(header)).toBeNull()
  })

  test('returns null when Link header is null', () => {
    expect(extractNextLink(null)).toBeNull()
  })

  test('handles single-relation Link header with rel="next"', () => {
    const header = '<https://school.instructure.com/api/v1/courses?page=3>; rel="next"'
    expect(extractNextLink(header)).toBe('https://school.instructure.com/api/v1/courses?page=3')
  })

  test('handles multi-rel header where next appears after other rels', () => {
    const header = '<https://school.instructure.com/api/v1/courses?page=1>; rel="first", <https://school.instructure.com/api/v1/courses?page=4>; rel="next", <https://school.instructure.com/api/v1/courses?page=5>; rel="last"'
    expect(extractNextLink(header)).toBe('https://school.instructure.com/api/v1/courses?page=4')
  })
})

describe('resolveDueAt', () => {
  test('returns override due_at when assignment has override matching user section', () => {
    const assignment = {
      id: 1,
      name: 'Assignment 1',
      course_id: 100,
      description: null,
      due_at: '2026-04-10T23:59:00Z',
      overrides: [
        { id: 10, course_section_id: 42, due_at: '2026-04-15T23:59:00Z' },
        { id: 11, course_section_id: 99, due_at: '2026-04-20T23:59:00Z' },
      ],
    }
    const userSectionIds = new Set(['42', '50'])
    expect(resolveDueAt(assignment, userSectionIds)).toBe('2026-04-15T23:59:00Z')
  })

  test('returns default due_at when no matching override exists', () => {
    const assignment = {
      id: 1,
      name: 'Assignment 1',
      course_id: 100,
      description: null,
      due_at: '2026-04-10T23:59:00Z',
      overrides: [
        { id: 10, course_section_id: 99, due_at: '2026-04-20T23:59:00Z' },
      ],
    }
    const userSectionIds = new Set(['42'])
    expect(resolveDueAt(assignment, userSectionIds)).toBe('2026-04-10T23:59:00Z')
  })

  test('returns null when assignment has no due_at and no matching override', () => {
    const assignment = {
      id: 1,
      name: 'Assignment 1',
      course_id: 100,
      description: null,
      due_at: null,
      overrides: [],
    }
    const userSectionIds = new Set(['42'])
    expect(resolveDueAt(assignment, userSectionIds)).toBeNull()
  })

  test('returns null when assignment has no overrides and no due_at', () => {
    const assignment = {
      id: 2,
      name: 'Assignment 2',
      course_id: 100,
      description: null,
      due_at: null,
    }
    const userSectionIds = new Set(['42'])
    expect(resolveDueAt(assignment, userSectionIds)).toBeNull()
  })
})

describe('computeSyncStatus', () => {
  const existingMap = new Map([
    ['canvas-123', { title: 'Old Title', dueAt: 1700000000000 }],
    ['canvas-456', { title: 'Same Title', dueAt: 1700000000000 }],
  ])

  test('returns "new" when canvasId is not in existingMap', () => {
    expect(computeSyncStatus('canvas-999', 'New Assignment', null, existingMap)).toBe('new')
  })

  test('returns "updated" when title differs from stored value', () => {
    expect(computeSyncStatus('canvas-123', 'New Title', 1700000000000, existingMap)).toBe('updated')
  })

  test('returns "updated" when dueAt differs from stored value', () => {
    expect(computeSyncStatus('canvas-456', 'Same Title', 1700000001000, existingMap)).toBe('updated')
  })

  test('returns "unchanged" when title and dueAt are identical to stored values', () => {
    expect(computeSyncStatus('canvas-456', 'Same Title', 1700000000000, existingMap)).toBe('unchanged')
  })

  test('returns "unchanged" when both title and dueAt match (null dueAt)', () => {
    const mapWithNull = new Map([
      ['canvas-789', { title: 'No Due Date', dueAt: null }],
    ])
    expect(computeSyncStatus('canvas-789', 'No Due Date', null, mapWithNull)).toBe('unchanged')
  })
})

describe('canvasFetchAll pagination integration', () => {
  test('follows rel="next" links across multiple pages and collects all results', async () => {
    // Mock fetch to simulate 2-page Canvas response
    const page1 = [{ id: 1, name: 'Course A', course_id: 1 }]
    const page2 = [{ id: 2, name: 'Course B', course_id: 1 }]

    let callCount = 0
    const originalFetch = globalThis.fetch

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify(page1), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Link': '<https://school.instructure.com/api/v1/courses?page=2>; rel="next"',
          },
        })
      } else {
        return new Response(JSON.stringify(page2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
    }) as typeof fetch

    // Import canvasFetchAll for testing (it's exported for test access)
    const { canvasFetchAll } = await import('./canvasService')

    // Set env vars for the test
    process.env.CANVAS_BASE_URL = 'https://school.instructure.com'
    process.env.CANVAS_API_TOKEN = 'test-token'

    const results = await canvasFetchAll('/courses?per_page=100')

    expect(callCount).toBe(2)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual(page1[0])
    expect(results[1]).toEqual(page2[0])

    globalThis.fetch = originalFetch
  })
})
