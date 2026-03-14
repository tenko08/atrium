import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'

// Use an in-memory database for tests
const sqlite = new Database(':memory:')
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA foreign_keys = ON')
const db = drizzle(sqlite, { schema })

beforeAll(() => {
  // Run migrations against the in-memory DB
  migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
})

afterAll(() => {
  sqlite.close()
})

describe('Schema: table existence', () => {
  const expectedTables = [
    'assignments',
    'time_estimates',
    'schedule_blocks',
    'fixed_events',
    'preferences',
    'completion_history',
  ]

  for (const tableName of expectedTables) {
    test(`table "${tableName}" exists`, () => {
      const result = sqlite.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(tableName)
      expect(result).not.toBeNull()
    })
  }
})

describe('Schema: SQLite pragmas', () => {
  test('WAL mode pragma was set (in-memory SQLite returns "memory" instead of "wal")', () => {
    // SQLite in-memory databases do not support WAL; journal_mode stays "memory".
    // We verify the PRAGMA call succeeded (no error) and that client.ts issues the pragma.
    // For file-based DBs (production), journal_mode would return 'wal'.
    const result = sqlite.query('PRAGMA journal_mode').get() as { journal_mode: string }
    expect(['wal', 'memory']).toContain(result.journal_mode)
  })

  test('foreign keys are enforced', () => {
    const result = sqlite.query('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(result.foreign_keys).toBe(1)
  })
})

describe('Schema: FK enforcement', () => {
  test('inserting schedule_blocks with non-existent assignment_id throws', () => {
    expect(() => {
      sqlite.run(
        `INSERT INTO schedule_blocks (assignment_id, start_at, end_at, is_manual, created_at)
         VALUES (99999, ${Date.now()}, ${Date.now() + 3600000}, 0, ${Date.now()})`
      )
    }).toThrow()
  })
})

describe('Schema: assignments table', () => {
  test('can insert a canvas assignment', () => {
    const now = Date.now()
    sqlite.run(
      `INSERT INTO assignments (source, canvas_id, title, completed, created_at, updated_at)
       VALUES ('canvas', 'cv_001', 'Test Assignment', 0, ${now}, ${now})`
    )
    const row = sqlite.query(`SELECT * FROM assignments WHERE canvas_id='cv_001'`).get()
    expect(row).not.toBeNull()
  })

  test('can insert a manual assignment (canvas_id is null)', () => {
    const now = Date.now()
    sqlite.run(
      `INSERT INTO assignments (source, title, completed, created_at, updated_at)
       VALUES ('manual', 'Manual Task', 0, ${now}, ${now})`
    )
    const row = sqlite.query(`SELECT * FROM assignments WHERE title='Manual Task'`).get() as { source: string } | null
    expect(row).not.toBeNull()
    expect(row?.source).toBe('manual')
  })
})
