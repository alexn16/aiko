'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Lead } from '@/lib/leads'
import { LeadExecutionTrail } from '@/components/leads/LeadExecutionTrail'

const SCORE_COLOR = (score: number | null): string => {
  if (score === null) return '#94a3b8'
  if (score > 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#94a3b8'
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
]

const BLANK_MANUAL = {
  company_name: '',
  website: '',
  location: '',
  category: '',
  notes: '',
}

const INPUT: React.CSSProperties = {
  background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 6,
  padding: '6px 10px', fontSize: 12, color: '#0f172a',
  width: '100%', boxSizing: 'border-box',
}

interface Props {
  projectId: string
}

export function ProjectLeadsPanel({ projectId }: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [draftResult, setDraftResult] = useState<Record<string, string>>({})
  const [extractingAction, setExtractingAction] = useState<string | null>(null)
  const [extractResult, setExtractResult] = useState<{ count: number; at: number } | null>(null)
  const [checkingReplyId, setCheckingReplyId] = useState<string | null>(null)
  const [replyResult, setReplyResult] = useState<Record<string, string>>({})
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState(BLANK_MANUAL)
  const [savingManual, setSavingManual] = useState(false)

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?project_id=${projectId}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads ?? [])
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadLeads()
    const interval = setInterval(loadLeads, 30000)
    return () => clearInterval(interval)
  }, [loadLeads])

  // Hide extract result after 3s
  useEffect(() => {
    if (extractResult) {
      const t = setTimeout(() => setExtractResult(null), 3000)
      return () => clearTimeout(t)
    }
  }, [extractResult])

  const filteredLeads = statusFilter
    ? leads.filter(l => l.status === statusFilter)
    : leads

  async function prepareDraft(lead: Lead) {
    setDraftingId(lead.id)
    setDraftResult(prev => ({ ...prev, [lead.id]: '' }))
    try {
      const res = await fetch(`/api/leads/${lead.id}/outreach-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      const data = await res.json()
      setDraftResult(prev => ({ ...prev, [lead.id]: data.message ?? (data.success ? 'Draft sent to operator.' : 'Failed.') }))
      if (data.success) loadLeads()
    } catch {
      setDraftResult(prev => ({ ...prev, [lead.id]: 'Error preparing draft.' }))
    } finally {
      setDraftingId(null)
    }
  }

  async function findContact(lead: Lead) {
    setDraftingId(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}/find-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      const data = await res.json()
      setDraftResult(prev => ({ ...prev, [lead.id]: data.message ?? 'Operator is searching for contact details.' }))
    } catch {
      setDraftResult(prev => ({ ...prev, [lead.id]: 'Error.' }))
    } finally {
      setDraftingId(null)
    }
  }

  async function checkReply(lead: Lead) {
    setCheckingReplyId(lead.id)
    setReplyResult(prev => ({ ...prev, [lead.id]: 'Checking Gmail via browser…' }))
    try {
      const res = await fetch(`/api/leads/${lead.id}/check-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReplyResult(prev => ({ ...prev, [lead.id]: data.error ?? 'Error checking reply.' }))
      } else {
        setReplyResult(prev => ({ ...prev, [lead.id]: data.summary ?? (data.has_reply ? '✓ Reply found.' : 'No reply found.') }))
      }
    } catch {
      setReplyResult(prev => ({ ...prev, [lead.id]: 'Error checking reply.' }))
    } finally {
      setCheckingReplyId(null)
    }
  }

  async function updateStatus(lead: Lead, status: string) {
    setUpdatingId(lead.id)
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l))
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleExtractFromLatest() {
    // Fetch latest completed search/read_page action for this project
    let actionId: string | null = null
    try {
      const res = await fetch(
        `/api/web-operator/actions?project_id=${projectId}&status=completed&limit=20`
      )
      if (res.ok) {
        const data = await res.json()
        const actions: Array<{ id: string; action_type: string; status: string }> = data.actions ?? []
        const match = actions.find(a =>
          a.status === 'completed' && ['search', 'read_page'].includes(a.action_type)
        )
        if (match) actionId = match.id
      }
    } catch {
      // non-fatal
    }

    if (!actionId) {
      setExtractResult({ count: -1, at: Date.now() })
      return
    }

    setExtractingAction(actionId)
    try {
      const res = await fetch('/api/leads/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web_operator_action_id: actionId, project_id: projectId }),
      })
      const data = await res.json()
      setExtractResult({ count: data.count ?? 0, at: Date.now() })
      await loadLeads()
    } catch {
      setExtractResult({ count: 0, at: Date.now() })
    } finally {
      setExtractingAction(null)
    }
  }

  async function handleManualAdd() {
    if (!manualForm.company_name.trim()) return
    setSavingManual(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          company_name: manualForm.company_name,
          website: manualForm.website || null,
          location: manualForm.location || null,
          category: manualForm.category || null,
          notes: manualForm.notes || null,
          created_by_role: 'manual',
          status: 'discovered',
        }),
      })
      setManualForm(BLANK_MANUAL)
      setShowManual(false)
      await loadLeads()
    } finally {
      setSavingManual(false)
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 10,
    padding: '12px 14px', marginBottom: 16,
  }

  const LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
  }

  return (
    <div>
      {/* Top controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          onClick={handleExtractFromLatest}
          disabled={!!extractingAction}
          style={{
            background: extractingAction ? '#e2e8f0' : '#0f172a',
            color: extractingAction ? '#94a3b8' : '#ffffff',
            border: 'none', borderRadius: 6, padding: '7px 14px',
            fontSize: 11, fontWeight: 600, cursor: extractingAction ? 'not-allowed' : 'pointer',
          }}
        >
          {extractingAction ? 'Extracting…' : 'Extract leads from latest research'}
        </button>
        {extractResult && (
          <span style={{
            fontSize: 11, padding: '7px 12px', borderRadius: 6,
            background: extractResult.count === -1 ? '#fef2f2' : '#f0fdf4',
            color: extractResult.count === -1 ? '#dc2626' : '#15803d',
            fontWeight: 500,
          }}>
            {extractResult.count === -1
              ? 'No completed research action found'
              : `${extractResult.count} lead${extractResult.count !== 1 ? 's' : ''} extracted`}
          </span>
        )}
        <button
          onClick={() => setShowManual(v => !v)}
          style={{
            background: '#f8fafc', color: '#374151',
            border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 14px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showManual ? 'Cancel' : '+ Add lead manually'}
        </button>
      </div>

      {/* Manual add form */}
      {showManual && (
        <div style={{ ...CARD, background: '#fafafa' }}>
          <div style={LABEL}>Add lead manually</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[
              { field: 'company_name', label: 'Company *', placeholder: 'Acme Corp' },
              { field: 'website', label: 'Website', placeholder: 'https://acme.com' },
              { field: 'location', label: 'Location', placeholder: 'Barcelona, Spain' },
              { field: 'category', label: 'Category', placeholder: 'parking operator' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{label}</div>
                <input
                  value={manualForm[field as keyof typeof manualForm]}
                  onChange={e => setManualForm(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={INPUT}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Notes</div>
            <textarea
              value={manualForm.notes}
              onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              style={{ ...INPUT, resize: 'vertical' }}
              placeholder="Any notes..."
            />
          </div>
          <button
            onClick={handleManualAdd}
            disabled={savingManual || !manualForm.company_name.trim()}
            style={{
              background: savingManual || !manualForm.company_name.trim() ? '#e2e8f0' : '#0f172a',
              color: savingManual || !manualForm.company_name.trim() ? '#94a3b8' : '#ffffff',
              border: 'none', borderRadius: 6, padding: '7px 14px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {savingManual ? 'Adding…' : 'Add lead'}
          </button>
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', marginBottom: 12 }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 12px', fontSize: 11,
              fontWeight: statusFilter === tab.value ? 600 : 400,
              color: statusFilter === tab.value ? '#0f172a' : '#94a3b8',
              borderBottom: statusFilter === tab.value ? '2px solid #0f172a' : '2px solid transparent',
              transition: 'color 0.1s',
            }}
          >
            {tab.label}
            <span style={{ marginLeft: 4, fontSize: 9, color: '#94a3b8' }}>
              ({tab.value === '' ? leads.length : leads.filter(l => l.status === tab.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* Lead cards */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</div>
      ) : filteredLeads.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>
          {statusFilter ? `No ${statusFilter.replace(/_/g, ' ')} leads.` : 'No leads yet for this project.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredLeads.map(lead => (
            <div key={lead.id} style={{
              background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 8,
              padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              {/* Score */}
              {lead.score !== null && (
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 6,
                  background: SCORE_COLOR(lead.score) + '18',
                  border: `1px solid ${SCORE_COLOR(lead.score)}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: SCORE_COLOR(lead.score),
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {lead.score}
                </div>
              )}

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                    {lead.company_name}
                  </span>
                  {lead.category && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, background: '#eef2ff', color: '#6366f1',
                      borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {lead.category}
                    </span>
                  )}
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    background: lead.status === 'approved' ? '#f0fdf4' : lead.status === 'rejected' ? '#fef2f2' : lead.status === 'needs_review' ? '#fffbeb' : '#f8fafc',
                    color: lead.status === 'approved' ? '#15803d' : lead.status === 'rejected' ? '#dc2626' : lead.status === 'needs_review' ? '#92400e' : '#64748b',
                    borderRadius: 3, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {lead.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                  {lead.location && (
                    <span style={{ fontSize: 10, color: '#64748b' }}>{lead.location}</span>
                  )}
                  {lead.website && (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                       target="_blank" rel="noopener noreferrer"
                       style={{ fontSize: 10, color: '#6366f1', textDecoration: 'none' }}>
                      {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                    </a>
                  )}
                </div>
                {lead.notes && (
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>
                    {lead.notes.slice(0, 80)}{lead.notes.length > 80 ? '…' : ''}
                  </div>
                )}
                {draftResult[lead.id] && (
                  <div style={{ fontSize: 10, color: '#6366f1', marginTop: 3, fontStyle: 'italic' }}>
                    {draftResult[lead.id]}
                  </div>
                )}
                {replyResult[lead.id] && (
                  <div style={{ fontSize: 10, color: '#0369a1', marginTop: 3, fontStyle: 'italic' }}>
                    📬 {replyResult[lead.id]}
                  </div>
                )}
                <LeadExecutionTrail leadId={lead.id} companyName={lead.company_name ?? undefined} />
              </div>

              {/* Approve / Reject / Gmail draft buttons */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                {lead.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(lead, 'approved')}
                    disabled={updatingId === lead.id}
                    style={{
                      background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                      borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                      cursor: updatingId === lead.id ? 'not-allowed' : 'pointer',
                      opacity: updatingId === lead.id ? 0.6 : 1,
                    }}
                  >
                    Approve
                  </button>
                )}
                {lead.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(lead, 'rejected')}
                    disabled={updatingId === lead.id}
                    style={{
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                      borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                      cursor: updatingId === lead.id ? 'not-allowed' : 'pointer',
                      opacity: updatingId === lead.id ? 0.6 : 1,
                    }}
                  >
                    Reject
                  </button>
                )}
                {/* Gmail draft button — approved leads */}
                {lead.status === 'approved' && lead.email && (
                  <button
                    onClick={() => prepareDraft(lead)}
                    disabled={draftingId === lead.id}
                    title={`Prepare Gmail draft to ${lead.email}`}
                    style={{
                      background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe',
                      borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                      cursor: draftingId === lead.id ? 'not-allowed' : 'pointer',
                      opacity: draftingId === lead.id ? 0.6 : 1,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {draftingId === lead.id ? '…' : '✉ Gmail draft'}
                  </button>
                )}
                {/* Find contact — approved lead with no email but has website */}
                {lead.status === 'approved' && !lead.email && (lead.website || lead.source_url) && (
                  <button
                    onClick={() => findContact(lead)}
                    disabled={draftingId === lead.id}
                    title="Ask Web Operator to find contact details on this website"
                    style={{
                      background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                      borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                      cursor: draftingId === lead.id ? 'not-allowed' : 'pointer',
                      opacity: draftingId === lead.id ? 0.6 : 1,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {draftingId === lead.id ? '…' : '🔍 Find contact'}
                  </button>
                )}
                {/* Check reply — any lead with an email */}
                {lead.email && (
                  <button
                    onClick={() => checkReply(lead)}
                    disabled={checkingReplyId === lead.id}
                    title={`Check Gmail for replies from ${lead.email} (browser-only)`}
                    style={{
                      background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd',
                      borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                      cursor: checkingReplyId === lead.id ? 'not-allowed' : 'pointer',
                      opacity: checkingReplyId === lead.id ? 0.6 : 1,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {checkingReplyId === lead.id ? '…' : '📬 Check reply'}
                  </button>
                )}
                {/* No email warning for approved leads */}
                {lead.status === 'approved' && !lead.email && !lead.website && !lead.source_url && (
                  <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
                    No email or website
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
