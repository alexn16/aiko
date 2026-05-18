'use client'
import { useState } from 'react'
import { Approval } from '@/lib/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface ApprovalItemProps {
  approval: Approval & { company_name?: string; email?: string }
  onAction: () => void
}

export function ApprovalItem({ approval, onAction }: ApprovalItemProps) {
  const [body, setBody] = useState(approval.body)
  const [subject, setSubject] = useState(approval.subject ?? '')
  const [loading, setLoading] = useState(false)

  async function approve() {
    setLoading(true)
    // First update the body/subject, then set approved status
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body, status: 'approved' }),
    })
    await fetch('/api/outreach/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id }),
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

  async function save() {
    await fetch('/api/approvals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalId: approval.id, subject, body }),
    })
  }

  return (
    <div style={{
      background: '#111',
      border: '1px solid #222',
      borderRadius: 4,
      padding: 16,
      fontFamily: 'DM Mono, monospace',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#e8e6e0', marginBottom: 4 }}>
            {approval.company_name ?? 'Unknown company'}
          </div>
          {approval.email && (
            <div style={{ fontSize: 10, color: '#7098c8' }}>{approval.email}</div>
          )}
        </div>
        <Badge label={approval.channel} />
      </div>

      {approval.channel === 'email' && (
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onBlur={save}
          placeholder="Subject"
          style={{
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
          }}
        />
      )}

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onBlur={save}
        rows={6}
        style={{
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          borderRadius: 3,
          padding: '8px 10px',
          color: '#e8e6e0',
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          lineHeight: 1.6,
          resize: 'vertical',
          marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" size="sm" onClick={approve} disabled={loading}>
          Approve & Send
        </Button>
        <Button variant="ghost" size="sm" onClick={save}>
          Save edits
        </Button>
        <Button variant="danger" size="sm" onClick={reject} disabled={loading}>
          Reject
        </Button>
      </div>
    </div>
  )
}
