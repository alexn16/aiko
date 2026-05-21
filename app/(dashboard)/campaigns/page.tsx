'use client'
import { useEffect, useState } from 'react'
import { Campaign } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const CHANNELS = ['email', 'linkedin', 'whatsapp', 'social', 'multi']

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [projectId, setProjectId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('email')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      const pid = d.projects?.[0]?.id
      if (!pid) return
      setProjectId(pid)
      fetch(`/api/campaigns?projectId=${pid}`).then(r => r.json()).then(d => setCampaigns(d.campaigns ?? []))
    }).catch(() => {})
  }, [])

  async function create() {
    if (!name.trim() || !projectId) return
    setSaving(true)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: name.trim(), channel }),
    })
    const d = await res.json()
    if (d.campaign) { setCampaigns(p => [d.campaign, ...p]); setName(''); setChannel('email'); setShowForm(false) }
    setSaving(false)
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 800 }} className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Campaigns
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Track outreach performance by campaign.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New campaign'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card style={{ marginBottom: 20 }} padding={18}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>New campaign</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>Campaign name</label>
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Q3 outbound — SaaS founders" style={INPUT} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={INPUT}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Button variant="primary" onClick={create} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create campaign'}
          </Button>
        </Card>
      )}

      {/* Campaign list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {campaigns.map(c => (
          <Card key={c.id} padding={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em', marginBottom: 6 }}>
                  {c.name}
                </div>
                <Badge label={c.channel ?? 'multi'} />
              </div>
              <Badge label={c.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: 'Sent',      value: c.stats.sent },
                { label: 'Opened',    value: c.stats.opened },
                { label: 'Replied',   value: c.stats.replied },
                { label: 'Qualified', value: c.stats.qualified },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {campaigns.length === 0 && !showForm && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            background: '#ffffff', borderRadius: 10,
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>No campaigns yet</div>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px' }}>
              Create your first campaign to start tracking outreach performance.
            </p>
            <Button variant="primary" onClick={() => setShowForm(true)}>+ New campaign</Button>
          </div>
        )}
      </div>
    </div>
  )
}
