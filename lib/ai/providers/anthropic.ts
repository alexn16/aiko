/**
 * Anthropic Messages API adapter.
 * Works for: anthropic_api, anthropic_compatible.
 * Uses the official @anthropic-ai/sdk.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage } from './openai-compat'

const clientCache = new Map<string, Anthropic>()

function getClient(apiKey: string, baseURL?: string): Anthropic {
  const cacheKey = `${apiKey}::${baseURL ?? ''}`
  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new Anthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    }))
  }
  return clientCache.get(cacheKey)!
}

/** Convert OpenAI-style messages to Anthropic format */
function convertMessages(messages: ChatMessage[]): {
  system: string | undefined
  anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }>
} {
  const systemMsg = messages.find(m => m.role === 'system')
  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Ensure conversation starts with user
  if (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
    anthropicMessages.unshift({ role: 'user', content: '...' })
  }

  return { system: systemMsg?.content, anthropicMessages }
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; baseURL?: string } = {}
): Promise<string> {
  const client = getClient(apiKey, opts.baseURL)
  const { system, anthropicMessages } = convertMessages(messages)

  const res = await client.messages.create({
    model,
    messages: anthropicMessages,
    ...(system ? { system } : {}),
    max_tokens: opts.maxTokens ?? 2000,
    temperature: opts.temperature ?? 0.4,
  })

  const block = res.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; baseURL?: string; onChunk: (text: string) => void }
): Promise<void> {
  const client = getClient(apiKey, opts.baseURL)
  const { system, anthropicMessages } = convertMessages(messages)

  const stream = await client.messages.create({
    model,
    messages: anthropicMessages,
    ...(system ? { system } : {}),
    max_tokens: opts.maxTokens ?? 1200,
    temperature: opts.temperature ?? 0.5,
    stream: true,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      opts.onChunk(event.delta.text)
    }
  }
}

export async function testAnthropic(
  apiKey: string,
  model: string,
  baseURL?: string
): Promise<void> {
  const client = getClient(apiKey, baseURL)
  await client.messages.create({
    model,
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 5,
  })
}
