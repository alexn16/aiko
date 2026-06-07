import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectBrain,
  createOrUpdateProjectBrain,
  generateProjectBrainFromExistingContext,
  formatProjectBrainForPrompt,
  getProjectBrainCompleteness,
} from '@/lib/project-brain'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [brain, completeness] = await Promise.all([
      getProjectBrain(params.id),
      getProjectBrainCompleteness(params.id),
    ])
    return NextResponse.json({ brain, completeness })
  } catch (err) {
    console.error('[api/projects/[id]/brain GET]', err)
    return NextResponse.json({ error: 'Could not load project brain.' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()

    if (body.action === 'generate') {
      const brain = await generateProjectBrainFromExistingContext(params.id)
      return NextResponse.json({ brain })
    }

    if (body.action === 'preview_prompt') {
      const prompt = await formatProjectBrainForPrompt(params.id)
      return NextResponse.json({ prompt })
    }

    const brain = await createOrUpdateProjectBrain(params.id, body)
    return NextResponse.json({ brain })
  } catch (err) {
    console.error('[api/projects/[id]/brain PUT]', err)
    return NextResponse.json({ error: 'Could not update project brain.' }, { status: 500 })
  }
}
