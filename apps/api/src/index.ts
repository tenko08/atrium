import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { healthRoute } from './routes/health'
import { syncRoute } from './routes/sync'
import { assignmentsRoute } from './routes/assignments'

const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .use(healthRoute)
  .use(syncRoute)
  .use(assignmentsRoute)
  .listen(3001)

export type App = typeof app

console.log(`API running at http://localhost:${app.server?.port}`)
