import { NextRequest } from 'next/server'
import { streamAI, getProviderForRole } from '@/lib/ai/router'

const SYSTEM_PROMPT = `You are AÏKO, an AI marketing assistant embedded inside the AÏKO platform.
You help with marketing strategy, outreach copy, lead generation, campaign ideas, ICP definition, positioning, and any business or growth question.
Be direct, sharp, and helpful. No fluff. Sound like a sharp strategist, not a corporate assistant.
Keep answers concise unless the user asks for detail.`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Check provider is available before streaming
    const provider = await getProviderForRole('ceo')
    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'AÏKO has no AI brain connected. Go to Connect AI to add a provider.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          await streamAI({
            role: 'ceo',
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
            maxTokens: 1200,
            temperature: 0.5,
            onChunk: (text) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            },
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[api/chat]', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
