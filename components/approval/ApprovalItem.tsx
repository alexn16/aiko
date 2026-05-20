'use client'
import { useState } from 'react'
import { Approval } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface ApprovalItemProps {
  approval: Approval & { company_name?: string; email?: string; quality_reason?: string }
  onAction: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:          { label: 'Pending quality check', color: '#888' },
  quality_passed:   { label: 'Quality passed ✓',      color: '#7eb88a' },
  quality_rejected: { label: 'Quality rejected',       color: '#c87878' },
  approved:         { label: 'Approved',               color: '#8aa7d6' },
}

export function ApprovalItem({ approval, onAction }: ApprovalItemProps) {
  const [body, setBody] = useState(approval.body)
  const [subject, setSubject] = useState(approval.subject ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const qualityInfo = STATUS_LABELS[approval.status]
  const isRejected = approval.status === 'quality_rejected'

  async function approveAndSend() {
    setLoading(true)
    setError(null)
    setNote(null)
    const res = await fetch('/api/outreach/approve-and-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) {
      setError(data.error ?? 'Unknown error')
    } else {
      if (data.note) setNote(data.note)
      setTimeout(onAction, 1200)
    }
  }

  async function overrideAndApprove() {
    setLoading(true)
    setError(null)
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body, status: 'quality_passed' }),
    })
    setLoading(false)
    onAction()
  }

  async function reject() {
    setLoading(true)
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, status: 'rejected' }),
    })
    setLoading(false)
    onAction()
  }

  async function saveEdits() {
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body }),
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0a0a0a',
    border: '1px solid #1a1a1a',
    borderRadius: 3,
    padding: '6px 10px',
    color: '#e8e6e0',
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    marginBottom: 8,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: '#111', border: `1px solid ${isRejected ? '#3a1a1a' : '#222'}`, borderRadius: 4, padding: 16, fontFamily: 'DM Mono, monospace' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#e8e6e0', marginBottom: 2 }}>
            {approval.company_name ?? 'Unknown company'}
          </div>
          {approval.email && (
            <div style={{ fontSize: 10, color: '#7098c8' }}>{approval.email}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Badge label={approval.channel} />
        </div>
      </div>

      {/* Quality status banner */}
      {qualityInfo && (
        <div style={{
          marginBottom: 10,
          padding: '5px 8px',
          borderRadius: 3,
          background: isRejected ? '#1a0a0a' : '#0d120d',
          border: `1px solid ${isRejected ? '#3a1a1a' : '#1a2a1a'}`,
          fontSize: 9,
          color: qualityInfo.color,
          letterSpacing: '0.08em',
        }}>
          {qualityInfo.label}
          {approval.quality_reason && (
            <span style={{ color: '#666', marginLeft: 8 }}>— {approval.quality_reason}</span>
          )}
        </div>
      )}

      {/* Subject */}
      {approval.channel === 'email' && (
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onBlur={saveEdits}
          placeholder="Subject"
          style={inputStyle}
        />
      )}

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onBlur={saveEdits}
        rows={6}
        style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical', marginBottom: 12 }}
      />

      {/* Error / Note */}
      {error && (
        <div style={{ marginBottom: 10, padding: '6px 8px', background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 3, fontSize: 10, color: '#c87878' }}>
          {error}
        </div>
      )}
      {note && (
        <div style={{ marginBottom: 10, padding: '6px 8px', background: '#0d120d', border: '1px solid #1a2a1a', borderRadius: 3, fontSize: 10, color: '#7eb88a' }}>
          {note}
        </div>
      )}

      {/* Actions */}
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
        <Button variant="ghost" size="sm" onClick={saveEdits}>
          Save edits
        </Button>
        <Button variant="danger" size="sm" onClick={reject} disabled={loading}>
          Reject
        </Button>
      </div>
    </div>
  )
}
