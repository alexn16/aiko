import { NextRequest, NextResponse } from 'next/server'
import { listApprovalItems, createApprovalItem } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const project_id = searchParams.get('project_id') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const item_type = searchParams.get('item_type') ?? undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined

    const items = await listApprovalItems({ project_id, status, item_type, limit })
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[api/approval-items GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const item = await createApprovalItem(body)
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    console.error('[api/approval-items POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
