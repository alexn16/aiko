'use client'
import { useState } from 'react'
import { Approval } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Props {
  approval: Approval & { company_name?: string; email?: string; quality_reason?: string }
  onAction: () => void
}

const QUALITY_INFO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:          { label: 'Awaiting quality check', color: '#94a3b8', bg: '#f8fafc',  border: '#e2e8f0' },
  quality_passed:   { label: 'Quality passed',         color: '#10b981', bg: '#ecfdf5',  border: '#a7f3d0' },
  quality_rejected: { label: 'Quality rejected',        color: '#ef4444', bg: '#fef2f2',  border: '#fecaca' },
  approved:         { label: 'Approved',                color: '#6366f1', bg: '#eef2ff',  border: '#c7d2fe' },
}

const INPUT: React.CSSProperties = {
  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
}

export function ApprovalItem({ approval, onAction }: Props) {
  const [body, setBody] = useState(approval.body)
  const [subject, setSubject] = useState(approval.subject ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const qi = QUALITY_INFO[approval.status]
  const isRejected = approval.status === 'quality_rejected'

  async function approveAndSend() {
    setLoading(true); setError(null); setNote(null)
    const res = await fetch('/api/outreach/approve-and-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body }),
    })
    const d = await res.json()
    setLoading(false)
    if (!res.ok || d.error) { setError(d.error ?? 'Unknown error') }
    else { if (d.note) setNote(d.note); setTimeout(onAction, 1000) }
  }

  async function overrideAndApprove() {
    setLoading(true)
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body, status: 'quality_passed' }),
    })
    setLoading(false); onAction()
  }

  async function reject() {
    setLoading(true)
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, status: 'rejected' }),
    })
    setLoading(false); onAction()
  }

  async function saveEdits() {
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body }),
    })
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 10,
      border: `1px solid ${isRejected ? '#fecaca' : '#f1f5f9'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
            {approval.company_name ?? 'Unknown company'}
          </div>
          {approval.email && (
            <div style={{ fontSize: 12, color: '#3b82f6' }}>{approval.email}</div>
          )}
        </div>
        <Badge label={approval.channel} />
      </div>

      {/* Quality banner */}
      {qi && (
        <div style={{
          padding: '8px 18px',
          background: qi.bg, borderBottom: `1px solid ${qi.border}`,
          fontSize: 12, color: qi.color, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {qi.label}
          {approval.quality_reason && (
            <span style={{ color: '#94a3b8', fontWeight: 400 }}>— {approval.quality_reason}</span>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '14px 18px' }}>
        {approval.channel === 'email' && (
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onBlur={saveEdits}
            placeholder="Subject line"
            style={{ ...INPUT, marginBottom: 8 }}
          />
        )}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onBlur={saveEdits}
          rows={7}
          style={{ ...INPUT, lineHeight: 1.65, resize: 'vertical', marginBottom: error || note ? 10 : 14 }}
        />

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>
            {error}
          </div>
        )}
        {note && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 12, color: '#10b981' }}>
            {note}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isRejected && (
            <Button variant="primary" size="sm" onClick={approveAndSend} disabled={loading}>
              {loading ? 'Sending…' : 'Approve & Send'}
            </Button>
          )}
          {isRejected && (
            <Button variant="ghost" size="sm" onClick={overrideAndApprove} disabled={loading}>
              Override & approve anyway
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={saveEdits}>Save edits</Button>
          <Button variant="danger" size="sm" onClick={reject} disabled={loading}>Reject</Button>
        </div>
      </div>
    </div>
  )
}
