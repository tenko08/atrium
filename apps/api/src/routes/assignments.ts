import { Elysia } from 'elysia'
import { db, schema } from '@atrium/db'

export const assignmentsRoute = new Elysia()
  .get('/assignments', async () => {
    const rows = await db.select().from(schema.assignments)
    return rows
  })
