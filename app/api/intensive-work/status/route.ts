import { NextResponse } from 'next/server'
import { getActiveWork } from '@/lib/intensive-work/engine'
import { checkAssignedBrainHealth, formatProviderHealthForOwner } from '@/lib/ai/provider-health'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [status, brainHealth] = await Promise.all([
      getActiveWork(),
      checkAssignedBrainHealth('ceo').catch(() => null),
    ])
    return NextResponse.json({
      ...status,
      brain: brainHealth ? formatProviderHealthForOwner(brainHealth) : null,
    })
  } catch (err) {
    console.error('[intensive-work/status GET]', err)
    return NextResponse.json({ error: 'Could not load intensive work status.' }, { status: 500 })
  }
}
