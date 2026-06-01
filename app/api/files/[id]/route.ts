import { NextRequest, NextResponse } from 'next/server'
import { getGeneratedFile, deleteGeneratedFile } from '@/lib/generated-files'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const file = await getGeneratedFile(params.id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ file })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const file = await getGeneratedFile(params.id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await deleteGeneratedFile(params.id)
  return NextResponse.json({ ok: true })
}
