'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

export function Sidebar() {
  const path = usePathname()

  return (
    <nav style={{
      width: 220,
      background: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px' }}>
        <div style={{
          fontSize: 17,
          fontWeight: 700,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          AÏKO
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontWeight: 400 }}>
          AI Marketing OS
        </div>
      </div>

      <div style={{ height: 1, background: '#f1f5f9', margin: '0 0 8px' }} />

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? path === '/'
            : path.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#0f172a' : '#64748b',
                textDecoration: 'none',
                background: isActive ? '#f8fafc' : 'transparent',
                borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        fontFamily: 'DM Mono, monospace',
        fontSize: 9,
        color: '#e2e8f0',
        letterSpacing: '0.06em',
      }}>
        v1.0 · self-hosted
      </div>
    </nav>
  )
}
