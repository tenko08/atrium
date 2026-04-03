import { Elysia } from 'elysia'
import { runSync } from '../services/canvasService'

export const syncRoute = new Elysia()
  .post('/sync', async () => {
    if (!process.env.CANVAS_API_TOKEN || !process.env.CANVAS_BASE_URL) {
      return { ok: false as const, error: 'missing_credentials' as const }
    }
    try {
      const result = await runSync()
      return { ok: true as const, syncedAt: Date.now(), ...result }
    } catch {
      return { ok: false as const, error: 'canvas_unreachable' as const }
    }
  })
  .get('/credentials-status', () => {
    const configured = !!(process.env.CANVAS_API_TOKEN && process.env.CANVAS_BASE_URL)
    return { configured }
  })
