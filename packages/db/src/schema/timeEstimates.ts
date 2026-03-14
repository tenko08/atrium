import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { assignments } from './assignments'

export const timeEstimates = sqliteTable('time_estimates', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  assignmentId:   integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  estimatedMin:   integer('estimated_min').notNull(),
  source:         text('source', { enum: ['ai', 'user', 'historical'] }).notNull(),
  confidence:     real('confidence'),        // 0.0 – 1.0
  reasoning:      text('reasoning'),
  createdAt:      integer('created_at').notNull().$defaultFn(() => Date.now()),
})
