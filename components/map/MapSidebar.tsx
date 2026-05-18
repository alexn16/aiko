'use client'
import { Badge } from '@/components/ui/Badge'

interface Lead {
  id: string
  company_name: string
  contact_name?: string
  email?: string
  city: string
  status: string
}

export function MapSidebar({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  return (
    <div style={{
      width: 260,
      background: '#111',
      border: '1px solid #222',
      borderRadius: 4,
      padding: 16,
      fontFamily: 'DM Mono, monospace',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Selected lead</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: '#e8e6e0', marginBottom: 4 }}>{lead.company_name}</div>
      {lead.contact_name && <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{lead.contact_name}</div>}
      <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>📍 {lead.city}</div>
      {lead.email && <div style={{ fontSize: 10, color: '#7098c8', marginBottom: 12 }}>{lead.email}</div>}
      <Badge label={lead.status} />
    </div>
  )
}
