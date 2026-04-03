function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface SyncButtonProps {
  onSync: () => Promise<void>
  syncing: boolean
  error: string | null
  lastSyncedAt: number | null
}

export function SyncButton({ onSync, syncing, error, lastSyncedAt }: SyncButtonProps) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <button
        onClick={onSync}
        disabled={syncing}
        style={{
          fontFamily: 'monospace',
          fontSize: '1rem',
          padding: '0.5rem 1rem',
          cursor: syncing ? 'not-allowed' : 'pointer',
          opacity: syncing ? 0.7 : 1,
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: '#fff',
        }}
      >
        {syncing ? 'Syncing...' : '↻ Sync Now'}
      </button>
      {lastSyncedAt !== null && (
        <div style={{ marginTop: '0.375rem', fontSize: '0.8rem', color: '#666' }}>
          Last synced {timeAgo(lastSyncedAt)}
        </div>
      )}
      {error !== null && (
        <div style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'red' }}>
          {error}
        </div>
      )}
    </div>
  )
}
