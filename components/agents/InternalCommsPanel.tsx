'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLES = [
  'CEO',
  'Project Manager',
  'Research Agent',
  'Lead Gen Agent',
  'Copywriting Agent',
  'Quality Agent',
  'Outreach Agent',
  'Strategy Agent',
  'Reporting Agent',
  'Social Media Agent',
  'Sales Validation Agent',
  'Browser Agent',
]

const MESSAGE_TYPES = [
  'update',
  'request',
  'handoff',
  'blocker',
  'approval_request',
  'report',
  'instruction',
  'review',
] as const

type MessageType = typeof MESSAGE_TYPES[number]

type FilterTab = 'all' | 'instruction' | 'blocker' | 'handoff' | 'report' | 'approval_request'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'instruction',      label: 'Instructions' },
  { id: 'blocker',          label: 'Blockers' },
  { id: 'handoff',          label: 'Handoffs' },
  { id: 'report',           label: 'Reports' },
  { id: 'approval_request', label: 'Approval Requests' },
]

type BadgeStyle = { bg: string; color: string; border: string }

const TYPE_BADGE: Record<MessageType, BadgeStyle> = {
  blocker:          { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  instruction:      { bg: '#eef2ff', color: '#6366f1', border: '#c7d2fe' },
  handoff:          { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  report:           { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  approval_request: { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
  review:           { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  request:          { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  update:           { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
}

const STATUS_DOT_COLOR: Record<string, string> = {
  sent:         '#94a3b8',
  read:         '#3b82f6',
  acknowledged: '#10b981',
  resolved:     '#e2e8f0',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentMessage {
  id: string
  project_id: string | null
  from_role: string
  from_agent_name: string | null
  to_role: string
  to_agent_name: string | null
  message_type: MessageType
  subject: string
  content: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
}

interface Props {
  projectId?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function typeBadge(type: MessageType) {
  const s = TYPE_BADGE[type] ?? TYPE_BADGE.update
  const label = type.replace(/_/g, ' ')
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10, fontWeight: 600,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 4, padding: '1px 6px',
      textTransform: 'capitalize' as const,
      whiteSpace: 'nowrap' as const,
      flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function InternalCommsPanel({ projectId }: Props) {
  const [messages, setMessages]     = useState<AgentMessage[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterTab, setFilterTab]   = useState<FilterTab>('all')
  const [composing, setComposing]   = useState(false)
  const [sending, setSending]       = useState(false)

  // Compose form state
  const [fromRole,     setFromRole]     = useState(ROLES[0])
  const [toRole,       setToRole]       = useState(ROLES[1])
  const [msgType,      setMsgType]      = useState<MessageType>('update')
  const [subject,      setSubject]      = useState('')
  const [content,      setContent]      = useState('')
  const [formError,    setFormError]    = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams({ limit: '50' })
    if (projectId) params.set('project_id', projectId)
    if (filterTab !== 'all') params.set('message_type', filterTab)
    return `/api/agent-messages?${params.toString()}`
  }, [projectId, filterTab])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(buildUrl())
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      // silently fail — table may not exist yet
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    setLoading(true)
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    timerRef.current = setInterval(fetchMessages, 30_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchMessages])

  async function handleSend() {
    if (!fromRole || !toRole || !subject.trim() || !content.trim()) {
      setFormError('All fields are required.')
      return
    }
    setFormError('')
    setSending(true)
    try {
      const url = projectId
        ? `/api/projects/${projectId}/agent-discussion`
        : '/api/agent-messages'

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_role: fromRole,
          to_role: toRole,
          message_type: msgType,
          subject: subject.trim(),
          content: content.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setComposing(false)
      setSubject('')
      setContent('')
      setMsgType('update')
      fetchMessages()
    } catch {
      setFormError('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 10,
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
            Internal communications
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {projectId ? 'Messages for this project' : 'All agent messages across projects'}
          </div>
        </div>
        <button
          onClick={() => setComposing(c => !c)}
          style={{
            background: composing ? '#f8fafc' : '#6366f1',
            color: composing ? '#64748b' : '#ffffff',
            border: composing ? '1px solid #e2e8f0' : 'none',
            borderRadius: 7, padding: '7px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {composing ? 'Cancel' : '+ Compose'}
        </button>
      </div>

      {/* Compose form */}
      {composing && (
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>
            New message
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' as const }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                From
              </label>
              <select
                value={fromRole}
                onChange={e => setFromRole(e.target.value)}
                style={selectStyle}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                To
              </label>
              <select
                value={toRole}
                onChange={e => setToRole(e.target.value)}
                style={selectStyle}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Type
              </label>
              <select
                value={msgType}
                onChange={e => setMsgType(e.target.value as MessageType)}
                style={selectStyle}
              >
                {MESSAGE_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Subject
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief subject line…"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Message
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your message…"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>
          {formError && (
            <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{formError}</div>
          )}
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: sending ? '#c7d2fe' : '#6366f1',
              color: '#ffffff', border: 'none', borderRadius: 7,
              padding: '8px 18px', fontSize: 12, fontWeight: 600,
              cursor: sending ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9' }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilterTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '7px 4px', marginRight: 16,
              fontSize: 12,
              fontWeight: filterTab === t.id ? 600 : 400,
              color: filterTab === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: filterTab === t.id ? '2px solid #6366f1' : '2px solid transparent',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '28px 20px', textAlign: 'center' as const, fontSize: 12, color: '#94a3b8' }}>
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>No messages yet.</div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
              Messages appear here when agents communicate during execution.
            </div>
          </div>
        ) : (
          <div>
            {messages.map((msg, i) => (
              <MessageRow key={msg.id} msg={msg} isLast={i === messages.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Message row ────────────────────────────────────────────────────────────────

function MessageRow({ msg, isLast }: { msg: AgentMessage; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const badgeType = (TYPE_BADGE[msg.message_type] ? msg.message_type : 'update') as MessageType
  const dotColor = STATUS_DOT_COLOR[msg.status] ?? STATUS_DOT_COLOR.sent

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid #f8fafc',
        cursor: 'pointer',
        background: expanded ? '#fafbff' : '#ffffff',
        transition: 'background 0.1s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
        {/* Status dot */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
        }} />

        {/* From → To */}
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', flexShrink: 0 }}>
          {msg.from_role}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>→</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', flexShrink: 0 }}>
          {msg.to_role}
        </span>

        {/* Type badge */}
        {typeBadge(badgeType)}

        {/* Timestamp */}
        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 10, color: '#cbd5e1',
          marginLeft: 'auto',
          flexShrink: 0,
        }}>
          {timeAgo(msg.created_at)}
        </span>
      </div>

      {/* Subject */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 3, paddingLeft: 14 }}>
        {msg.subject}
      </div>

      {/* Content preview */}
      <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 14, lineHeight: 1.5 }}>
        {expanded ? msg.content : truncate(msg.content, 120)}
      </div>

      {/* Expanded metadata */}
      {expanded && msg.metadata && Object.keys(msg.metadata).length > 0 && (
        <div style={{
          marginTop: 8, paddingLeft: 14,
          fontSize: 10, fontFamily: 'DM Mono, monospace',
          color: '#94a3b8',
        }}>
          {JSON.stringify(msg.metadata, null, 2).slice(0, 200)}
        </div>
      )}
    </div>
  )
}

// ── Shared input styles ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 7,
  padding: '8px 10px',
  fontSize: 12,
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
  cursor: 'pointer',
}
