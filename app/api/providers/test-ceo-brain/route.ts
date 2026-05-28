import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { callAI, getProviderForRole } from '@/lib/ai/router'

/**
 * POST /api/providers/test-ceo-brain
 *
 * Sends a minimal test message through callAI(role:'ceo') and returns
 * the result inline. Used by the /connect-ai Brain Verification panel.
 *
 * Does NOT:
 * - create CEO commands or log to ceo_commands
 * - create projects, tasks, or actions
 * - touch company memory
 * - call the Web Operator
 * - expose API keys
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null

  // Resolve which provider the CEO role would use
  const provider = await getProviderForRole('ceo', userId).catch(() => null)

  if (!provider) {
    return NextResponse.json(
      {
        success: false,
        error: 'AÏKO CEO has no working brain assigned. Connect a provider and assign it to the CEO role.',
      },
      { status: 503 }
    )
  }

  const providerInfo = {
    name: provider.name,
    model: provider.model ?? '(no model set)',
    type: provider.type,
  }

  try {
    const response = await callAI({
      role: 'ceo',
      userId,
      messages: [
        {
          role: 'system',
          content: 'You are a health check endpoint. Follow instructions exactly.',
        },
        {
          role: 'user',
          content: 'Reply with exactly: AÏKO_CEO_OK followed by one short sentence confirming you are ready.',
        },
      ],
      maxTokens: 60,
      temperature: 0,
    })

    const trimmed = response.trim()
    const passed = trimmed.includes('AÏKO_CEO_OK') || trimmed.includes('AIKO_CEO_OK')

    return NextResponse.json({
      success: passed,
      provider: providerInfo,
      response: trimmed.slice(0, 300),
      error: passed ? null : 'Response did not contain expected confirmation token.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        success: false,
        provider: providerInfo,
        response: null,
        error: msg,
      },
      { status: 502 }
    )
  }
}
