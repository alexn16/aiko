/**
 * POST /api/projects/[id]/artifact-bundle
 *
 * Generate a complete internal project artifact bundle.
 *
 * Safety:
 * - Read-only on all source data.
 * - Writes only to storage/generated-files/ via createGeneratedFile.
 * - Never exposes secrets, API keys, or tokens.
 * - Never triggers outreach, email, or Web Operator actions.
 * - No external sends.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateProjectArtifactBundle } from '@/lib/project-artifact-bundle'
import { db } from '@/lib/db/client'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  // Verify project exists
  try {
    const check = await db.query(
      `SELECT id FROM projects WHERE id=$1 LIMIT 1`,
      [projectId]
    )
    if (!check.rows[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  try {
    const result = await generateProjectArtifactBundle(projectId)

    return NextResponse.json(
      {
        files:         result.files,
        manifest:      result.manifest,
        download_urls: result.download_urls,
        file_count:    result.files.length,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[artifact-bundle] error:', err)
    return NextResponse.json(
      { error: 'Failed to generate artifact bundle' },
      { status: 500 }
    )
  }
}
