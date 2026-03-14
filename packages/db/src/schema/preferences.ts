import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const preferences = sqliteTable('preferences', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  workStartHour:   integer('work_start_hour').notNull().default(9),   // 0-23
  workEndHour:     integer('work_end_hour').notNull().default(22),     // 0-23
  canvasBaseUrl:   text('canvas_base_url'),
  canvasApiToken:  text('canvas_api_token'),    // stored server-side only
  updatedAt:       integer('updated_at').notNull().$defaultFn(() => Date.now()),
})
