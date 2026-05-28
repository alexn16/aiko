'use client'
import { SessionProvider } from 'next-auth/react'

/**
 * Wraps children with NextAuth SessionProvider so client components
 * can access the session via useSession().
 */
export function SessionWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
