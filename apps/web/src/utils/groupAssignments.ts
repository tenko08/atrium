export type Assignment = {
  id: number
  title: string
  courseName: string | null
  dueAt: number | null
  completed: boolean
  source: 'canvas' | 'manual'
  syncStatus: string | null
  estimatedMin: number | null
}

export type Group = { label: string; items: Assignment[] }

export function sortGroup(items: Assignment[]): Assignment[] {
  const incomplete = items
    .filter(a => !a.completed)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  const complete = items
    .filter(a => a.completed)
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  return [...incomplete, ...complete]
}

export function groupByCourse(assignments: Assignment[]): Group[] {
  const map = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const key = a.source === 'manual' ? '__manual__' : (a.courseName ?? 'Unknown')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  const groups: Group[] = []
  // Canvas course groups first, Manual section last
  for (const [key, items] of map) {
    if (key !== '__manual__') groups.push({ label: key, items: sortGroup(items) })
  }
  if (map.has('__manual__')) {
    groups.push({ label: 'Manual', items: sortGroup(map.get('__manual__')!) })
  }
  return groups
}

export function groupByDueDate(assignments: Assignment[]): Group[] {
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const weekEnd = new Date(todayEnd)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const buckets: Record<string, Assignment[]> = {
    'Due today': [],
    'Due this week': [],
    'Due later': [],
    'No due date': [],
  }
  for (const a of assignments) {
    if (a.dueAt === null) { buckets['No due date'].push(a); continue }
    if (a.dueAt <= todayEnd.getTime()) buckets['Due today'].push(a)
    else if (a.dueAt <= weekEnd.getTime()) buckets['Due this week'].push(a)
    else buckets['Due later'].push(a)
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items: sortGroup(items) }))
}

// T-05 mitigation: validate that reconstructed date matches inputs (JS date overflow guard)
export function buildDueAt(
  day: string, month: string, year: string,
  hour?: string, minute?: string
): number | null | { error: string } {
  if (!day && !month && !year) return null
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  const h = hour ? Number(hour) : 23
  const min = minute ? Number(minute) : 59
  const date = new Date(y, m - 1, d, h, min, 0, 0)
  // Coherence check: JS date overflow (e.g. April 31 → May 1) must be rejected
  if (date.getDate() !== d || date.getMonth() !== m - 1 || date.getFullYear() !== y) {
    return { error: 'Invalid date — check day, month, and year' }
  }
  return date.getTime()
}
