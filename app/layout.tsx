import type { Metadata } from 'next'
import './globals.css'
import { SessionWrapper } from '@/components/providers/SessionWrapper'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3001'),
  title: 'AÏKO — AI Marketing Operating System',
  description: 'Your AI marketing company: CEO, agents, Web Operators, campaigns, reports, and controlled self-improvement.',
  icons: {
    icon: '/brand/favicon.svg',
    shortcut: '/brand/favicon.svg',
    apple: '/brand/apple-touch-icon.png',
  },
  openGraph: {
    title: 'AÏKO — AI Marketing Operating System',
    description: 'Your AI marketing company: CEO, agents, Web Operators, campaigns, reports, and controlled self-improvement.',
    images: [{ url: '/brand/aiko-og-image.png', width: 1200, height: 630, alt: 'AÏKO AI Marketing Operating System dashboard mockup' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AÏKO — AI Marketing Operating System',
    description: 'Your AI marketing company: CEO, agents, Web Operators, campaigns, reports, and controlled self-improvement.',
    images: ['/brand/aiko-og-image.png'],
  },
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
