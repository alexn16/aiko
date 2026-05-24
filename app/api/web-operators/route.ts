import { NextRequest, NextResponse } from 'next/server'
import { listWebOperators, createWebOperator } from '@/lib/web-operator/operators'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const operators = await listWebOperators()
    return NextResponse.json({ operators })
  } catch (err) {
    console.error('[web-operators GET]', err)
    return NextResponse.json({ operators: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, role, project_id } = body as {
      name: string
      role?: string
      project_id?: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const operator = await createWebOperator({ name: name.trim(), role, project_id })
    return NextResponse.json({ operator }, { status: 201 })
  } catch (err) {
    console.error('[web-operators POST]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
