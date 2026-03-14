import { sqliteTable, integer } from 'drizzle-orm/sqlite-core'
import { assignments } from './assignments'

export const completionHistory = sqliteTable('completion_history', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  assignmentId:  integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  estimatedMin:  integer('estimated_min').notNull(),
  actualMin:     integer('actual_min').notNull(),
  completedAt:   integer('completed_at').notNull().$defaultFn(() => Date.now()),
})
