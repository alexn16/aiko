'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  status: string
  channel: string
  objective: string | null
  item_count?: number
  created_at: string
  latest_check_status?: string
  latest_check_score?: number
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

const READINESS_CHIP: Record<string, { background: string; color: string; label: string }> = {
  ready:           { background: '#dcfce7', color: '#15803d', label: 'Ready' },
  needs_attention: { background: '#fef3c7', color: '#b45309', label: 'Needs attention' },
  not_ready:       { background: '#fee2e2', color: '#dc2626', label: 'Not ready' },
  blocked:         { background: '#fecaca', color: '#991b1b', label: 'Blocked' },
  not_checked:     { background: '#f1f5f9', color: '#94a3b8', label: 'Not checked' },
}

export function ProjectCampaignsPanel({ projectId }: { projectId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns?project_id=${projectId}&limit=20`)
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchCampaigns()
  }, [fetchCampaigns])

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      const data = await res.json()
      if (data.error) {
        setGenError(data.error)
      } else if (data.campaign) {
        setCampaigns(prev => [data.campaign, ...prev])
      }
    } catch {
      setGenError('Failed to generate campaign')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
          Campaigns ({campaigns.length})
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link
            href="/campaigns"
            style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}
          >
            View all →
          </Link>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
              border: 'none', background: '#6366f1', color: '#ffffff', cursor: 'pointer',
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? 'Generating…' : 'Generate from approved'}
          </button>
        </div>
      </div>

      {/* Error */}
      {genError && (
        <div style={{
          fontSize: 11, color: '#dc2626', background: '#fee2e2',
          border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 10,
        }}>
          {genError}
        </div>
      )}

      {/* Safety note */}
      <div style={{
        fontSize: 11, color: '#64748b', background: '#f8fafc',
        border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', marginBottom: 12,
      }}>
        Campaign generation uses approved outputs and approval items from this project. No external sends.
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>
          No campaigns yet. Click &ldquo;Generate from approved&rdquo; to build one from approved assets.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {campaigns.map(c => {
            const statusBadge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft
            const channelBadge = CHANNEL_BADGE[c.channel] ?? CHANNEL_BADGE.manual
            return (
              <div key={c.id} style={{
                background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 8,
                padding: '10px 12px', borderLeft: `3px solid ${statusBadge.background}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </div>
                    {(() => {
                      const chip = READINESS_CHIP[c.latest_check_status ?? 'not_checked'] ?? READINESS_CHIP.not_checked
                      return (
                        <span style={{ ...chip, fontSize: 9, fontWeight: 600, borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                          {chip.label}
                        </span>
                      )
                    })()}
                  </div>
                  <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0, marginLeft: 8 }}>
                    {c.item_count ?? 0} items
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{ ...statusBadge, fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 6px' }}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                  <span style={{ ...channelBadge, fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '1px 6px' }}>
                    {c.channel}
                  </span>
                </div>
                {c.objective && (
                  <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                    {c.objective}
                  </div>
                )}
                <Link
                  href={`/campaigns/${c.id}`}
                  style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}
                >
                  View campaign →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
