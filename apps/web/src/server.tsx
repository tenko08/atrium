import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

// createStartHandler returns the fetch handler directly.
// The TanStack Start dev plugin expects export default to be an object with a `.fetch` method.
const handler = createStartHandler(defaultStreamHandler)

export default {
  fetch: handler,
}
