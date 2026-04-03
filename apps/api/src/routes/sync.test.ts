import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Elysia } from 'elysia'

// We import the route lazily to allow env manipulation before load
// For env-sensitive tests we rebuild the app after setting env vars

// Store original env values
const ORIG_TOKEN = process.env.CANVAS_API_TOKEN
const ORIG_URL = process.env.CANVAS_BASE_URL

afterEach(() => {
  // Restore env vars after each test
  if (ORIG_TOKEN !== undefined) {
    process.env.CANVAS_API_TOKEN = ORIG_TOKEN
  } else {
    delete process.env.CANVAS_API_TOKEN
  }
  if (ORIG_URL !== undefined) {
    process.env.CANVAS_BASE_URL = ORIG_URL
  } else {
    delete process.env.CANVAS_BASE_URL
  }
})

describe('POST /sync', () => {
  test('returns missing_credentials when CANVAS_API_TOKEN is absent', async () => {
    delete process.env.CANVAS_API_TOKEN
    process.env.CANVAS_BASE_URL = 'https://canvas.example.com'

    const { syncRoute } = await import('./sync')
    const app = new Elysia().use(syncRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/sync', { method: 'POST' })
    )
    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('missing_credentials')
  })

  test('returns missing_credentials when CANVAS_BASE_URL is absent', async () => {
    process.env.CANVAS_API_TOKEN = 'test-token'
    delete process.env.CANVAS_BASE_URL

    const { syncRoute } = await import('./sync')
    const app = new Elysia().use(syncRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/sync', { method: 'POST' })
    )
    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('missing_credentials')
  })

  test('returns canvas_unreachable when runSync throws', async () => {
    process.env.CANVAS_API_TOKEN = 'test-token'
    process.env.CANVAS_BASE_URL = 'https://canvas.example.com'

    // Mock fetch to simulate Canvas API failure
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error('Network error')
    }

    try {
      const { syncRoute } = await import('./sync')
      const app = new Elysia().use(syncRoute)

      const response = await app.handle(
        new Request('http://localhost:3001/sync', { method: 'POST' })
      )
      expect(response.status).toBe(200)
      const body = await response.json() as { ok: boolean; error?: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe('canvas_unreachable')
    } finally {
      global.fetch = origFetch
    }
  })
})

describe('GET /credentials-status', () => {
  test('returns { configured: true } when both env vars are set', async () => {
    process.env.CANVAS_API_TOKEN = 'test-token'
    process.env.CANVAS_BASE_URL = 'https://canvas.example.com'

    const { syncRoute } = await import('./sync')
    const app = new Elysia().use(syncRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/credentials-status')
    )
    expect(response.status).toBe(200)
    const body = await response.json() as { configured: boolean }
    expect(body.configured).toBe(true)
  })

  test('returns { configured: false } when env vars are missing', async () => {
    delete process.env.CANVAS_API_TOKEN
    delete process.env.CANVAS_BASE_URL

    const { syncRoute } = await import('./sync')
    const app = new Elysia().use(syncRoute)

    const response = await app.handle(
      new Request('http://localhost:3001/credentials-status')
    )
    expect(response.status).toBe(200)
    const body = await response.json() as { configured: boolean }
    expect(body.configured).toBe(false)
  })
})
