import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './client'

migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
console.log('Migrations applied')
