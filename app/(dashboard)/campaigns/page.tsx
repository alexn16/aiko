'use client'
import { useEffect, useState } from 'react'
import { Campaign } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      const pid = d.projects?.[0]?.id
      if (!pid) return
      fetch(`/api/campaigns?projectId=${pid}`).then(r => r.json()).then(d => {
        setCampaigns(d.campaigns ?? [])
      })
    }).catch(() => {})
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace' }}>
      <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', marginBottom: 24 }}>
        Campaigns
      </h2>

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

        {campaigns.length === 0 && (
          <div style={{ fontSize: 11, color: '#333', padding: '24px 0' }}>No campaigns yet.</div>
        )}
      </div>
    </div>
  )
}
