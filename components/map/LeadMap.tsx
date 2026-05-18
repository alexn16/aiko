'use client'
import { useEffect, useRef, useState } from 'react'

const STATUS_COLORS: Record<string, string> = {
  new:       '#666666',
  contacted: '#7098c8',
  replied:   '#c8a84a',
  qualified: '#7eb88a',
  rejected:  '#c87070',
}

interface Lead {
  id: string
  company_name: string
  contact_name?: string
  email?: string
  city: string
  status: string
  lat: number
  lng: number
}

export function LeadMap({ projectId }: { projectId: string }) {
  const mapRef = useRef<unknown>(null)
  const markersRef = useRef<Map<string, unknown>>(new Map())
  const [selected, setSelected] = useState<Lead | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState({ total: 0, qualified: 0, replied: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapRef.current) return

    // Dynamically import Leaflet only on the client
    import('leaflet').then(L => {
      // Fix default icon path issue in Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map('aiko-map', {
        center: [42.3, -8.0],
        zoom: 8,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      map.getContainer().style.background = '#111'
      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      const map = mapRef.current as ReturnType<typeof L.map>

      leads.forEach(lead => {
        const color = STATUS_COLORS[lead.status] ?? '#666'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid ${color === '#666666' ? '#444' : color};box-shadow:0 0 0 3px ${color}22;transition:all 0.3s;"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        })

        if (markersRef.current.has(lead.id)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (markersRef.current.get(lead.id) as any).setIcon(icon)
        } else {
          const marker = L.marker([lead.lat, lead.lng], { icon })
            .addTo(map)
            .on('click', () => setSelected(lead))
          markersRef.current.set(lead.id, marker)
        }
      })

      markersRef.current.forEach((marker, id) => {
        if (!leads.find(l => l.id === id)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (marker as any).remove()
          markersRef.current.delete(id)
        }
      })

      setStats({
        total:     leads.length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        replied:   leads.filter(l => l.status === 'replied').length,
      })
    })
  }, [leads])

  useEffect(() => {
    const source = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    source.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.leads) setLeads(data.leads)
    }
    return () => source.close()
  }, [projectId])

  return (
    <div style={{ display: 'flex', height: '100%', gap: 12 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Stats overlay */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: '#111', border: '1px solid #222',
          borderRadius: 4, padding: '10px 14px',
          display: 'flex', gap: 20, fontFamily: 'DM Mono, monospace',
        }}>
          {[
            { label: 'TOTAL',     value: stats.total,     color: '#e8e6e0' },
            { label: 'REPLIED',   value: stats.replied,   color: '#c8a84a' },
            { label: 'QUALIFIED', value: stats.qualified, color: '#7eb88a' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em' }}>{s.label}</div>
              <div style={{ fontSize: 18, color: s.color, fontWeight: 300 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
          background: '#111', border: '1px solid #222',
          borderRadius: 4, padding: '10px 14px',
          fontFamily: 'DM Mono, monospace', fontSize: 9,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{status}</span>
            </div>
          ))}
        </div>

        <div id="aiko-map" style={{ width: '100%', height: '100%', borderRadius: 4 }} />
      </div>

      {selected && (
        <div style={{
          width: 260, background: '#111', border: '1px solid #222',
          borderRadius: 4, padding: 16, fontFamily: 'DM Mono, monospace',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Selected lead
            </span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: '#e8e6e0', marginBottom: 4 }}>{selected.company_name}</div>
          {selected.contact_name && <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>{selected.contact_name}</div>}
          <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>📍 {selected.city}</div>
          {selected.email && <div style={{ fontSize: 10, color: '#7098c8', marginBottom: 12 }}>{selected.email}</div>}
          <div style={{
            display: 'inline-block', fontSize: 9, padding: '3px 8px',
            borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em',
            background: `${STATUS_COLORS[selected.status] ?? '#666'}22`,
            color: STATUS_COLORS[selected.status] ?? '#666',
            border: `1px solid ${STATUS_COLORS[selected.status] ?? '#666'}44`,
          }}>
            {selected.status}
          </div>
        </div>
      )}
    </div>
  )
}
