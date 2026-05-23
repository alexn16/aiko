/**
 * OpenAI-compatible adapter.
 * Works for: openai_api, ollama, openai_compatible, custom endpoints.
 */
import OpenAI from 'openai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallOptions {
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
  stream?: false
}

export interface StreamOptions {
  maxTokens?: number
  temperature?: number
  stream: true
  onChunk: (text: string) => void
}

const clientCache = new Map<string, OpenAI>()

function getClient(baseURL: string, apiKey: string): OpenAI {
  const cacheKey = `${baseURL}::${apiKey}`
  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new OpenAI({
      baseURL,
      apiKey: apiKey || 'not-required',
    }))
  }
  return clientCache.get(cacheKey)!
}

export async function callOpenAICompat(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: CallOptions
): Promise<string> {
  const client = getClient(baseURL, apiKey)
  const res = await client.chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 2000,
    temperature: opts.temperature ?? 0.4,
    response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
    stream: false,
  })
  return res.choices[0].message.content ?? ''
}

export async function streamOpenAICompat(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: StreamOptions
): Promise<void> {
  const client = getClient(baseURL, apiKey)
  const stream = await client.chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 1200,
    temperature: opts.temperature ?? 0.5,
    stream: true,
  })
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    if (text) opts.onChunk(text)
  }
}

/** Quick connectivity test — sends one minimal message */
export async function testOpenAICompat(
  baseURL: string,
  apiKey: string,
  model: string
): Promise<void> {
  const client = getClient(baseURL, apiKey)
  await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 5,
    stream: false,
  })
}
