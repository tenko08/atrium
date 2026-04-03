import { describe, test, expect } from 'bun:test'
import { Elysia } from 'elysia'

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

    // Each item (if any) should have the expected DB fields
    if (body.length > 0) {
      const item = body[0]
      expect(typeof item.id).toBe('number')
      expect(typeof item.title).toBe('string')
      expect(typeof item.source).toBe('string')
    }
    // Empty array is valid — no assignments synced yet
    expect(Array.isArray(body)).toBe(true)
  })
})
