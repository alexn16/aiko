import { NextRequest, NextResponse } from 'next/server'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getAllModelConfigs } from '@/lib/models/config'

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json()
    if (!command?.trim()) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 })
    }

    const configs = await getAllModelConfigs()
    const modelConfig = configs['ceoAgent'] ?? configs['researchAgent'] ?? Object.values(configs)[0]
    if (!modelConfig) {
      return NextResponse.json({ error: 'No model configured. Add a model in Settings.' }, { status: 503 })
    }

    const result = await runCeoCommandAgent(command.trim(), modelConfig)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/ceo/command]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
