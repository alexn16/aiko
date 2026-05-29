import type { Metadata } from 'next'
import './globals.css'
import { SessionWrapper } from '@/components/providers/SessionWrapper'

export const metadata: Metadata = {
  title: 'AÏKO — AI Marketing OS',
  description: 'Open, self-hostable AI marketing operating system',
}

/**
 * Root layout — bare shell with session provider only.
 *
 * Dashboard chrome (Sidebar, SetupGate, AIChatWidget) lives in
 * app/(dashboard)/layout.tsx so /login and other standalone pages
 * never inherit it.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8fafc', color: '#0f172a', display: 'flex', minHeight: '100vh' }}>
        <SessionWrapper>
          {children}
        </SessionWrapper>
      </body>
    </html>
  )
}
