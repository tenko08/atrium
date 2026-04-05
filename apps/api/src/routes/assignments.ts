import { Elysia, t } from 'elysia'
import { db, schema } from '@atrium/db'
import { eq } from 'drizzle-orm'

export const assignmentsRoute = new Elysia()
  .get('/assignments', async () => {
    const rows = await db.select().from(schema.assignments)
    return rows
  })
  .post('/assignments', async ({ body }) => {
    const now = Date.now()
    const [row] = await db.insert(schema.assignments).values({
      source: 'manual',
      title: body.title,
      estimatedMin: body.estimatedMin,
      dueAt: body.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning()
    return new Response(JSON.stringify(row), { status: 201 })
  }, {
    body: t.Object({
      title: t.String({ minLength: 1 }),
      estimatedMin: t.Number({ minimum: 1 }),
      dueAt: t.Optional(t.Nullable(t.Number())),
    })
  })
  .patch('/assignments/:id/complete', async ({ params, body }) => {
    const [row] = await db.update(schema.assignments)
      .set({
        completed: body.completed,
        completedAt: body.completed ? Date.now() : null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.assignments.id, params.id))
      .returning()
    return row ?? { error: 'not found' }
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({ completed: t.Boolean() }),
  })
  .patch('/assignments/:id', async ({ params, body }) => {
    // Fetch first to guard against editing Canvas assignments (T-02)
    const [existing] = await db.select().from(schema.assignments)
      .where(eq(schema.assignments.id, params.id))
    if (!existing) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    if (existing.source === 'canvas') {
      return new Response(JSON.stringify({ error: 'cannot modify canvas assignments' }), { status: 403 })
    }
    const [row] = await db.update(schema.assignments)
      .set({
        title: body.title,
        estimatedMin: body.estimatedMin,
        dueAt: body.dueAt ?? null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.assignments.id, params.id))
      .returning()
    return row
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
      title: t.String({ minLength: 1 }),
      estimatedMin: t.Number({ minimum: 1 }),
      dueAt: t.Optional(t.Nullable(t.Number())),
    })
  })
  .delete('/assignments/:id', async ({ params }) => {
    // Fetch first to guard against deleting Canvas assignments (T-02)
    const [existing] = await db.select().from(schema.assignments)
      .where(eq(schema.assignments.id, params.id))
    if (!existing) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    if (existing.source === 'canvas') {
      return new Response(JSON.stringify({ error: 'cannot modify canvas assignments' }), { status: 403 })
    }
    await db.delete(schema.assignments)
      .where(eq(schema.assignments.id, params.id))
    return { ok: true }
  }, {
    params: t.Object({ id: t.Numeric() }),
  })
