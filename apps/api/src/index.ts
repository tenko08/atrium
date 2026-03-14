import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { healthRoute } from './routes/health'

const app = new Elysia()
  .use(cors({ origin: 'http://localhost:3000' }))
  .use(healthRoute)
  .listen(3001)

export type App = typeof app

console.log(`API running at http://localhost:${app.server?.port}`)
