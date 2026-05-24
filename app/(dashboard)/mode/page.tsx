import { OperatingModePanel } from '@/components/mode/OperatingModePanel'
import { ModeActionLog } from '@/components/mode/ModeActionLog'

export const dynamic = 'force-dynamic'

export default function ModePage() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Operating Mode
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Control what AÏKO is allowed to do.
        </p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <OperatingModePanel />
      </div>

      <ModeActionLog />
    </div>
  )
}
