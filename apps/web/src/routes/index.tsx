import { createFileRoute } from '@tanstack/react-router'
import { api } from '../api'

export const Route = createFileRoute('/')({
  loader: async () => {
    const { data, error } = await api.health.get()
    return { health: data, error: error ? String(error.value ?? error.status) : null }
  },
  component: function IndexPage() {
    const { health, error } = Route.useLoaderData()
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <h1>Atrium</h1>
        {error ? (
          <p style={{ color: 'red' }}>API error: {error}</p>
        ) : (
          <p>
            API status: <strong>{health?.status}</strong>{' '}
            (ts: {health?.timestamp})
          </p>
        )}
      </div>
    )
  },
})
