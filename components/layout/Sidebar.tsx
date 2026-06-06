'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarModeIndicator } from '@/components/mode/SidebarModeIndicator'
import { AikoBrand } from '@/components/brand/AikoBrand'

const NAV_GROUPS = [
  {
    label: 'Primary',
    items: [
      { href: '/home', label: 'Home' },
      { href: '/ceo', label: 'CEO Chat' },
      { href: '/projects', label: 'Projects' },
      { href: '/operators', label: 'Operators' },
      { href: '/files', label: 'Files' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/start-campaign', label: 'Start Campaign' },
      { href: '/tasks', label: 'Tasks' },
      { href: '/leads', label: 'Leads' },
      { href: '/approvals', label: 'Approvals' },
      { href: '/reports', label: 'Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/connect-ai', label: 'Connect AI' },
      { href: '/system', label: 'System' },
      { href: '/mode', label: 'Mode' },
    ],
  },
]

const ADVANCED_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/office', label: 'Live Office' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/team', label: 'Team' },
  { href: '/skills', label: 'Skills' },
  { href: '/operator', label: 'Classic Operator' },
  { href: '/operator-skills', label: 'Operator Skills' },
  { href: '/operator-playbooks', label: 'Playbooks' },
  { href: '/agents', label: 'Agents' },
  { href: '/functions', label: 'Functions' },
  { href: '/settings', label: 'Settings' },
  { href: '/brand', label: 'Brand' },
  { href: '/tools', label: 'Tools' },
  { href: '/tool-runs', label: 'Tool Runs' },
  { href: '/api/health', label: 'Health' },
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
    if (href === '/operator') return path === '/operator'
    if (href === '/home') return path === '/home' || path === '/'
    return path.startsWith(href)
  }

  const advancedActive = ADVANCED_ITEMS.some(item => isActive(item.href))

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
        <AikoBrand size="sm" />
      </div>

      <div style={{ height: 1, background: '#f1f5f9', margin: '0 0 8px' }} />

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            <div style={{ padding: '8px 20px 3px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {group.label}
              </div>
            </div>
            {group.items.map(item => (
              <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
            ))}
          </div>
        ))}

        <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0' }} />

        <details open={advancedActive} data-testid="advanced-nav" style={{ marginBottom: 8 }}>
          <summary style={{
            cursor: 'pointer',
            padding: '8px 20px',
            fontSize: 11,
            fontWeight: 800,
            color: advancedActive ? '#0f172a' : '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            listStyle: 'none',
          }}>
            Advanced
          </summary>
          {ADVANCED_ITEMS.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
          ))}
        </details>
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
        v0.1.0 · local MVP
      </div>
    </nav>
  )
}
