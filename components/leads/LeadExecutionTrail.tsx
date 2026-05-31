'use client'
import { useEffect, useState } from 'react'
import type { TrailEvent, TrailEventType } from '@/lib/execution-trail'
import Link from 'next/link'

// ── Style constants ────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  lead_approved:               { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  lead_rejected:               { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  draft_created:               { dot: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
  draft_failed:                { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  approval_requested:          { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  approval_approved:           { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  approval_rejected:           { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  approval_changes_requested:  { dot: '#8b5cf6', bg: '#f5f3ff', text: '#5b21b6' },
  operator_resumed:            { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  email_sent:                  { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  action_completed:            { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  action_failed:               { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626' },
  action_blocked:              { dot: '#94a3b8', bg: '#f8fafc', text: '#475569' },
  waiting_approval:            { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  waiting_user:                { dot: '#f97316', bg: '#fff7ed', text: '#9a3412' },
}

const defaultColor = { dot: '#94a3b8', bg: '#f8fafc', text: '#475569' }

function getColor(type: TrailEventType) {
  return EVENT_COLORS[type] ?? defaultColor
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

// ── TrailEventRow ──────────────────────────────────────────────────────────────

function TrailEventRow({ event }: { event: TrailEvent }) {
  const c = getColor(event.type)

  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>
      {/* Timeline dot */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: c.dot, marginTop: 4, flexShrink: 0,
        }} />
        <div style={{ flex: 1, width: 1, background: '#f1f5f9', marginTop: 2 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: c.text,
            background: c.bg, borderRadius: 4, padding: '1px 5px',
          }}>
            {event.type.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>{timeAgo(event.timestamp)}</span>
          {event.actor && (
            <span style={{ fontSize: 9, color: '#94a3b8' }}>by {event.actor}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#0f172a', marginTop: 2, fontWeight: 500 }}>
          {event.title}
        </div>
        {event.detail && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            {event.detail}
          </div>
        )}
        {event.failure_reason && (
          <div style={{ fontSize: 10, color: '#ef4444', marginTop: 1 }}>
            ✗ {event.failure_reason}
          </div>
        )}
        {/* Screenshot — only if not sensitive */}
        {event.screenshot_url && (
          <div style={{ marginTop: 4 }}>
            <img
              src={event.screenshot_url}
              alt="screenshot"
              style={{ maxWidth: 160, borderRadius: 4, border: '1px solid #e2e8f0' }}
            />
          </div>
        )}
        {/* Link to approval center for pending/approved items */}
        {(event.type === 'waiting_approval' || event.type === 'approval_approved') && event.approval_item_id && (
          <Link
            href="/approvals"
            style={{ fontSize: 9, color: '#6366f1', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}
          >
            View in Approval Center →
          </Link>
        )}
      </div>
    </div>
  )
}

// ── LeadExecutionTrail ─────────────────────────────────────────────────────────

interface Props {
  leadId: string
  companyName?: string
}

export function LeadExecutionTrail({ leadId, companyName }: Props) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<TrailEvent[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || events !== null) return
    setLoading(true)
    fetch(`/api/leads/${leadId}/execution-trail`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [open, leadId, events])

  const hasActivity = open && events && events.length > 0
  const previewEvents = events ? events.slice(-3) : [] // last 3 most recent

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 9, fontWeight: 600, color: '#6366f1', padding: 0,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}
      >
        {open ? '▲' : '▼'} Execution trail
        {events && events.length > 0 && (
          <span style={{
            background: '#eef2ff', color: '#6366f1',
            borderRadius: 8, padding: '0 5px', fontSize: 8,
          }}>
            {events.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: 8, paddingLeft: 4 }}>
          {loading && (
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Loading trail…</div>
          )}
          {!loading && events && events.length === 0 && (
            <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
              No operator actions recorded for this lead yet.
            </div>
          )}
          {!loading && hasActivity && previewEvents.map((event, i) => (
            <TrailEventRow key={`${event.action_id ?? event.approval_item_id ?? i}`} event={event} />
          ))}
          {!loading && events && events.length > 3 && (
            <div style={{ fontSize: 9, color: '#94a3b8', paddingLeft: 16, marginTop: 2 }}>
              + {events.length - 3} earlier events (showing most recent 3)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
