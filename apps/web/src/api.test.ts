import { describe, test, expect } from 'bun:test'
import { api } from './api'

// NOTE: This test requires the API server to be running on localhost:3001.
// Run `cd apps/api && bun src/index.ts &` before running this test, or
// run it as part of the full integration suite after `bun dev`.

describe('Eden Treaty: /health', () => {
  test('returns { status: "ok", timestamp: number }', async () => {
    const { data, error } = await api.health.get()
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.status).toBe('ok')
    expect(typeof data?.timestamp).toBe('number')
    expect(data!.timestamp).toBeGreaterThan(0)
  })
})
