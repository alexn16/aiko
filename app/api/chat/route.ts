import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are AÏKO, an AI marketing assistant embedded inside the AÏKO platform.
You help with marketing strategy, outreach copy, lead generation, campaign ideas, ICP definition, positioning, and any business or growth question.
Be direct, sharp, and helpful. No fluff. Sound like a sharp strategist, not a corporate assistant.
Keep answers concise unless the user asks for detail.`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Load the configured model (prefer ceoAgent, fall back to first available)
    const result = await db.query(
      `SELECT base_url, api_key, model FROM model_configs
       WHERE model != '' AND base_url != ''
       ORDER BY CASE WHEN agent_slot = 'ceoAgent' THEN 0
                     WHEN agent_slot = 'copywritingAgent' THEN 1
                     ELSE 2 END
       LIMIT 1`
    )

    const cfg = result.rows[0]
    if (!cfg) {
      return new Response(
        JSON.stringify({ error: 'No AI model configured. Go to Settings to add one.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const client = new OpenAI({
      baseURL: cfg.base_url,
      apiKey: cfg.api_key || 'not-required',
    })

    // Stream the response
    const stream = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
      max_tokens: 1200,
      temperature: 0.5,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
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
