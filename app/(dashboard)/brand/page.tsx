import { AikoBrand } from '@/components/brand/AikoBrand'
import type { ReactNode } from 'react'

const COLORS = [
  { name: 'Midnight', hex: '#07111F' },
  { name: 'Deep Navy', hex: '#0B1220' },
  { name: 'AÏKO Blue', hex: '#2563EB' },
  { name: 'Signal Cyan', hex: '#22D3EE' },
  { name: 'Ice Text', hex: '#E5F4FF' },
  { name: 'Slate Copy', hex: '#64748B' },
]

export default function BrandPage() {
  return (
    <div style={{ padding: '40px 32px 56px', maxWidth: 1120, margin: '0 auto' }} className="page-enter">
      <section style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        border: '1px solid rgba(125,211,252,0.18)',
        background: 'radial-gradient(circle at 76% 12%, rgba(34,211,238,0.22), transparent 30%), linear-gradient(135deg,#050b14,#081526 58%,#101827)',
        color: '#e5f4ff',
        padding: '42px 44px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <AikoBrand variant="dark" size="lg" />
            <p style={{ margin: '22px 0 0', maxWidth: 620, fontSize: 18, lineHeight: 1.65, color: '#a7b8d2' }}>
              AÏKO is an AI Marketing Operating System: a virtual marketing company with a CEO, agents, Web Operators, approvals, reports, files, and controlled self-improvement.
            </p>
            <p style={{ margin: '18px 0 0', fontSize: 14, color: '#67e8f9', fontWeight: 800 }}>
              AÏKO never bypasses login/CAPTCHA/security checks and never sends, posts, publishes, or messages without approval.
            </p>
          </div>
          <img
            src="/brand/aiko-dashboard-mockup.png"
            alt="AÏKO dashboard promotional mockup"
            width={420}
            style={{ width: 'min(420px, 100%)', height: 'auto', borderRadius: 12, boxShadow: '0 30px 90px rgba(0,0,0,0.35)' }}
          />
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginBottom: 20 }}>
        <BrandCard title="Logo mark">
          <img src="/brand/aiko-mark.svg" alt="AÏKO logo mark" width={104} height={104} />
        </BrandCard>
        <BrandCard title="Wordmark">
          <img src="/brand/aiko-wordmark.svg" alt="AÏKO wordmark" style={{ width: '100%', maxWidth: 320, height: 'auto' }} />
        </BrandCard>
        <BrandCard title="Full lockup">
          <img src="/brand/aiko-logo.svg" alt="AÏKO full logo" style={{ width: '100%', maxWidth: 360, height: 'auto' }} />
        </BrandCard>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
          Brand colors
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          {COLORS.map(color => (
            <div key={color.hex} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: 76, background: color.hex }} />
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 750 }}>{color.name}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#64748b' }}>{color.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function BrandCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, minHeight: 164 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 106 }}>
        {children}
      </div>
    </div>
  )
}
