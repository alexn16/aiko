'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarModeIndicator } from '@/components/mode/SidebarModeIndicator'

const CEO_ITEMS = [
  { href: '/ceo',              label: 'CEO' },
  { href: '/start-campaign',   label: '▶ First Campaign' },
  { href: '/projects',         label: 'Projects' },
  { href: '/connect-ai',       label: 'Connect AI' },
]

const NAV_ITEMS = [
  { href: '/',           label: 'Home' },
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/office',     label: 'Live Office' },
  { href: '/team',       label: 'Team' },
  { href: '/leads',      label: 'Leads' },
  { href: '/approvals',  label: 'Approvals' },
  { href: '/campaigns',  label: 'Campaigns' },
  { href: '/reports',    label: 'Reports' },
  // { href: '/tools',      label: 'Tools' },      // hidden from nav — available at /tools for debugging
  // { href: '/tool-runs',  label: 'Tool Runs' },  // hidden from nav — available at /tool-runs for debugging
  { href: '/operators',  label: 'Operators' },
  { href: '/operator-skills', label: 'Operator Skills' },
  { href: '/agents',     label: 'Agents' },
  { href: '/files',      label: 'Files' },
  { href: '/functions',  label: 'Functions' },
  { href: '/mode',       label: 'Operating Mode' },
  { href: '/system',     label: 'System' },
  { href: '/settings',   label: 'Settings' },
]

function NavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
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
      {label}
    </Link>
  )
}

export function Sidebar() {
  const path = usePathname()

  function isActive(href: string) {
    if (href === '/') return path === '/'
    return path.startsWith(href)
  }

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
        {/* CEO section */}
        <div style={{ padding: '4px 20px 2px', marginTop: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Command
          </div>
        </div>
        {CEO_ITEMS.map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
        ))}

        {/* Separator */}
        <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0' }} />

        {/* Standard nav */}
        {NAV_ITEMS.map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
        ))}
      </div>

      {/* Mode indicator */}
      <div style={{ borderTop: '1px solid #f1f5f9' }}>
        <SidebarModeIndicator />
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 20px 12px',
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
