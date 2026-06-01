import { NextRequest, NextResponse } from 'next/server'
import { findProjectByNameOrAlias, listActiveProjectNames } from '@/lib/project-context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/search?q=<query>
 *
 * Find a project by name (exact or partial, case-insensitive).
 * Returns the first match, or all active project names if no match.
 *
 * Used by CEO recall and any search-by-name flow.
 * Read-only — never mutates data.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  try {
    if (!q.trim()) {
      const names = await listActiveProjectNames()
      return NextResponse.json({ project: null, all_names: names })
    }
    const project = await findProjectByNameOrAlias(q)
    const all_names = project ? [] : await listActiveProjectNames()
    return NextResponse.json({ project, all_names })
  } catch (err) {
    console.error('[projects/search GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
