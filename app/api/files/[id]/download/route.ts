import { NextRequest, NextResponse } from 'next/server'
import { getGeneratedFile, readGeneratedFileContent } from '@/lib/generated-files'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const file = await getGeneratedFile(params.id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const content = await readGeneratedFileContent(file)
  if (!content) {
    return NextResponse.json({ error: 'File content not found on disk' }, { status: 404 })
  }

  return new NextResponse(content as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        file.mime_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length':      String(content.length),
      'Cache-Control':       'private, no-cache',
    },
  })
}
