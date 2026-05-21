'use client'
import { useState } from 'react'
import { Approval } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface ApprovalItemProps {
  approval: Approval & { company_name?: string; email?: string; quality_reason?: string }
  onAction: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:          { label: 'Pending quality check', color: '#6b7280', bg: '#f9fafb',  border: '#e5e7eb' },
  quality_passed:   { label: 'Quality passed ✓',      color: '#16a34a', bg: '#f0fdf4',  border: '#bbf7d0' },
  quality_rejected: { label: 'Quality rejected',       color: '#dc2626', bg: '#fef2f2',  border: '#fecaca' },
  approved:         { label: 'Approved',               color: '#2563eb', bg: '#eff6ff',  border: '#bfdbfe' },
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 4,
  padding: '6px 10px',
  color: '#374151',
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  marginBottom: 8,
  boxSizing: 'border-box',
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

  return (
    <div style={{ background: '#ffffff', border: `1px solid ${isRejected ? '#fecaca' : '#e5e7eb'}`, borderRadius: 6, padding: 16, fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500, marginBottom: 2 }}>
            {approval.company_name ?? 'Unknown company'}
          </div>
          {approval.email && (
            <div style={{ fontSize: 13, color: '#2563eb' }}>{approval.email}</div>
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
          padding: '6px 10px',
          borderRadius: 4,
          background: qualityInfo.bg,
          border: `1px solid ${qualityInfo.border}`,
          fontSize: 12,
          color: qualityInfo.color,
        }}>
          {qualityInfo.label}
          {approval.quality_reason && (
            <span style={{ color: '#9ca3af', marginLeft: 8 }}>— {approval.quality_reason}</span>
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
        <div style={{ marginBottom: 10, padding: '7px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, fontSize: 13, color: '#dc2626' }}>
          {error}
        </div>
      )}
      {note && (
        <div style={{ marginBottom: 10, padding: '7px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, fontSize: 13, color: '#16a34a' }}>
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
