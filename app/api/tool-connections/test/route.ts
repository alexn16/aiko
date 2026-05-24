import { NextRequest, NextResponse } from 'next/server'
import { testToolConnection } from '@/lib/tools/tool-router'

export async function POST(req: NextRequest) {
  try {
    const { tool_type } = await req.json() as { tool_type?: string }

    if (!tool_type) {
      return NextResponse.json({ error: 'tool_type is required' }, { status: 400 })
    }

    const result = await testToolConnection(tool_type)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/tool-connections/test]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
