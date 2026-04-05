import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../api'
import { SyncButton } from '../components/SyncButton'
import { MissingCredentials } from '../components/MissingCredentials'
import { groupByCourse, groupByDueDate, buildDueAt, type Assignment } from '../utils/groupAssignments'

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

function InlineEditRow({
  assignment,
  onSave,
  onCancel,
}: {
  assignment: Assignment
  onSave: (id: number, title: string, estimatedMin: number, dueAt: number | null) => void
  onCancel: () => void
}) {
  const [editTitle, setEditTitle] = useState(assignment.title)
  const [editHours, setEditHours] = useState(
    String(Math.floor((assignment.estimatedMin ?? 0) / 60))
  )
  const [editMinutes, setEditMinutes] = useState(
    String((assignment.estimatedMin ?? 0) % 60)
  )

  // Pre-fill date fields from dueAt
  const initialDate = assignment.dueAt !== null ? new Date(assignment.dueAt) : null
  const [editDay, setEditDay] = useState(initialDate ? String(initialDate.getDate()) : '')
  const [editMonth, setEditMonth] = useState(initialDate ? String(initialDate.getMonth() + 1) : '')
  const [editYear, setEditYear] = useState(initialDate ? String(initialDate.getFullYear()) : '')
  const [editHour, setEditHour] = useState(initialDate ? String(initialDate.getHours()) : '')
  const [editMinute, setEditMinute] = useState(initialDate ? String(initialDate.getMinutes()) : '')
  const [dateError, setDateError] = useState<string | null>(null)

  function handleSave() {
    setDateError(null)
    const h = Number(editHours || '0')
    const m = Number(editMinutes || '0')
    const totalMin = h * 60 + m

    let dueAt: number | null = null
    if (editDay || editMonth || editYear) {
      const result = buildDueAt(editDay, editMonth, editYear, editHour || undefined, editMinute || undefined)
      if (result !== null && typeof result === 'object' && 'error' in result) {
        setDateError(result.error)
        return
      }
      dueAt = result as number | null
    }

    onSave(assignment.id, editTitle.trim(), totalMin, dueAt)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            fontFamily: 'monospace', fontSize: '1rem', padding: '0.25rem',
            border: '1px solid #cccccc', borderRadius: '4px', flex: 1,
          }}
          autoFocus
        />
        <input
          type="number" min="0" value={editHours} onChange={e => setEditHours(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' h '}
        <input
          type="number" min="0" max="59" value={editMinutes} onChange={e => setEditMinutes(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' m '}
        <button
          onClick={handleSave}
          style={{ fontFamily: 'monospace', fontSize: '1rem', padding: '0.25rem 0.5rem', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          aria-label="Save edit"
        >&#10003;</button>
        <button
          onClick={onCancel}
          style={{ fontFamily: 'monospace', fontSize: '1rem', padding: '0.25rem 0.5rem', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          aria-label="Cancel edit"
        >&#10005;</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <input
          type="number" placeholder="DD" value={editDay} onChange={e => setEditDay(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' / '}
        <input
          type="number" placeholder="MM" value={editMonth} onChange={e => setEditMonth(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' / '}
        <input
          type="number" placeholder="YYYY" value={editYear} onChange={e => setEditYear(e.target.value)}
          style={{ width: '4rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' '}
        <input
          type="number" placeholder="HH" value={editHour} onChange={e => setEditHour(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' : '}
        <input
          type="number" placeholder="MM" value={editMinute} onChange={e => setEditMinute(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
      </div>
      {dateError && <div style={{ fontSize: '0.875rem', color: 'red' }}>{dateError}</div>}
    </div>
  )
}

function ManualTaskCreationForm({ onCreate }: {
  onCreate: (title: string, estimatedMin: number, dueAt: number | null) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [dueHour, setDueHour] = useState('')
  const [dueMinute, setDueMinute] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [durationError, setDurationError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTitleError(null); setDurationError(null); setDateError(null); setSubmitError(null)

    let valid = true
    if (!title.trim()) { setTitleError('Name is required'); valid = false }

    const h = Number(hours || '0')
    const m = Number(minutes || '0')
    const totalMin = h * 60 + m
    if (totalMin < 1) { setDurationError('Duration is required'); valid = false }

    let dueAt: number | null = null
    if (day || month || year) {
      const result = buildDueAt(day, month, year, dueHour || undefined, dueMinute || undefined)
      if (result !== null && typeof result === 'object' && 'error' in result) {
        setDateError(result.error)
        valid = false
      } else {
        dueAt = result as number | null
      }
    }

    if (!valid) return

    try {
      await onCreate(title.trim(), totalMin, dueAt)
      // Clear form on success
      setTitle(''); setHours(''); setMinutes('')
      setDay(''); setMonth(''); setYear(''); setDueHour(''); setDueMinute('')
    } catch {
      setSubmitError('Could not create task — try again')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #cccccc' }}
    >
      {/* Name field */}
      <div style={{ marginBottom: '0.5rem' }}>
        <input
          type="text"
          placeholder="Task name"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '1rem', padding: '0.25rem', border: '1px solid #cccccc', borderRadius: '4px', boxSizing: 'border-box' }}
        />
        {titleError && <div style={{ fontSize: '0.875rem', color: 'red', marginTop: '0.25rem' }}>{titleError}</div>}
      </div>

      {/* Duration field: [__] h [__] m (D-09) */}
      <div style={{ marginBottom: '0.5rem' }}>
        <input
          type="number" min="0" value={hours} onChange={e => setHours(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' h '}
        <input
          type="number" min="0" max="59" value={minutes} onChange={e => setMinutes(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' m'}
        {durationError && <div style={{ fontSize: '0.875rem', color: 'red', marginTop: '0.25rem' }}>{durationError}</div>}
      </div>

      {/* Due date (optional): [DD] / [MM] / [YYYY] + optional [HH] : [MM] (D-09, D-10) */}
      <div style={{ marginBottom: '0.5rem' }}>
        <input
          type="number" placeholder="DD" value={day} onChange={e => setDay(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' / '}
        <input
          type="number" placeholder="MM" value={month} onChange={e => setMonth(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' / '}
        <input
          type="number" placeholder="YYYY" value={year} onChange={e => setYear(e.target.value)}
          style={{ width: '4rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        <span style={{ color: '#666', fontSize: '0.875rem', marginLeft: '0.5rem' }}>(optional)</span>
        {' '}
        <input
          type="number" placeholder="HH" value={dueHour} onChange={e => setDueHour(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {' : '}
        <input
          type="number" placeholder="MM" value={dueMinute} onChange={e => setDueMinute(e.target.value)}
          style={{ width: '3rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '1rem', border: '1px solid #cccccc', borderRadius: '4px', padding: '0.25rem' }}
        />
        {dateError && <div style={{ fontSize: '0.875rem', color: 'red', marginTop: '0.25rem' }}>{dateError}</div>}
      </div>

      <button
        type="submit"
        style={{ fontFamily: 'monospace', fontSize: '1rem', padding: '0.5rem 1rem', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
      >+ Add Task</button>
      {submitError && <div style={{ fontSize: '0.875rem', color: 'red', marginTop: '0.25rem' }}>{submitError}</div>}
    </form>
  )
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
    const [assignments, setAssignments] = useState<Assignment[]>(loaderData.assignments as Assignment[])
    const [groupBy, setGroupBy] = useState<'course' | 'dueDate'>('course') // D-01: default by course
    const [hoveredId, setHoveredId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)

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
            setAssignments((assignRes.data ?? []) as Assignment[])
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

    async function handleToggleComplete(a: Assignment) {
      const prev = assignments
      const newCompleted = !a.completed
      // Optimistic update (D-05, D-06): update local state immediately
      setAssignments(prev =>
        prev.map(x => x.id === a.id
          ? { ...x, completed: newCompleted, completedAt: newCompleted ? Date.now() : null } as Assignment
          : x
        )
      )
      try {
        await api.assignments({ id: String(a.id) }).complete.patch({ completed: newCompleted })
      } catch {
        // T-08: rollback on error
        setAssignments(prev)
      }
    }

    async function handleDelete(id: number) {
      setHoveredId(null) // T-09: clear hover state before removing row
      const prev = assignments
      setAssignments(prev => prev.filter(x => x.id !== id))
      try {
        await api.assignments({ id: String(id) }).delete()
      } catch {
        setAssignments(prev)
      }
    }

    async function handleEditSave(id: number, title: string, estimatedMin: number, dueAt: number | null) {
      const prev = assignments
      setAssignments(prev => prev.map(x => x.id === id ? { ...x, title, estimatedMin, dueAt } : x))
      setEditingId(null)
      try {
        await api.assignments({ id: String(id) }).patch({ title, estimatedMin, dueAt })
      } catch {
        setAssignments(prev)
        setEditingId(id)
      }
    }

    async function handleCreateTask(title: string, estimatedMin: number, dueAt: number | null) {
      try {
        const res = await api.assignments.post({ title, estimatedMin, dueAt })
        if (res.data) {
          // Prepend to local state so it appears immediately
          setAssignments(prev => [res.data as Assignment, ...prev])
        }
      } catch {
        throw new Error('Could not create task — try again')
      }
    }

    const groups = groupBy === 'course'
      ? groupByCourse(assignments)
      : groupByDueDate(assignments)

    // Ensure Manual section always rendered in course view (D-08: form always visible)
    const finalGroups = groupBy === 'course'
      ? (groups.some(g => g.label === 'Manual') ? groups : [...groups, { label: 'Manual', items: [] }])
      : groups // due-date view: Manual section not forced; tasks appear in buckets

    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Atrium</h1>

        {/* GroupingToggle — placed above SyncButton (UI-SPEC §Component 1) */}
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setGroupBy('course')}
            style={{
              fontFamily: 'monospace', fontSize: '1rem',
              padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer',
              background: groupBy === 'course' ? '#f4f4f4' : 'transparent',
              border: groupBy === 'course' ? '1px solid #cccccc' : '1px solid transparent',
            }}
          >By Course</button>
          <button
            onClick={() => setGroupBy('dueDate')}
            style={{
              fontFamily: 'monospace', fontSize: '1rem',
              padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer',
              background: groupBy === 'dueDate' ? '#f4f4f4' : 'transparent',
              border: groupBy === 'dueDate' ? '1px solid #cccccc' : '1px solid transparent',
              marginLeft: '0.25rem',
            }}
          >By Due Date</button>
        </div>

        <SyncButton
          onSync={handleSync}
          syncing={syncing}
          error={syncError}
          lastSyncedAt={lastSyncedAt}
        />

        {/* Empty state (UI-SPEC §Component 7 + Copywriting Contract) */}
        {assignments.length === 0 && (
          <p style={{ color: '#666', fontSize: '1rem' }}>
            No assignments yet. Sync Canvas to load your tasks.
          </p>
        )}

        {/* AssignmentGroup rendering (UI-SPEC §Component 2) */}
        {finalGroups.map((group, groupIndex) => (
          <section key={group.label}>
            <h2 style={{
              fontSize: '1rem', fontWeight: 700,
              marginBottom: '0.5rem',
              marginTop: groupIndex === 0 ? 0 : '1.5rem',
              fontFamily: 'monospace', color: '#333',
            }}>{group.label}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {group.items.map(a => {
                // InlineEditRow when editing this manual task (D-12)
                if (editingId === a.id && a.source === 'manual') {
                  return (
                    <li key={a.id} style={{ marginBottom: '0.75rem' }}>
                      <InlineEditRow
                        assignment={a}
                        onSave={handleEditSave}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  )
                }
                return (
                  <li
                    key={a.id}
                    style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
                    onMouseEnter={() => a.source === 'manual' && setHoveredId(a.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={a.completed}
                        onChange={() => handleToggleComplete(a)}
                        aria-label={a.completed ? `Mark "${a.title}" as incomplete` : `Mark "${a.title}" as complete`}
                        style={{ marginRight: '0.5rem' }}
                      />
                      {/* SyncDot only for Canvas assignments */}
                      {a.source === 'canvas' && <SyncDot status={a.syncStatus} />}
                      <strong style={a.completed ? { textDecoration: 'line-through', color: '#999999' } : {}}>
                        {a.title}
                      </strong>
                      {/* Course name in due-date grouping view */}
                      {a.courseName && groupBy === 'dueDate' && (
                        <span style={{ color: '#666', marginLeft: '0.5rem' }}>({a.courseName})</span>
                      )}
                      {a.dueAt !== null && (
                        <span style={{ color: '#999', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                          — due {formatDueDate(a.dueAt)}
                        </span>
                      )}
                    </div>
                    {/* Hover-reveal edit/delete — manual tasks only (D-11, D-14) */}
                    {a.source === 'manual' && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                          onClick={() => setEditingId(a.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1rem', marginLeft: '0.25rem', color: '#666',
                            fontFamily: 'monospace',
                            visibility: hoveredId === a.id ? 'visible' : 'hidden',
                          }}
                          aria-label={`Edit "${a.title}"`}
                        >&#9998;</button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1rem', marginLeft: '0.25rem', color: '#666',
                            fontFamily: 'monospace',
                            visibility: hoveredId === a.id ? 'visible' : 'hidden',
                          }}
                          aria-label={`Delete "${a.title}"`}
                        >&#128465;</button>
                      </div>
                    )}
                  </li>
                )
              })}
              {/* ManualTaskCreationForm at the bottom of the Manual group (D-08) */}
              {group.label === 'Manual' && (
                <ManualTaskCreationForm onCreate={handleCreateTask} />
              )}
            </ul>
          </section>
        ))}
      </div>
    )
  },
})
