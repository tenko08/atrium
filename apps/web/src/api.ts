import { treaty } from '@elysiajs/eden'
import type { App } from '@atrium/api'

// Type-only import from @atrium/api — no runtime dependency on the API package.
// Treaty resolves types at compile time; at runtime only the HTTP call goes to localhost:3001.
export const api = treaty<App>('localhost:3001')
