import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const fixedEvents = sqliteTable('fixed_events', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  title:       text('title').notNull(),
  startAt:     integer('start_at').notNull(),    // unix ms (first occurrence)
  endAt:       integer('end_at').notNull(),       // unix ms (first occurrence)
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurrence:  text('recurrence'),               // JSON string for recurrence rule, null if one-off
  createdAt:   integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt:   integer('updated_at').notNull().$defaultFn(() => Date.now()),
})
