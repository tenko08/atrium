import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const assignments = sqliteTable('assignments', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  source:       text('source', { enum: ['canvas', 'manual'] }).notNull(),
  canvasId:     text('canvas_id'),
  title:        text('title').notNull(),
  courseId:     text('course_id'),
  courseName:   text('course_name'),
  description:  text('description'),
  dueAt:        integer('due_at'),            // unix ms, nullable
  estimatedMin: integer('estimated_min'),     // minutes
  completed:    integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedAt:  integer('completed_at'),      // unix ms
  createdAt:    integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt:    integer('updated_at').notNull().$defaultFn(() => Date.now()),
  syncStatus:   text('sync_status', { enum: ['new', 'updated', 'unchanged'] }),
}, (table) => [
  uniqueIndex('canvas_id_unique').on(table.canvasId),
])
