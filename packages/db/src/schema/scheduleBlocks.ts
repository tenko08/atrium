import { sqliteTable, integer } from 'drizzle-orm/sqlite-core'
import { assignments } from './assignments'

export const scheduleBlocks = sqliteTable('schedule_blocks', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  startAt:      integer('start_at').notNull(),    // unix ms
  endAt:        integer('end_at').notNull(),       // unix ms
  isManual:     integer('is_manual', { mode: 'boolean' }).notNull().default(false),
  createdAt:    integer('created_at').notNull().$defaultFn(() => Date.now()),
})
