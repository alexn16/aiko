import OpenAI from 'openai'

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
  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey || 'not-required',
  })

  const response = await client.chat.completions.create({
    model: config.model,
    messages,
    max_tokens: options.maxTokens ?? 2000,
    response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    temperature: 0.4,
  })

  return response.choices[0].message.content ?? ''
}
