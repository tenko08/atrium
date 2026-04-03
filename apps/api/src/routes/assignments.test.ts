import { describe, test, expect, mock, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'

// Mock @atrium/db before importing the route to avoid real DB access in unit tests
const mockRows = [
  {
    id: 1,
    source: 'canvas',
    canvasId: 'canvas-123',
    title: 'Midterm Essay',
    courseId: '101',
    courseName: 'English 101',
    description: 'Write a 5-page essay',
    dueAt: 1775000000000,
    estimatedMin: null,
    completed: false,
    completedAt: null,
    createdAt: 1774000000000,
    updatedAt: 1774000000000,
    syncStatus: 'new',
  },
]

mock.module('@atrium/db', () => ({
  db: {
    select: () => ({
      from: () => Promise.resolve(mockRows),
    }),
  },
  schema: {
    assignments: { name: 'assignments' },
  },
}))

describe('GET /assignments', () => {
  test('returns 200 with an array', async () => {
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments')
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('returns assignments with expected fields', async () => {
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments')
    )
    const body = await response.json() as Array<Record<string, unknown>>

    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)

    const item = body[0]
    expect(typeof item.id).toBe('number')
    expect(typeof item.title).toBe('string')
    expect(typeof item.source).toBe('string')
    expect(item.syncStatus).toBeDefined()
  })
})
