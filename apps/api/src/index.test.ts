import { describe, test, expect } from 'bun:test'
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { healthRoute } from './routes/health'

// Build app without .listen() for unit testing
const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .use(healthRoute)

describe('GET /health', () => {
  test('returns 200', async () => {
    const response = await app.handle(new Request('http://localhost:3001/health'))
    expect(response.status).toBe(200)
  })

  test('returns { status: "ok", timestamp: number }', async () => {
    const response = await app.handle(new Request('http://localhost:3001/health'))
    const body = await response.json() as { status: string; timestamp: number }
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('number')
    expect(body.timestamp).toBeGreaterThan(0)
  })

  test('includes CORS header for localhost:3000', async () => {
    const response = await app.handle(
      new Request('http://localhost:3001/health', {
        headers: { Origin: 'http://localhost:3000' },
      })
    )
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
  })
})
