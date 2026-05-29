/**
 * Dashboard layout — wraps all authenticated dashboard routes.
 * Renders the sidebar, SetupGate, and AI chat widget.
 *
 * This layout does NOT apply to /login (which lives outside this group).
 */
import { Sidebar } from '@/components/layout/Sidebar'
import { SetupGate } from '@/components/setup/SetupGate'
import { AIChatWidget } from '@/components/chat/AIChatWidget'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SetupGate>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh' }}>
        {children}
      </main>
      <AIChatWidget />
    </SetupGate>
  )
}
