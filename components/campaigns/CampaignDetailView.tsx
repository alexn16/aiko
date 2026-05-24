'use client'
import { useState, useEffect } from 'react'

interface Campaign {
  id: string
  project_id: string | null
  name: string
  objective: string | null
  audience: string | null
  channel: string
  status: string
  owner_role: string
  strategy_summary: string | null
  success_metric: string | null
  created_at: string
  updated_at: string
  project_name?: string
  item_count?: number
}

interface CampaignItem {
  id: string
  campaign_id: string
  approval_item_id: string | null
  output_id: string | null
  task_id: string | null
  item_type: string
  title: string
  content: string
  sequence_order: number
  status: string
  created_at: string
}

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  draft:             { background: '#f1f5f9', color: '#64748b' },
  ready_for_review:  { background: '#fef3c7', color: '#d97706' },
  approved:          { background: '#dcfce7', color: '#16a34a' },
  active:            { background: '#dbeafe', color: '#1d4ed8' },
  paused:            { background: '#fed7aa', color: '#ea580c' },
  completed:         { background: '#d1fae5', color: '#065f46' },
  archived:          { background: '#f1f5f9', color: '#94a3b8' },
}

const CHANNEL_BADGE: Record<string, { background: string; color: string }> = {
  email:     { background: '#dbeafe', color: '#1d4ed8' },
  linkedin:  { background: '#e0e7ff', color: '#4338ca' },
  instagram: { background: '#fce7f3', color: '#be185d' },
  content:   { background: '#dcfce7', color: '#15803d' },
  mixed:     { background: '#f3e8ff', color: '#7c3aed' },
  manual:    { background: '#f1f5f9', color: '#64748b' },
}

interface LaunchCheck {
  key: string
  label: string
  passed: boolean
  required: boolean
  note?: string
}

interface CampaignLaunchCheckResult {
  id: string
  campaign_id: string
  project_id: string | null
  status: string
  readiness_score: number
  checks: LaunchCheck[]
  blockers: string[]
  warnings: string[]
  recommended_actions: string[]
  summary: string
  created_at: string
}

const READINESS_BADGE: Record<string, { background: string; color: string; label: string }> = {
  ready:           { background: '#dcfce7', color: '#15803d', label: 'Ready' },
  needs_attention: { background: '#fef3c7', color: '#b45309', label: 'Needs attention' },
  not_ready:       { background: '#fee2e2', color: '#dc2626', label: 'Not ready' },
  blocked:         { background: '#fecaca', color: '#991b1b', label: 'Blocked' },
}

function LaunchReadinessPanel({ campaignId }: { campaignId: string }) {
  const [latestCheck, setLatestCheck] = useState<CampaignLaunchCheckResult | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/launch-checks`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.checks) && d.checks.length > 0) {
          setLatestCheck(d.checks[0])
        }
      })
      .catch(() => {})
  }, [campaignId])

  async function runCheck() {
    setRunning(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/launch-checks`, { method: 'POST' })
      const data = await res.json()
      if (data.check) setLatestCheck(data.check)
    } catch {
      // silently fail
    } finally {
      setRunning(false)
    }
  }

  const badge = latestCheck ? (READINESS_BADGE[latestCheck.status] ?? READINESS_BADGE.not_ready) : null

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 10,
      padding: '16px 18px', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>
          Launch Readiness
        </div>
        <button
          onClick={runCheck}
          disabled={running}
          style={{
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
            border: 'none', background: '#6366f1', color: '#ffffff', cursor: 'pointer',
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? 'Checking…' : latestCheck ? 'Run again' : 'Run readiness check'}
        </button>
      </div>

      {!latestCheck ? (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
          No readiness check has been run yet. Click &ldquo;Run readiness check&rdquo; to evaluate this campaign.
        </div>
      ) : (
        <div>
          {/* Status badge + score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{
              ...badge,
              fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 10px',
            }}>
              {badge?.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
                {latestCheck.readiness_score}
              </span>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>/100</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 6, borderRadius: 4, background: '#f1f5f9', marginBottom: 14, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${latestCheck.readiness_score}%`,
              background: latestCheck.readiness_score >= 80 ? '#16a34a'
                : latestCheck.readiness_score >= 50 ? '#d97706' : '#dc2626',
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Summary */}
          {latestCheck.summary && (
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>
              {latestCheck.summary}
            </div>
          )}

          {/* Safety microcopy */}
          <div style={{
            fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 6, padding: '7px 10px', marginBottom: 14, fontStyle: 'italic',
          }}>
            Readiness does not launch or send this campaign. It only verifies whether the campaign is safe and prepared for a future explicit launch step.
          </div>

          {/* Blockers */}
          {latestCheck.blockers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Blockers ({latestCheck.blockers.length})
              </div>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {latestCheck.blockers.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#991b1b' }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>✗</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {latestCheck.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Warnings ({latestCheck.warnings.length})
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {latestCheck.warnings.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#92400e' }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended actions */}
          {latestCheck.recommended_actions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recommended actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {latestCheck.recommended_actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151' }}>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: '#6366f1' }}>{i + 1}.</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Checklist
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {latestCheck.checks.map(check => (
                <div key={check.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12,
                  padding: '5px 8px', borderRadius: 5,
                  background: check.passed ? '#f0fdf4' : check.required ? '#fff1f2' : '#fafafa',
                }}>
                  <span style={{
                    flexShrink: 0, fontWeight: 700, fontSize: 13, marginTop: -1,
                    color: check.passed ? '#16a34a' : check.required ? '#dc2626' : '#94a3b8',
                  }}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <div>
                    <span style={{ color: check.passed ? '#15803d' : check.required ? '#991b1b' : '#64748b', fontWeight: 500 }}>
                      {check.label}
                    </span>
                    {!check.required && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(optional)</span>
                    )}
                    {check.note && (
                      <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>{check.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ITEM_TYPE_BADGE: Record<string, { background: string; color: string }> = {
  outreach_draft:    { background: '#dbeafe', color: '#1d4ed8' },
  note:              { background: '#f1f5f9', color: '#64748b' },
  campaign_proposal: { background: '#e0e7ff', color: '#4338ca' },
  report:            { background: '#dcfce7', color: '#15803d' },
  research_brief:    { background: '#fce7f3', color: '#be185d' },
  lead_list:         { background: '#fef3c7', color: '#d97706' },
  qa_review:         { background: '#f3e8ff', color: '#7c3aed' },
}

function ItemCard({
  item,
  onItemUpdate,
}: {
  item: CampaignItem
  onItemUpdate: (id: string, fields: { status?: string }) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const typeBadge = ITEM_TYPE_BADGE[item.item_type] ?? { background: '#f1f5f9', color: '#64748b' }
  const statusBadge = STATUS_BADGE[item.status] ?? STATUS_BADGE.draft

  async function markUsed() {
    setLoading(true)
    await onItemUpdate(item.id, { status: 'used' })
    setLoading(false)
  }

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 8,
      padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: '#f8fafc',
          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8', flexShrink: 0,
        }}>
          {item.sequence_order}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...typeBadge, fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '1px 6px' }}>
              {item.item_type.replace(/_/g, ' ')}
            </span>
            <span style={{ ...statusBadge, fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '1px 6px' }}>
              {item.status}
            </span>
          </div>
        </div>
      </div>

      {!expanded ? (
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, marginLeft: 32, marginBottom: 6 }}>
          {item.content.slice(0, 100)}{item.content.length > 100 ? '…' : ''}
        </div>
      ) : (
        <div style={{
          fontSize: 11, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          background: '#fafafa', padding: '8px 10px', borderRadius: 5,
          border: '1px solid #f1f5f9', marginLeft: 32, marginBottom: 6,
        }}>
          {item.content || '(no content)'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginLeft: 32, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            fontSize: 11, color: '#6366f1', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0,
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
        {item.status !== 'used' && (
          <button
            onClick={markUsed}
            disabled={loading}
            style={{
              fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
              border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b',
              cursor: 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            Mark used
          </button>
        )}
      </div>
    </div>
  )
}

export function CampaignDetailView({
  campaign: initialCampaign,
  items: initialItems,
}: {
  campaign: Campaign
  items: CampaignItem[]
}) {
  const [campaign, setCampaign] = useState(initialCampaign)
  const [items, setItems] = useState(initialItems)
  const [addOutputId, setAddOutputId] = useState('')
  const [addApprovalId, setAddApprovalId] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addConfirm, setAddConfirm] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  const statusBadge = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.draft
  const channelBadge = CHANNEL_BADGE[campaign.channel] ?? CHANNEL_BADGE.manual

  async function patchStatus(newStatus: string) {
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.campaign) setCampaign(data.campaign)
    } catch {
      // silently fail
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleItemUpdate(itemId: string, fields: { status?: string }) {
    try {
      await fetch(`/api/campaigns/${campaign.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...fields } : i))
    } catch {
      // silently fail
    }
  }

  async function handleAddItem() {
    if (!addOutputId.trim() && !addApprovalId.trim()) return
    setAddLoading(true)
    try {
      const body = addOutputId.trim()
        ? { output_id: addOutputId.trim() }
        : { approval_item_id: addApprovalId.trim() }

      const res = await fetch(`/api/campaigns/${campaign.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.item) {
        setItems(prev => [...prev, data.item])
        setAddOutputId('')
        setAddApprovalId('')
        setAddConfirm(true)
        setTimeout(() => setAddConfirm(false), 3000)
      }
    } catch {
      // silently fail
    } finally {
      setAddLoading(false)
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff', border: '1px solid #f1f5f9',
    borderRadius: 10, padding: '16px 18px',
  }

  const LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 820 }}>

      {/* Campaign header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0, flex: 1 }}>
            {campaign.name}
          </h1>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...statusBadge, fontSize: 11, fontWeight: 600, borderRadius: 5, padding: '3px 8px' }}>
              {campaign.status.replace(/_/g, ' ')}
            </span>
            <span style={{ ...channelBadge, fontSize: 11, fontWeight: 500, borderRadius: 5, padding: '3px 8px' }}>
              {campaign.channel}
            </span>
          </div>
        </div>
        {campaign.project_name && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{campaign.project_name}</div>
        )}
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {campaign.objective && (
          <div style={CARD}>
            <div style={LABEL}>Objective</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{campaign.objective}</div>
          </div>
        )}
        {campaign.audience && (
          <div style={CARD}>
            <div style={LABEL}>Audience</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{campaign.audience}</div>
          </div>
        )}
        {campaign.success_metric && (
          <div style={CARD}>
            <div style={LABEL}>Success metric</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{campaign.success_metric}</div>
          </div>
        )}
        <div style={CARD}>
          <div style={LABEL}>Owner role</div>
          <div style={{ fontSize: 13, color: '#374151' }}>{campaign.owner_role}</div>
        </div>
      </div>

      {/* Strategy summary */}
      {campaign.strategy_summary && (
        <div style={{ ...CARD, marginBottom: 24 }}>
          <div style={LABEL}>Strategy</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{campaign.strategy_summary}</div>
        </div>
      )}

      {/* Campaign items */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.01em' }}>
          Campaign items ({items.length})
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '16px 0' }}>
            No items yet. Add approved outputs or approval items below.
          </div>
        ) : (
          items.map(item => (
            <ItemCard key={item.id} item={item} onItemUpdate={handleItemUpdate} />
          ))
        )}
      </div>

      {/* Launch Readiness */}
      <LaunchReadinessPanel campaignId={campaign.id} />

      {/* Add item section */}
      <div style={{ ...CARD, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
          Add approved output
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Output ID (from agent task outputs)
            </label>
            <input
              value={addOutputId}
              onChange={e => setAddOutputId(e.target.value)}
              placeholder="UUID of approved output…"
              style={{
                width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 6,
                border: '1px solid #e2e8f0', outline: 'none', color: '#374151',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>or</div>
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Approval item ID (from Approval Center)
            </label>
            <input
              value={addApprovalId}
              onChange={e => setAddApprovalId(e.target.value)}
              placeholder="UUID of approved approval item…"
              style={{
                width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 6,
                border: '1px solid #e2e8f0', outline: 'none', color: '#374151',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleAddItem}
              disabled={addLoading || (!addOutputId.trim() && !addApprovalId.trim())}
              style={{
                fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 6,
                border: 'none', background: '#6366f1', color: '#ffffff', cursor: 'pointer',
                opacity: addLoading || (!addOutputId.trim() && !addApprovalId.trim()) ? 0.5 : 1,
              }}
            >
              {addLoading ? 'Adding…' : 'Add to campaign'}
            </button>
            {addConfirm && (
              <span style={{ fontSize: 12, color: '#16a34a' }}>Added successfully</span>
            )}
          </div>
        </div>
      </div>

      {/* Status controls */}
      <div style={{
        ...CARD,
        borderTop: '2px solid #f1f5f9', marginBottom: 24,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginRight: 4 }}>Status:</span>
        {campaign.status === 'draft' && (
          <button
            onClick={() => patchStatus('ready_for_review')}
            disabled={statusLoading}
            style={{
              fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 6,
              border: '1px solid #fde68a', background: '#fef9c3', color: '#b45309',
              cursor: 'pointer', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            Mark ready for review
          </button>
        )}
        {campaign.status === 'ready_for_review' && (
          <button
            onClick={() => patchStatus('approved')}
            disabled={statusLoading}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              border: 'none', background: '#16a34a', color: '#ffffff',
              cursor: 'pointer', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            Approve campaign
          </button>
        )}
        {campaign.status === 'approved' && (
          <button
            onClick={() => patchStatus('active')}
            disabled={statusLoading}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              border: 'none', background: '#1d4ed8', color: '#ffffff',
              cursor: 'pointer', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            Mark active
          </button>
        )}
        {campaign.status === 'active' && (
          <button
            onClick={() => patchStatus('paused')}
            disabled={statusLoading}
            style={{
              fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 6,
              border: '1px solid #e2e8f0', background: '#fff7ed', color: '#ea580c',
              cursor: 'pointer', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            Pause
          </button>
        )}
        {campaign.status === 'paused' && (
          <button
            onClick={() => patchStatus('active')}
            disabled={statusLoading}
            style={{
              fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 6,
              border: '1px solid #dbeafe', background: '#eff6ff', color: '#1d4ed8',
              cursor: 'pointer', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            Resume
          </button>
        )}
        {['active', 'approved', 'completed'].includes(campaign.status) && (
          <button
            onClick={() => patchStatus('completed')}
            disabled={statusLoading || campaign.status === 'completed'}
            style={{
              fontSize: 12, fontWeight: 500, padding: '6px 12px', borderRadius: 6,
              border: '1px solid #d1fae5', background: '#ecfdf5', color: '#065f46',
              cursor: 'pointer', opacity: statusLoading || campaign.status === 'completed' ? 0.5 : 1,
            }}
          >
            Mark completed
          </button>
        )}
        {campaign.status !== 'archived' && (
          <button
            onClick={() => patchStatus('archived')}
            disabled={statusLoading}
            style={{
              fontSize: 12, fontWeight: 400, padding: '6px 12px', borderRadius: 6,
              border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8',
              cursor: 'pointer', opacity: statusLoading ? 0.6 : 1,
            }}
          >
            Archive
          </button>
        )}
      </div>

      {/* Safety footer */}
      <div style={{
        fontSize: 11, color: '#94a3b8', fontStyle: 'italic',
        borderTop: '1px solid #f1f5f9', paddingTop: 14,
      }}>
        Campaign approval does not send anything externally. Launching/sending will require a separate explicit action.
      </div>
    </div>
  )
}
