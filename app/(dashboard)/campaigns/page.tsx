'use client'
import { useEffect, useState } from 'react'
import { Campaign } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const CHANNELS = ['email', 'linkedin', 'whatsapp', 'social', 'multi']

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
      fetch(`/api/campaigns?projectId=${pid}`).then(r => r.json()).then(d => {
        setCampaigns(d.campaigns ?? [])
      })
    }).catch(() => {})
  }, [])

  async function createCampaign() {
    if (!name.trim() || !projectId) return
    setSaving(true)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: name.trim(), channel }),
    })
    const d = await res.json()
    if (d.campaign) {
      setCampaigns(prev => [d.campaign, ...prev])
      setName('')
      setChannel('email')
      setShowForm(false)
    }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 3,
    padding: '6px 10px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace',
    fontSize: 11, width: '100%', boxSizing: 'border-box',
  }

  const selectStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 3,
    padding: '6px 10px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace',
    fontSize: 11, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', margin: 0 }}>
          Campaigns
        </h2>
        <Button variant="primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New campaign'}
        </Button>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            New campaign
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                CAMPAIGN NAME
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCampaign()}
                placeholder="Q3 outbound — SaaS founders"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                CHANNEL
              </label>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={selectStyle}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Button variant="primary" onClick={createCampaign} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create campaign'}
          </Button>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {campaigns.map(c => (
          <Card key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#e8e6e0', marginBottom: 4 }}>{c.name}</div>
                <Badge label={c.channel ?? 'multi'} />
              </div>
              <Badge label={c.status} />
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Sent',      value: c.stats.sent },
                { label: 'Opened',    value: c.stats.opened },
                { label: 'Replied',   value: c.stats.replied },
                { label: 'Qualified', value: c.stats.qualified },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize: 16, color: '#e8e6e0', fontWeight: 300 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {campaigns.length === 0 && !showForm && (
          <div style={{ fontSize: 11, color: '#333', padding: '24px 0' }}>
            No campaigns yet. Create one to start tracking outreach performance.
          </div>
        )}
      </div>
    </div>
  )
}
