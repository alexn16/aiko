import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getSetupState } from '@/lib/setup-state'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getServerSession(authOptions)
  const state = await getSetupState(session?.user?.id ?? null)
  redirect(state.setup_required ? '/setup' : '/ceo')
}
