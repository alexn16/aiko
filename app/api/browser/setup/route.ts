import { NextResponse } from 'next/server'
import { getChromeSetupStatus } from '@/lib/browser/controller'

export const dynamic = 'force-dynamic'

/**
 * GET /api/browser/setup
 *
 * Returns safe browser mode status for the Connect AI / Operators UI.
 * Never exposes full filesystem paths — only chrome_found and mode.
 */
export async function GET() {
  try {
    const status = getChromeSetupStatus()
    return NextResponse.json({
      mode: status.mode,
      chrome_found: status.chrome_found,
      chrome_profile_directory: status.chrome_profile_directory,
      ready: status.ready,
      owner_message: status.owner_message,
      setup_instructions: status.setup_instructions,
    })
  } catch (err) {
    console.error('[api/browser/setup]', err)
    return NextResponse.json({ mode: 'persistent', chrome_found: false, ready: true, owner_message: 'Browser setup unavailable.', setup_instructions: '' })
  }
}
