import { NextRequest, NextResponse } from 'next/server'
import { runCeoCommandAgent } from '@/lib/agents/ceo-command-agent'
import { getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { getAllModelConfigs } from '@/lib/models/config'

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json()
    if (!command?.trim()) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 })
    }

    // Try new provider router first
    const provider = await getProviderForRole('ceo') ?? await getAnyConnectedProvider()
    if (provider) {
      const modelConfig = {
        baseURL: provider.base_url ?? '',
        apiKey: provider.api_key_encrypted ?? '',
        model: provider.model ?? '',
      }
      const result = await runCeoCommandAgent(command.trim(), modelConfig)
      return NextResponse.json(result)
    }

    // Legacy fallback: old model_configs table
    const configs = await getAllModelConfigs()
    const legacyConfig = configs['ceoAgent'] ?? configs['researchAgent'] ?? Object.values(configs)[0]
    if (legacyConfig) {
      const result = await runCeoCommandAgent(command.trim(), legacyConfig)
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'AÏKO has no AI brain connected. Go to Connect AI to add a provider.' },
      { status: 503 }
    )
  } catch (err) {
    console.error('[api/ceo/command]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
