'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarModeIndicator } from '@/components/mode/SidebarModeIndicator'
import { AikoBrand } from '@/components/brand/AikoBrand'

const PRIMARY_ITEMS = [
  { href: '/home', label: 'Home' },
  { href: '/ceo', label: 'CEO' }, // formerly CEO Chat
  { href: '/today', label: 'Today' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/projects', label: 'Projects' },
  { href: '/operators', label: 'Operators' },
  { href: '/files', label: 'Files' },
]

// Navigation groups retained conceptually: Primary, Work, System, Advanced.
const SYSTEM_ITEMS = [
  { href: '/connect-ai', label: 'Connect AI' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/skills', label: 'Skills' },
  { href: '/work', label: 'Work Queue' },
  { href: '/system', label: 'System Improvements' },
  { href: '/mode', label: 'Mode' },
  { href: '/settings', label: 'Settings' },
  { href: '/brand', label: 'Brand' },
]

const ADVANCED_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/start-campaign', label: 'Start Campaign' },
  { href: '/leads', label: 'Leads' },
  { href: '/reports', label: 'Reports' },
  { href: '/office', label: 'Live Office' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/team', label: 'Team' },
  { href: '/operator', label: 'Classic Operator' },
  { href: '/operator-skills', label: 'Operator Skills' },
  { href: '/operator-playbooks', label: 'Playbooks' },
  { href: '/agents', label: 'Agents' },
  { href: '/functions', label: 'Functions' },
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
        borderLeft: isActive ? '2px solid #111827' : '2px solid transparent',
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

  const systemActive = SYSTEM_ITEMS.some(item => isActive(item.href))
  const advancedActive = ADVANCED_ITEMS.some(item => isActive(item.href))

  return (
    <nav style={{
      width: 220,
      background: '#ffffff',
      borderRight: '1px solid #f3f4f6',
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

      <div style={{ height: 1, background: '#f3f4f6', margin: '0 0 12px' }} />

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        <div style={{ marginBottom: 12 }}>
          {PRIMARY_ITEMS.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
          ))}
        </div>

        <div style={{ height: 1, background: '#f3f4f6', margin: '10px 20px' }} />

        <details open={systemActive || advancedActive} style={{ marginBottom: 8 }}>
          <summary style={{
            cursor: 'pointer',
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 500,
            color: systemActive || advancedActive ? '#0f172a' : '#64748b',
            listStyle: 'none',
          }}>
            System
          </summary>
          {SYSTEM_ITEMS.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
          ))}
          <details open={advancedActive} data-testid="advanced-nav" style={{ marginTop: 8 }}>
            <summary style={{
              cursor: 'pointer',
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 500,
              color: advancedActive ? '#0f172a' : '#9ca3af',
              listStyle: 'none',
            }}>
              Advanced
            </summary>
          {ADVANCED_ITEMS.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} isActive={isActive(item.href)} />
          ))}
          </details>
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
        v0.2.0 · local MVP
      </div>
    </nav>
  )
}
