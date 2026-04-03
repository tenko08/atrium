import { db, schema } from '@atrium/db'
import { eq, sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Canvas API response types
// ---------------------------------------------------------------------------

interface CanvasAssignment {
  id: number
  name: string
  course_id: number
  description: string | null
  due_at: string | null
  overrides?: Array<{
    id: number
    course_section_id?: number
    due_at: string | null
  }>
}

interface CanvasCourse {
  id: number
  name: string
}

interface CanvasEnrollment {
  course_section_id: number
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Parse the rel="next" URL from a Canvas Link response header.
 * Returns null if the header is absent or has no rel="next" entry.
 */
export function extractNextLink(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}

/**
 * Resolve the correct due date for an assignment given the user's enrolled
 * section IDs. Returns the section-override due_at when a matching override
 * is found, otherwise falls back to the assignment's default due_at, or null.
 */
export function resolveDueAt(
  assignment: CanvasAssignment,
  userSectionIds: Set<string>
): string | null {
  if (assignment.overrides) {
    for (const override of assignment.overrides) {
      if (
        override.course_section_id !== undefined &&
        userSectionIds.has(String(override.course_section_id))
      ) {
        return override.due_at
      }
    }
  }
  return assignment.due_at ?? null
}

/**
 * Determine sync status for an assignment relative to what is already in DB.
 * - 'new'       — canvasId not seen before
 * - 'updated'   — canvasId exists but title or dueAt has changed
 * - 'unchanged' — canvasId exists and title + dueAt are identical
 */
export function computeSyncStatus(
  canvasId: string,
  title: string,
  dueAt: number | null,
  existingMap: Map<string, { title: string; dueAt: number | null }>
): 'new' | 'updated' | 'unchanged' {
  const existing = existingMap.get(canvasId)
  if (!existing) return 'new'
  if (existing.title !== title || existing.dueAt !== dueAt) return 'updated'
  return 'unchanged'
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function getEnvVars(): { baseUrl: string; apiToken: string } {
  const baseUrl = (process.env.CANVAS_BASE_URL ?? '').replace(/\/+$/, '')
  const apiToken = process.env.CANVAS_API_TOKEN ?? ''
  return { baseUrl, apiToken }
}

async function canvasFetchOnce(url: string, apiToken: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  if (res.status === 429) {
    // Respect rate limit: wait 1 second and retry once
    await Bun.sleep(1000)
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    if (retry.status === 429) {
      throw new Error(`Canvas rate limit: still 429 after retry for ${url}`)
    }
    return retry
  }
  if (!res.ok) {
    throw new Error(`Canvas API error ${res.status}: ${url}`)
  }
  return res
}

/**
 * Fetch all pages of a Canvas API endpoint by following rel="next" Link
 * headers. Returns a flat array of all items across all pages.
 * Exported for unit testing.
 */
export async function canvasFetchAll<T>(path: string): Promise<T[]> {
  const { baseUrl, apiToken } = getEnvVars()
  const results: T[] = []
  let url: string | null = `${baseUrl}/api/v1${path}`

  while (url) {
    const res = await canvasFetchOnce(url, apiToken)
    const page = (await res.json()) as T[]
    results.push(...page)
    url = extractNextLink(res.headers.get('Link'))
  }

  return results
}

// ---------------------------------------------------------------------------
// Public sync entry point
// ---------------------------------------------------------------------------

/**
 * Fetch all active Canvas courses and their assignments, resolve section
 * due-date overrides, compute sync status relative to stored data, and
 * upsert everything into SQLite.
 *
 * Returns the total count of assignments written to the DB.
 */
export async function runSync(): Promise<{ assignmentCount: number }> {
  const { baseUrl, apiToken } = getEnvVars()

  if (!baseUrl || !apiToken) {
    throw new Error('CANVAS_BASE_URL and CANVAS_API_TOKEN must be set')
  }

  // 1. Fetch all active student courses
  const courses = await canvasFetchAll<CanvasCourse>(
    '/courses?enrollment_type=student&enrollment_state=active&per_page=100'
  )

  // 2. Load existing canvas assignments from DB for sync status computation
  const existingRows = await db
    .select({
      canvasId: schema.assignments.canvasId,
      title: schema.assignments.title,
      dueAt: schema.assignments.dueAt,
    })
    .from(schema.assignments)
    .where(eq(schema.assignments.source, 'canvas'))

  const existingMap = new Map<string, { title: string; dueAt: number | null }>(
    existingRows
      .filter((r) => r.canvasId !== null)
      .map((r) => [r.canvasId as string, { title: r.title, dueAt: r.dueAt ?? null }])
  )

  // 3. Reset all canvas assignments syncStatus to 'unchanged' before upserting
  //    (rows not in current Canvas response will remain 'unchanged')
  await db
    .update(schema.assignments)
    .set({ syncStatus: 'unchanged' })
    .where(eq(schema.assignments.source, 'canvas'))

  // 4. Fetch assignments per course and upsert
  let totalAssignments = 0

  for (const course of courses) {
    // Fetch user's enrolled sections for this course
    const enrollments = await canvasFetchAll<CanvasEnrollment>(
      `/courses/${course.id}/enrollments?user_id=self&per_page=100`
    )
    const userSectionIds = new Set(
      enrollments.map((e) => String(e.course_section_id))
    )

    // Fetch assignments with section override data
    const assignments = await canvasFetchAll<CanvasAssignment>(
      `/courses/${course.id}/assignments?include[]=overrides&per_page=100`
    )

    if (assignments.length === 0) continue

    const rows = assignments.map((a) => {
      const resolvedDueAt = resolveDueAt(a, userSectionIds)
      const dueAtMs = resolvedDueAt ? new Date(resolvedDueAt).getTime() : null
      const canvasId = String(a.id)
      const status = computeSyncStatus(canvasId, a.name, dueAtMs, existingMap)

      return {
        source: 'canvas' as const,
        canvasId,
        title: a.name,
        courseId: String(course.id),
        courseName: course.name,
        description: a.description ?? null,
        dueAt: dueAtMs,
        syncStatus: status,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        completed: false,
      }
    })

    await db
      .insert(schema.assignments)
      .values(rows)
      .onConflictDoUpdate({
        target: schema.assignments.canvasId,
        set: {
          title: sql.raw(`excluded.${schema.assignments.title.name}`),
          courseId: sql.raw(`excluded.${schema.assignments.courseId.name}`),
          courseName: sql.raw(`excluded.${schema.assignments.courseName.name}`),
          description: sql.raw(`excluded.${schema.assignments.description.name}`),
          dueAt: sql.raw(`excluded.${schema.assignments.dueAt.name}`),
          syncStatus: sql.raw(`excluded.${schema.assignments.syncStatus.name}`),
          updatedAt: sql.raw(`excluded.${schema.assignments.updatedAt.name}`),
        },
      })

    totalAssignments += rows.length
  }

  return { assignmentCount: totalAssignments }
}
