import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../api'
import { SyncButton } from '../components/SyncButton'
import { MissingCredentials } from '../components/MissingCredentials'

function SyncDot({ status }: { status: string | null }) {
  if (status === 'new') return <span style={{ color: '#22c55e', marginRight: '0.5rem' }}>&#x25CF;</span>
  if (status === 'updated') return <span style={{ color: '#f97316', marginRight: '0.5rem' }}>&#x25CF;</span>
  return null
}

function formatDueDate(unixMs: number): string {
  return new Date(unixMs).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export const Route = createFileRoute('/')({
  loader: async () => {
    const credRes = await api['credentials-status'].get()
    if (!credRes.data?.configured) {
      return { credentialsConfigured: false, assignments: [], syncError: null, syncedAt: null }
    }

    const syncRes = await api.sync.post()
    const syncedAt = syncRes.data && 'syncedAt' in syncRes.data ? syncRes.data.syncedAt : null
    const syncError =
      syncRes.data && 'ok' in syncRes.data && !syncRes.data.ok
        ? (syncRes.data as { ok: false; error: string }).error
        : null

    const assignRes = await api.assignments.get()
    const assignments = assignRes.data ?? []

    return { credentialsConfigured: true, assignments, syncError, syncedAt }
  },
  component: function IndexPage() {
    const loaderData = Route.useLoaderData()
    const [syncing, setSyncing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(loaderData.syncError)
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(loaderData.syncedAt ?? null)
    const [assignments, setAssignments] = useState(loaderData.assignments)

    if (!loaderData.credentialsConfigured) {
      return <MissingCredentials />
    }

    async function handleSync() {
      setSyncing(true)
      setSyncError(null)
      try {
        const res = await api.sync.post()
        if (res.data && 'ok' in res.data) {
          if (res.data.ok) {
            setLastSyncedAt(res.data.syncedAt)
            const assignRes = await api.assignments.get()
            setAssignments(assignRes.data ?? [])
          } else {
            setSyncError((res.data as { ok: false; error: string }).error)
          }
        }
      } catch {
        setSyncError('Sync failed — Canvas unreachable')
      } finally {
        setSyncing(false)
      }
    }

    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Atrium</h1>
        <SyncButton
          onSync={handleSync}
          syncing={syncing}
          error={syncError}
          lastSyncedAt={lastSyncedAt}
        />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {assignments.map((a: {
            id: number
            title: string
            courseName: string | null
            dueAt: number | null
            syncStatus: string | null
          }) => (
            <li key={a.id} style={{ marginBottom: '0.75rem' }}>
              <SyncDot status={a.syncStatus} />
              <strong>{a.title}</strong>
              {a.courseName && (
                <span style={{ color: '#666', marginLeft: '0.5rem' }}>({a.courseName})</span>
              )}
              {a.dueAt !== null && (
                <span style={{ color: '#999', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                  — due {formatDueDate(a.dueAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  },
})
