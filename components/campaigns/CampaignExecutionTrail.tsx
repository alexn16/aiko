'use client'
import { useEffect, useState } from 'react'
import type { TrailEvent, TrailEventType } from '@/lib/execution-trail'
import Link from 'next/link'

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  draft_created:              { dot: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
  draft_failed:               { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  approval_requested:         { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  approval_approved:          { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  approval_rejected:          { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  approval_changes_requested: { dot: '#8b5cf6', bg: '#f5f3ff', text: '#5b21b6' },
  operator_resumed:           { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  email_sent:                 { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  action_completed:           { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  action_failed:              { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  action_blocked:             { dot: '#94a3b8', bg: '#f8fafc', text: '#475569' },
  waiting_approval:           { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  reply_check:                { dot: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1' },
  reply_found:                { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
}
const defaultColor = { dot: '#94a3b8', bg: '#f8fafc', text: '#475569' }

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function EventRow({ event }: { event: TrailEvent }) {
  const c = EVENT_COLORS[event.type] ?? defaultColor
  return (
    <div style={{ display: 'flex', gap: 10, paddingBottom: 10 }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: c.dot, marginTop: 3 }} />
        <div style={{ flex: 1, width: 1, background: '#f1f5f9', marginTop: 2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: c.text, background: c.bg, borderRadius: 4, padding: '1px 5px',
          }}>
            {event.type.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>{timeAgo(event.timestamp)}</span>
          {event.actor && <span style={{ fontSize: 9, color: '#94a3b8' }}>by {event.actor}</span>}
          {event.skill_name && <span style={{ fontSize: 9, color: '#475569', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>Skill: {event.skill_name}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#0f172a', marginTop: 2 }}>{event.title}</div>
        {event.detail && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{event.detail}</div>}
        {event.failure_reason && (
          <div style={{ fontSize: 10, color: '#ef4444', marginTop: 1 }}>✗ {event.failure_reason === 'skill_blocked' ? 'Skill blocked this action' : event.failure_reason}</div>
        )}
        {event.screenshot_url && (
          <img src={event.screenshot_url} alt="screenshot" style={{ maxWidth: 200, marginTop: 4, borderRadius: 4, border: '1px solid #e2e8f0' }} />
        )}
        {(event.type === 'waiting_approval' || event.type === 'approval_approved') && event.approval_item_id && (
          <Link href="/approvals" style={{ fontSize: 9, color: '#6366f1', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>
            View in Approval Center →
          </Link>
        )}
      </div>
    </div>
  )
}

export function CampaignExecutionTrail({ campaignId }: { campaignId: string }) {
  const [events, setEvents] = useState<TrailEvent[] | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || events !== null) return
    setLoading(true)
    fetch(`/api/campaigns/${campaignId}/execution-trail`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [open, campaignId, events])

  return (
    <div style={{
      borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 16,
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: '#6366f1', padding: 0,
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12,
        }}
      >
        {open ? '▲' : '▼'} Execution trail
        {events && events.length > 0 && (
          <span style={{
            background: '#eef2ff', color: '#6366f1',
            borderRadius: 8, padding: '1px 7px', fontSize: 10, fontWeight: 600,
          }}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {open && (
        <div style={{ paddingLeft: 4 }}>
          {loading && <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading trail…</div>}
          {!loading && events && events.length === 0 && (
            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
              No operator actions recorded for this campaign yet.
              Actions will appear here once Web Operator executes tasks linked to campaign items.
            </div>
          )}
          {!loading && events && events.map((event, i) => (
            <EventRow key={`${event.action_id ?? event.approval_item_id ?? i}`} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
