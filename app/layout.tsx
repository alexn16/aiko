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
  { href: '/team',       label: 'Team' },
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
      <body style={{ margin: 0, background: '#f9fafb', color: '#111827', display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <nav style={{
          width: 200,
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
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
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 15,
            color: '#111827',
            padding: '0 20px 24px',
            borderBottom: '1px solid #e5e7eb',
            letterSpacing: '0.02em',
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
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  color: '#6b7280',
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div style={{ padding: '0 20px', fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#d1d5db', letterSpacing: '0.1em' }}>
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
