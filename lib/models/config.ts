import { db } from '@/lib/db/client'
import { LLMConfig } from '@/lib/models/provider'

export async function getModelConfig(agentSlot: string): Promise<LLMConfig | null> {
  const result = await db.query(
    'SELECT base_url, api_key, model FROM model_configs WHERE agent_slot=$1',
    [agentSlot]
  )
  if (!result.rows[0]) return null
  const row = result.rows[0]
  return {
    baseURL: row.base_url,
    apiKey: row.api_key,
    model: row.model,
  }
}

export async function getAllModelConfigs(): Promise<Record<string, LLMConfig>> {
  const result = await db.query('SELECT agent_slot, base_url, api_key, model FROM model_configs')
  const configs: Record<string, LLMConfig> = {}
  for (const row of result.rows) {
    configs[row.agent_slot] = {
      baseURL: row.base_url,
      apiKey: row.api_key,
      model: row.model,
    }
  }
  return configs
}
