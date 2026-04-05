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
  {
    id: 2,
    source: 'canvas',
    canvasId: 'canvas-456',
    title: 'Lab Report',
    courseId: '202',
    courseName: 'Biology 202',
    description: 'Write lab report',
    dueAt: 1776000000000,
    estimatedMin: null,
    completed: false,
    completedAt: null,
    createdAt: 1774000000000,
    updatedAt: 1774000000000,
    syncStatus: 'new',
  },
]

// Row returned by insert (manual)
const newManualRow = {
  id: 3,
  source: 'manual',
  canvasId: null,
  title: 'Read ch. 5',
  courseId: null,
  courseName: null,
  description: null,
  dueAt: 1775000000000,
  estimatedMin: 60,
  completed: false,
  completedAt: null,
  createdAt: 1775000000000,
  updatedAt: 1775000000000,
  syncStatus: null,
}

// Row for id=1 (manual, for source guard checks)
const manualRow = {
  id: 1,
  source: 'manual',
  canvasId: null,
  title: 'Read ch. 5',
  courseId: null,
  courseName: null,
  description: null,
  dueAt: 1775000000000,
  estimatedMin: 60,
  completed: false,
  completedAt: null,
  createdAt: 1774000000000,
  updatedAt: 1774000000000,
  syncStatus: null,
}

// Row for id=2 (canvas, for source guard checks)
const canvasRow = {
  id: 2,
  source: 'canvas',
  canvasId: 'canvas-456',
  title: 'Lab Report',
  courseId: '202',
  courseName: 'Biology 202',
  description: 'Write lab report',
  dueAt: 1776000000000,
  estimatedMin: null,
  completed: false,
  completedAt: null,
  createdAt: 1774000000000,
  updatedAt: 1774000000000,
  syncStatus: 'new',
}

// Track last where param to decide which row to return in source guard selects
let lastWhereId: number | null = null

mock.module('@atrium/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          // Return the appropriate row based on which id was used
          if (lastWhereId === 2) return Promise.resolve([canvasRow])
          if (lastWhereId === 1) return Promise.resolve([manualRow])
          return Promise.resolve([manualRow])
        },
        // For GET /assignments (no .where)
        then: (resolve: Function) => resolve(mockRows),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([newManualRow]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => {
            if (lastWhereId === 1) {
              return Promise.resolve([{ ...manualRow, completed: true, completedAt: Date.now(), updatedAt: Date.now() }])
            }
            return Promise.resolve([manualRow])
          },
        }),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  },
  schema: {
    assignments: {
      name: 'assignments',
      id: 'id',
      source: 'source',
    },
  },
}))

// Helper to set the active id for source-guard mocks
function setWhereId(id: number) {
  lastWhereId = id
}

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

describe('POST /assignments', () => {
  test('returns 201 with new manual row', async () => {
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Read ch. 5', estimatedMin: 60, dueAt: 1775000000000 }),
      })
    )
    expect(response.status).toBe(201)
    const body = await response.json() as Record<string, unknown>
    expect(typeof body.id).toBe('number')
    expect(body.source).toBe('manual')
    expect(body.title).toBe('Read ch. 5')
    expect(body.estimatedMin).toBe(60)
    expect(body.dueAt).toBe(1775000000000)
  })

  test('returns 422 when title is missing', async () => {
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedMin: 60, dueAt: 1775000000000 }),
      })
    )
    expect(response.status).toBe(422)
  })

  test('returns 422 when estimatedMin is 0', async () => {
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Read ch. 5', estimatedMin: 0, dueAt: 1775000000000 }),
      })
    )
    expect(response.status).toBe(422)
  })

  test('returns 201 with dueAt: null when dueAt is omitted', async () => {
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    // Mock insert for this case to return null dueAt
    const { db } = await import('@atrium/db') as any
    const origInsert = db.insert
    db.insert = () => ({
      values: () => ({
        returning: () => Promise.resolve([{ ...newManualRow, dueAt: null }]),
      }),
    })

    const response = await app.handle(
      new Request('http://localhost:3001/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Read ch. 5', estimatedMin: 60 }),
      })
    )
    expect(response.status).toBe(201)
    const body = await response.json() as Record<string, unknown>
    expect(body.dueAt).toBeNull()

    db.insert = origInsert
  })
})

describe('PATCH /assignments/:id/complete', () => {
  test('returns 200 with completed: true and completedAt set', async () => {
    setWhereId(1)
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    // Override update mock to return completed=true row
    const { db } = await import('@atrium/db') as any
    const origUpdate = db.update
    db.update = () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...manualRow, completed: true, completedAt: 1775000000000, updatedAt: Date.now() }]),
        }),
      }),
    })

    const response = await app.handle(
      new Request('http://localhost:3001/assignments/1/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body.completed).toBe(true)
    expect(typeof body.completedAt).toBe('number')

    db.update = origUpdate
  })

  test('returns 200 with completed: false and completedAt: null', async () => {
    setWhereId(1)
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const { db } = await import('@atrium/db') as any
    const origUpdate = db.update
    db.update = () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...manualRow, completed: false, completedAt: null, updatedAt: Date.now() }]),
        }),
      }),
    })

    const response = await app.handle(
      new Request('http://localhost:3001/assignments/1/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: false }),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body.completed).toBe(false)
    expect(body.completedAt).toBeNull()

    db.update = origUpdate
  })
})

describe('PATCH /assignments/:id', () => {
  test('returns 200 with updated fields for manual assignment', async () => {
    setWhereId(1)
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const { db } = await import('@atrium/db') as any
    const origUpdate = db.update
    db.update = () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...manualRow, title: 'Updated', estimatedMin: 90, dueAt: null, updatedAt: Date.now() }]),
        }),
      }),
    })

    const response = await app.handle(
      new Request('http://localhost:3001/assignments/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', estimatedMin: 90, dueAt: null }),
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body.title).toBe('Updated')
    expect(body.estimatedMin).toBe(90)
    expect(body.dueAt).toBeNull()

    db.update = origUpdate
  })

  test('returns 403 for canvas assignment', async () => {
    setWhereId(2)
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments/2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', estimatedMin: 90, dueAt: null }),
      })
    )
    expect(response.status).toBe(403)
    const body = await response.json() as Record<string, unknown>
    expect(body.error).toBe('cannot modify canvas assignments')
  })
})

describe('DELETE /assignments/:id', () => {
  test('returns 200 { ok: true } for manual assignment', async () => {
    setWhereId(1)
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments/1', {
        method: 'DELETE',
      })
    )
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(body.ok).toBe(true)
  })

  test('returns 403 for canvas assignment', async () => {
    setWhereId(2)
    const { assignmentsRoute } = await import('./assignments')
    const app = new Elysia().use(assignmentsRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/assignments/2', {
        method: 'DELETE',
      })
    )
    expect(response.status).toBe(403)
    const body = await response.json() as Record<string, unknown>
    expect(body.error).toBe('cannot modify canvas assignments')
  })
})
