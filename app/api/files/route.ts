import { NextRequest, NextResponse } from 'next/server'
import {
  listGeneratedFiles,
  createGeneratedFile,
  type FileContentType,
} from '@/lib/generated-files'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('project_id')
  const limit     = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 200)
  const offset    = Number(request.nextUrl.searchParams.get('offset') ?? 0)

  try {
    const files = await listGeneratedFiles({
      project_id: projectId ?? undefined,
      limit,
      offset,
    })
    return NextResponse.json({ files })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('does not exist')) {
      return NextResponse.json({ files: [] })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      project_id,
      filename,
      content,
      content_type,
      title,
      description,
      generated_by_role,
      source_entity_type,
      source_entity_id,
    } = body

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 })
    }
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
    }
    const validTypes: FileContentType[] = ['markdown', 'csv', 'json', 'text']
    const ct: FileContentType = validTypes.includes(content_type) ? content_type : 'text'

    const file = await createGeneratedFile({
      project_id: project_id ?? null,
      filename,
      content,
      content_type: ct,
      title:        title ?? null,
      description:  description ?? null,
      generated_by_role: generated_by_role ?? null,
      source_entity_type: typeof source_entity_type === 'string' ? source_entity_type : null,
      source_entity_id: typeof source_entity_id === 'string' ? source_entity_id : null,
    })

    return NextResponse.json({ file }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
