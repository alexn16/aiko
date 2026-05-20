import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AÏKO — AI Marketing OS',
  description: 'Open, self-hostable AI marketing operating system',
}

const NAV_ITEMS = [
  { href: '/',           label: 'Home' },
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/office',     label: 'Live Office' },
  { href: '/leads',      label: 'Leads' },
  { href: '/map',        label: 'Map' },
  { href: '/approval',   label: 'Approval' },
  { href: '/campaigns',  label: 'Campaigns' },
  { href: '/reports',    label: 'Reports' },
  { href: '/functions',  label: 'Functions' },
  { href: '/settings',   label: 'Settings' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#e8e6e0', display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <nav style={{
          width: 200,
          background: '#111',
          borderRight: '1px solid #1a1a1a',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
        }}>
          <div style={{
            fontFamily: '"Noto Serif JP", serif',
            fontWeight: 300,
            fontSize: 16,
            color: '#c8b89a',
            padding: '0 20px 24px',
            borderBottom: '1px solid #1a1a1a',
            letterSpacing: '0.05em',
          }}>
            AÏKO
          </div>

          <div style={{ padding: '16px 0', flex: 1 }}>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '8px 20px',
                  fontFamily: '"DM Mono", monospace',
                  fontSize: 11,
                  color: '#666',
                  textDecoration: 'none',
                  letterSpacing: '0.05em',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div style={{ padding: '0 20px', fontFamily: '"DM Mono", monospace', fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>
            v1.0 · self-hosted
          </div>
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, marginLeft: 200, minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
