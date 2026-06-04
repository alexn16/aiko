'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SystemCapability {
  id: string
  key: string
  name: string
  description: string
  status: 'available' | 'partial' | 'missing' | 'planned' | 'blocked'
  category: string
  required_for: string[]
}

interface ProposedChange {
  capability_key: string
  capability_name: string
  change_type: 'add' | 'extend' | 'fix'
  description: string
  estimated_complexity: 'simple' | 'moderate' | 'complex'
}

interface SystemImprovementProposal {
  id: string
  title: string
  summary: string
  reason: string
  requested_by_role: string
  related_project_id: string | null
  related_strategy: string | null
  missing_capabilities: string[]
  proposed_changes: ProposedChange[]
  risk_level: 'low' | 'medium' | 'high'
  status: 'draft' | 'pending_approval' | 'approved' | 'proposed' | 'approved_for_implementation' | 'implementation_in_progress' | 'implemented_pending_validation' | 'validated_available' | 'rejected' | 'implemented' | 'archived'
  implementation_prompt: string
  proposal_metadata?: {
    missing_capability_id?: string
    platform?: string
    capability_name?: string
    safety_rules?: string[]
    skill_spec?: {
      skill_id?: string
      allowed_actions?: string[]
      approval_required_actions?: string[]
      forbidden_actions?: string[]
    }
    playbook_spec?: {
      playbook_id?: string
      steps?: string[]
      approval_gates?: string[]
      forbidden_steps?: string[]
    }
    test_plan?: string[]
    runtime_validation_plan?: string[]
    implementation_prompt?: string
    lifecycle?: {
      approved_at?: string
      implementation_started_at?: string
      implemented_at?: string
      validated_at?: string
      validation_summary?: string
      validation_build_status?: string
      validation_test_status?: string
      implementation_branch?: string
      implementation_commit?: string
      implementation_pr_url?: string
      notes?: string
      checklist?: Record<string, boolean>
    }
  }
  created_at: string
  updated_at: string
  approved_at: string | null
  project_name?: string
}

interface CapabilityCheckResult {
  strategy_text: string
  required_capabilities: string[]
  available: SystemCapability[]
  partial: SystemCapability[]
  missing: SystemCapability[]
  planned: SystemCapability[]
  score: number
  gap_summary: string
}

// ── Status chip styles ─────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, React.CSSProperties> = {
  available: { background: '#dcfce7', color: '#16a34a' },
  partial:   { background: '#fef3c7', color: '#d97706' },
  missing:   { background: '#fee2e2', color: '#dc2626' },
  planned:   { background: '#dbeafe', color: '#1d4ed8' },
  blocked:   { background: '#fecaca', color: '#b91c1c' },
}

const RISK_CHIP: Record<string, React.CSSProperties> = {
  low:    { background: '#dcfce7', color: '#16a34a' },
  medium: { background: '#fef3c7', color: '#d97706' },
  high:   { background: '#fee2e2', color: '#dc2626' },
}

const PROPOSAL_STATUS_CHIP: Record<string, React.CSSProperties> = {
  draft:            { background: '#f1f5f9', color: '#64748b' },
  proposed:         { background: '#f1f5f9', color: '#64748b' },
  pending_approval: { background: '#fef3c7', color: '#d97706' },
  approved:         { background: '#dcfce7', color: '#16a34a' },
  approved_for_implementation: { background: '#dcfce7', color: '#16a34a' },
  implementation_in_progress: { background: '#dbeafe', color: '#1d4ed8' },
  implemented_pending_validation: { background: '#fef3c7', color: '#d97706' },
  validated_available: { background: '#dcfce7', color: '#15803d' },
  rejected:         { background: '#fee2e2', color: '#dc2626' },
  implemented:      { background: '#dbeafe', color: '#1d4ed8' },
  archived:         { background: '#f1f5f9', color: '#94a3b8' },
}

const CATEGORY_ORDER = [
  'product_system', 'research', 'leads', 'outreach',
  'email', 'browser', 'approvals', 'reporting', 'automation', 'integrations',
]

const PROPOSAL_GROUPS = [
  { label: 'Proposed', statuses: ['proposed', 'draft', 'pending_approval'] },
  { label: 'Approved', statuses: ['approved_for_implementation', 'approved'] },
  { label: 'In progress', statuses: ['implementation_in_progress'] },
  { label: 'Pending validation', statuses: ['implemented_pending_validation', 'implemented'] },
  { label: 'Validated', statuses: ['validated_available'] },
  { label: 'Rejected', statuses: ['rejected'] },
  { label: 'Archived', statuses: ['archived'] },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemPage() {
  const [capabilities, setCapabilities] = useState<SystemCapability[]>([])
  const [proposals, setProposals] = useState<SystemImprovementProposal[]>([])
  const [strategyText, setStrategyText] = useState('')
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkResult, setCheckResult] = useState<CapabilityCheckResult | null>(null)
  const [checkProposal, setCheckProposal] = useState<SystemImprovementProposal | null>(null)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  const [promptTextById, setPromptTextById] = useState<Record<string, string>>({})
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [proposalMessageById, setProposalMessageById] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    const [capRes, propRes] = await Promise.all([
      fetch('/api/system/capabilities'),
      fetch('/api/system/improvements'),
    ])
    const capData  = await capRes.json()
    const propData = await propRes.json()
    setCapabilities(capData.capabilities ?? [])
    setProposals(propData.proposals ?? [])
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    const proposalId = new URLSearchParams(window.location.search).get('proposal')
    if (proposalId) {
      setExpandedPrompts(prev => new Set(prev).add(proposalId))
      loadImplementationPrompt(proposalId)
    }
  }, [])

  async function loadImplementationPrompt(id: string) {
    if (promptTextById[id]) return
    try {
      const res = await fetch(`/api/system/improvements/${id}/implementation-prompt`)
      const data = await res.json()
      if (data?.prompt?.implementation_prompt) {
        setPromptTextById(prev => ({ ...prev, [id]: data.prompt.implementation_prompt }))
      }
    } catch {
      // keep existing prompt text if fetch fails
    }
  }

  async function copyPromptForCodex(p: SystemImprovementProposal) {
    const text = promptTextById[p.id] || p.proposal_metadata?.implementation_prompt || p.implementation_prompt
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedPromptId(p.id)
    setTimeout(() => setCopiedPromptId(current => current === p.id ? null : current), 1800)
  }

  // ── Check strategy ────────────────────────────────────────────────────────

  async function checkStrategy() {
    if (!strategyText.trim() || checkLoading) return
    setCheckLoading(true)
    setCheckResult(null)
    setCheckProposal(null)
    try {
      const res = await fetch('/api/system/check-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: strategyText, create_proposal: true }),
      })
      const data = await res.json()
      setCheckResult(data.check_result ?? null)
      setCheckProposal(data.proposal ?? null)
      if (data.proposal) {
        await loadData()
      }
    } catch {
      // ignore
    } finally {
      setCheckLoading(false)
    }
  }

  // ── Proposal lifecycle ───────────────────────────────────────────────────

  async function updateProposalAction(
    id: string,
    action: 'approve' | 'reject' | 'start_implementation' | 'mark_implemented' | 'validate_available',
    extra: Record<string, string | null | undefined> = {}
  ) {
    setProposalMessageById(prev => ({ ...prev, [id]: '' }))
    const res = await fetch(`/api/system/improvements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setProposalMessageById(prev => ({ ...prev, [id]: data.error ?? 'Could not update proposal.' }))
      return
    }
    setProposalMessageById(prev => ({ ...prev, [id]: 'Lifecycle updated.' }))
    await loadData()
  }

  async function markImplemented(p: SystemImprovementProposal) {
    const implementation_branch = window.prompt('Implementation branch (optional)', p.proposal_metadata?.lifecycle?.implementation_branch ?? '') ?? undefined
    const implementation_commit = window.prompt('Implementation commit (optional)', p.proposal_metadata?.lifecycle?.implementation_commit ?? '') ?? undefined
    const implementation_pr_url = window.prompt('Implementation PR URL (optional)', p.proposal_metadata?.lifecycle?.implementation_pr_url ?? '') ?? undefined
    const notes = window.prompt('Implementation notes (optional)', p.proposal_metadata?.lifecycle?.notes ?? '') ?? undefined
    await updateProposalAction(p.id, 'mark_implemented', {
      implementation_branch,
      implementation_commit,
      implementation_pr_url,
      notes,
    })
  }

  async function validateAvailable(p: SystemImprovementProposal) {
    const validation_summary = window.prompt('Validation summary is required. Include build/tests/runtime checks completed.', p.proposal_metadata?.lifecycle?.validation_summary ?? '')
    if (!validation_summary?.trim()) {
      setProposalMessageById(prev => ({ ...prev, [p.id]: 'Validation summary is required.' }))
      return
    }
    await updateProposalAction(p.id, 'validate_available', {
      validation_summary,
      validation_build_status: 'passed',
      validation_test_status: 'passed',
    })
  }

  // ── Group capabilities by category ────────────────────────────────────────

  const capsByCategory: Record<string, SystemCapability[]> = {}
  for (const cap of capabilities) {
    if (!capsByCategory[cap.category]) capsByCategory[cap.category] = []
    capsByCategory[cap.category].push(cap)
  }
  const sortedCategories = [
    ...CATEGORY_ORDER.filter(c => capsByCategory[c]),
    ...Object.keys(capsByCategory).filter(c => !CATEGORY_ORDER.includes(c)),
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>
          System Capabilities
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', lineHeight: 1.5 }}>
          What AÏKO can do and what it needs.
        </p>
      </div>

      {/* ── Section 1: Capability Map ──────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader label="Capability Map" />

        {sortedCategories.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8', padding: '20px 0' }}>
            No capabilities loaded. Run migration 019 to seed the capability map.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sortedCategories.map(cat => (
              <div key={cat}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 8,
                }}>
                  {cat.replace(/_/g, ' ')}
                </div>
                <div style={{
                  background: '#ffffff', border: '1px solid #f1f5f9',
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  {capsByCategory[cat].map((cap, i) => (
                    <div
                      key={cap.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 16px',
                        borderBottom: i < capsByCategory[cat].length - 1 ? '1px solid #f8fafc' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                            {cap.name}
                          </span>
                          <StatusChip status={cap.status} />
                          <span style={{
                            fontSize: 9, color: '#94a3b8', background: '#f8fafc',
                            borderRadius: 3, padding: '1px 5px', fontWeight: 500,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>
                            {cap.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, lineHeight: 1.5 }}>
                          {cap.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Strategy Capability Check ──────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader label="Strategy Capability Check" />

        <div style={{
          background: '#ffffff', border: '1px solid #f1f5f9',
          borderRadius: 10, padding: '20px',
        }}>
          <textarea
            value={strategyText}
            onChange={e => setStrategyText(e.target.value)}
            placeholder="Describe a strategy or campaign goal..."
            rows={3}
            style={{
              width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '10px 12px', fontSize: 13, color: '#0f172a',
              resize: 'vertical', lineHeight: 1.55, outline: 'none',
              fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
              background: '#f8fafc',
            }}
            onFocus={e => { e.target.style.borderColor = '#6366f1' }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
          />
          <button
            onClick={checkStrategy}
            disabled={!strategyText.trim() || checkLoading}
            style={{
              marginTop: 10,
              background: !strategyText.trim() || checkLoading ? '#f1f5f9' : '#0f172a',
              color: !strategyText.trim() || checkLoading ? '#94a3b8' : '#ffffff',
              border: 'none', borderRadius: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              cursor: !strategyText.trim() || checkLoading ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {checkLoading ? 'Checking capabilities...' : 'Check what AÏKO needs'}
          </button>

          {checkResult && (
            <div style={{ marginTop: 20 }}>
              {/* Score */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8,
                background: checkResult.score >= 80 ? '#dcfce7' : checkResult.score >= 50 ? '#fef3c7' : '#fee2e2',
                border: `1px solid ${checkResult.score >= 80 ? '#bbf7d0' : checkResult.score >= 50 ? '#fde68a' : '#fecaca'}`,
                marginBottom: 16,
              }}>
                <span style={{
                  fontSize: 20, fontWeight: 700,
                  color: checkResult.score >= 80 ? '#16a34a' : checkResult.score >= 50 ? '#d97706' : '#dc2626',
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {checkResult.score}%
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: checkResult.score >= 80 ? '#16a34a' : checkResult.score >= 50 ? '#d97706' : '#dc2626',
                }}>
                  capability match
                </span>
              </div>

              {/* Available */}
              {checkResult.available.length > 0 && (
                <CapabilityResultGroup
                  label="Available"
                  items={checkResult.available}
                  color="#16a34a"
                  bg="#dcfce7"
                />
              )}

              {/* Partial */}
              {checkResult.partial.length > 0 && (
                <CapabilityResultGroup
                  label="Partial"
                  items={checkResult.partial}
                  color="#d97706"
                  bg="#fef3c7"
                />
              )}

              {/* Missing */}
              {checkResult.missing.length > 0 && (
                <CapabilityResultGroup
                  label="Missing"
                  items={checkResult.missing}
                  color="#dc2626"
                  bg="#fee2e2"
                />
              )}

              {/* Gap summary */}
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: '#f8fafc', borderRadius: 7, border: '1px solid #f1f5f9',
                fontSize: 12, color: '#374151', lineHeight: 1.6,
              }}>
                {checkResult.gap_summary}
              </div>

              {/* Proposal link */}
              {checkProposal && (
                <div style={{ marginTop: 12 }}>
                  <Link
                    href="/system"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 500, color: '#6366f1',
                      textDecoration: 'none',
                      background: '#eef2ff', borderRadius: 6, padding: '5px 10px',
                    }}
                    onClick={e => {
                      e.preventDefault()
                      document.getElementById('proposals-section')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    Improvement proposal created &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Improvement Proposals ──────────────────────────────── */}
      <section id="proposals-section">
        <SectionHeader label="Improvement Proposals" />

        {proposals.length === 0 ? (
          <div style={{
            background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 10,
            padding: '32px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              No improvement proposals yet. Use the strategy checker above to generate one.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {PROPOSAL_GROUPS.map(group => {
              const groupProposals = proposals.filter(p => group.statuses.includes(p.status))
              if (groupProposals.length === 0) return null
              return (
                <div key={group.label}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 8,
                  }}>
                    {group.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupProposals.map(p => {
              const promptExpanded = expandedPrompts.has(p.id)
              const promptText = promptTextById[p.id] || p.proposal_metadata?.implementation_prompt || p.implementation_prompt
              const safetyRules = p.proposal_metadata?.safety_rules ?? []
              const forbiddenActions = p.proposal_metadata?.skill_spec?.forbidden_actions ?? p.proposal_metadata?.playbook_spec?.forbidden_steps ?? []
              const approvalActions = p.proposal_metadata?.skill_spec?.approval_required_actions ?? p.proposal_metadata?.playbook_spec?.approval_gates ?? []
              const lifecycle = p.proposal_metadata?.lifecycle ?? {}
              const checklist = lifecycle.checklist ?? {}
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#ffffff', border: '1px solid #f1f5f9',
                    borderRadius: 10, padding: '16px 18px',
                  }}
                >
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', flex: 1, minWidth: 200 }}>
                      {p.title}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                      <Chip label={p.status.replace(/_/g, ' ')} style={PROPOSAL_STATUS_CHIP[p.status] ?? {}} />
                      <Chip label={p.risk_level} style={RISK_CHIP[p.risk_level] ?? {}} />
                    </div>
                  </div>

                  {/* Summary */}
                  {p.summary && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 1.55 }}>
                      {p.summary}
                    </div>
                  )}

                  {proposalMessageById[p.id] && (
                    <div style={{
                      marginBottom: 10, padding: '8px 10px',
                      background: proposalMessageById[p.id].includes('Cannot') || proposalMessageById[p.id].includes('required') || proposalMessageById[p.id].includes('Could not') ? '#fef2f2' : '#f0fdf4',
                      border: `1px solid ${proposalMessageById[p.id].includes('Cannot') || proposalMessageById[p.id].includes('required') || proposalMessageById[p.id].includes('Could not') ? '#fecaca' : '#bbf7d0'}`,
                      borderRadius: 7,
                      fontSize: 11,
                      color: proposalMessageById[p.id].includes('Cannot') || proposalMessageById[p.id].includes('required') || proposalMessageById[p.id].includes('Could not') ? '#991b1b' : '#166534',
                    }}>
                      {proposalMessageById[p.id]}
                    </div>
                  )}

                  {/* Related project */}
                  {p.project_name && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                      Project: {p.project_name}
                    </div>
                  )}

                  {/* Structured metadata */}
                  {(p.proposal_metadata?.platform || p.proposal_metadata?.skill_spec?.skill_id || p.proposal_metadata?.playbook_spec?.playbook_id) && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: 8, marginBottom: 10,
                      fontSize: 11, color: '#475569',
                    }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 7, padding: '8px 10px' }}>
                        <b>Platform:</b> {p.proposal_metadata?.platform ?? 'Unknown'}
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 7, padding: '8px 10px' }}>
                        <b>Skill:</b> {p.proposal_metadata?.skill_spec?.skill_id ?? 'Not specified'}
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 7, padding: '8px 10px' }}>
                        <b>Playbook:</b> {p.proposal_metadata?.playbook_spec?.playbook_id ?? 'Not specified'}
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 7, padding: '8px 10px' }}>
                        <b>Missing:</b> {p.proposal_metadata?.missing_capability_id ?? p.missing_capabilities[0] ?? 'Not specified'}
                      </div>
                    </div>
                  )}

                  {/* Missing capabilities chips */}
                  {p.missing_capabilities.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {p.missing_capabilities.map(key => (
                        <span key={key} style={{
                          fontSize: 10, background: '#fee2e2', color: '#dc2626',
                          borderRadius: 4, padding: '2px 7px', fontWeight: 500,
                        }}>
                          {key}
                        </span>
                      ))}
                    </div>
                  )}

                  {(safetyRules.length > 0 || approvalActions.length > 0 || forbiddenActions.length > 0) && (
                    <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {safetyRules.length > 0 && (
                        <div style={{ fontSize: 11, color: '#475569' }}>
                          <b>Safety rules:</b> {safetyRules.slice(0, 5).join(', ')}
                        </div>
                      )}
                      {approvalActions.length > 0 && (
                        <div style={{ fontSize: 11, color: '#475569' }}>
                          <b>Approval required:</b> {approvalActions.slice(0, 6).join(', ')}
                        </div>
                      )}
                      {forbiddenActions.length > 0 && (
                        <div style={{ fontSize: 11, color: '#991b1b' }}>
                          <b>Forbidden:</b> {forbiddenActions.slice(0, 6).join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* View implementation prompt toggle */}
                  {promptText && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            setExpandedPrompts(prev => {
                              const next = new Set(prev)
                              if (next.has(p.id)) next.delete(p.id)
                              else next.add(p.id)
                              return next
                            })
                            if (!promptExpanded) loadImplementationPrompt(p.id)
                          }}
                          style={{
                            background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
                            fontSize: 11, color: '#64748b', padding: '4px 10px', cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {promptExpanded ? 'Hide implementation prompt' : 'View implementation prompt'}
                        </button>
                        <button
                          onClick={() => copyPromptForCodex(p)}
                          style={{
                            background: '#0f172a', border: '1px solid #0f172a', borderRadius: 6,
                            fontSize: 11, color: '#ffffff', padding: '4px 10px', cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {copiedPromptId === p.id ? 'Copied' : 'Copy prompt for Codex'}
                        </button>
                      </div>
                      {promptExpanded && (
                        <div style={{
                          marginTop: 10, padding: '12px 14px',
                          background: '#f8fafc', borderRadius: 7,
                          border: '1px solid #f1f5f9',
                          fontSize: 12, color: '#374151', lineHeight: 1.7,
                          whiteSpace: 'pre-wrap', fontFamily: 'DM Mono, monospace',
                        }}>
                          {promptText}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Implementation handoff */}
                  {(p.status === 'approved_for_implementation' || p.status === 'approved' || p.status === 'implementation_in_progress' || p.status === 'implemented_pending_validation' || p.status === 'implemented') && (
                    <div style={{
                      marginBottom: 10,
                      padding: '10px 12px',
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Implementation Handoff
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: '#475569', marginBottom: 8 }}>
                        <div><b>Branch:</b> {lifecycle.implementation_branch || 'Not recorded'}</div>
                        <div><b>Commit:</b> {lifecycle.implementation_commit || 'Not recorded'}</div>
                        <div><b>PR:</b> {lifecycle.implementation_pr_url || 'Not recorded'}</div>
                        <div><b>Notes:</b> {lifecycle.notes || 'Not recorded'}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 11, color: '#475569' }}>
                        {[
                          ['code_implemented_externally', 'code implemented externally'],
                          ['tests_passed', 'tests passed'],
                          ['build_passed', 'build passed'],
                          ['runtime_validated', 'runtime validated'],
                          ['docs_updated', 'docs updated'],
                        ].map(([key, label]) => (
                          <span key={key}>
                            {checklist[key] ? '✓' : '○'} {label}
                          </span>
                        ))}
                      </div>
                      {lifecycle.validation_summary && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
                          <b>Validation:</b> {lifecycle.validation_summary}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lifecycle buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(p.status === 'draft' || p.status === 'proposed' || p.status === 'pending_approval') && (
                      <>
                      <button
                        onClick={() => updateProposalAction(p.id, 'approve')}
                        style={{
                          background: '#0f172a', color: '#ffffff', border: 'none',
                          borderRadius: 6, padding: '6px 14px', fontSize: 12,
                          fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Approve implementation
                      </button>
                      <button
                        onClick={() => updateProposalAction(p.id, 'reject', { notes: window.prompt('Reject reason (optional)', '') ?? undefined })}
                        style={{
                          background: '#fef2f2', color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: 6, padding: '6px 14px', fontSize: 12,
                          fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Reject
                      </button>
                      </>
                    )}
                    {(p.status === 'approved_for_implementation' || p.status === 'approved') && (
                      <button
                        onClick={() => updateProposalAction(p.id, 'start_implementation', { notes: window.prompt('Implementation notes (optional)', '') ?? undefined })}
                        style={{
                          background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe',
                          borderRadius: 6, padding: '6px 14px', fontSize: 12,
                          fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Mark implementation started
                      </button>
                    )}
                    {p.status === 'implementation_in_progress' && (
                      <button
                        onClick={() => markImplemented(p)}
                        style={{
                          background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                          borderRadius: 6, padding: '6px 14px', fontSize: 12,
                          fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Mark implemented / ready for validation
                      </button>
                    )}
                    {(p.status === 'implemented_pending_validation' || p.status === 'implemented') && (
                      <button
                        onClick={() => validateAvailable(p)}
                        style={{
                          background: '#16a34a', color: '#ffffff', border: 'none',
                          borderRadius: 6, padding: '6px 14px', fontSize: 12,
                          fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        Mark validated available
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      marginBottom: 12,
    }}>
      {label}
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const style = STATUS_CHIP[status] ?? { background: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{
      fontSize: 10, borderRadius: 4, padding: '2px 7px', fontWeight: 600,
      ...style,
    }}>
      {status}
    </span>
  )
}

function Chip({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 10, borderRadius: 4, padding: '2px 7px', fontWeight: 600,
      ...style,
    }}>
      {label}
    </span>
  )
}

function CapabilityResultGroup({
  label, items, color, bg,
}: {
  label: string
  items: SystemCapability[]
  color: string
  bg: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>
        {label} ({items.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map(cap => (
          <div key={cap.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 6, background: bg,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{cap.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
