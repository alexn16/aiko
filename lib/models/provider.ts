import OpenAI from 'openai'

const clientCache = new Map<string, OpenAI>()

function getClient(baseURL: string, apiKey: string): OpenAI {
  const key = `${baseURL}::${apiKey}`
  if (!clientCache.has(key)) {
    clientCache.set(key, new OpenAI({ baseURL, apiKey: apiKey || 'not-required' }))
  }
  return clientCache.get(key)!
}

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
}

export interface ModelProvider {
  baseURL: string
  apiKey: string
  model: string
  contextWindow: number
}

export interface AgentModelConfig {
  researchAgent:        ModelProvider
  copywritingAgent:     ModelProvider
  leadGenAgent:         ModelProvider
  outreachAgent:        ModelProvider
  strategyAgent:        ModelProvider
  reportingAgent:       ModelProvider
  browserAgent:         ModelProvider
  qualityAgent:         ModelProvider
  salesValidationAgent: ModelProvider
  ceoAgent:             ModelProvider
  projectManagerAgent:  ModelProvider
  socialMediaAgent:     ModelProvider
}

export async function callLLM(
  config: LLMConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const client = getClient(config.baseURL, config.apiKey)

  const response = await client.chat.completions.create({
    model: config.model,
    messages,
    max_tokens: options.maxTokens ?? 2000,
    response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    temperature: 0.4,
  })

  return response.choices[0].message.content ?? ''
}
