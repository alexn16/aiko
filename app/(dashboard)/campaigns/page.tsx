'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

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
  stats?: { sent: number; opened: number; replied: number; qualified: number }
  created_at: string
  updated_at: string
  project_name?: string
  item_count?: number
  latest_check_status?: string
  latest_check_score?: number
}

interface Project {
  id: string
  name: string
}

type FilterTab = 'all' | 'draft' | 'ready_for_review' | 'approved' | 'active' | 'completed'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'draft',            label: 'Draft' },
  { id: 'ready_for_review', label: 'Ready for Review' },
  { id: 'approved',         label: 'Approved' },
  { id: 'active',           label: 'Active' },
  { id: 'completed',        label: 'Completed' },
]

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
  multi:     { background: '#f3e8ff', color: '#7c3aed' },
}

const READINESS_CHIP: Record<string, { background: string; color: string; label: string }> = {
  ready:           { background: '#dcfce7', color: '#15803d', label: 'Ready' },
  needs_attention: { background: '#fef3c7', color: '#b45309', label: 'Needs attention' },
  not_ready:       { background: '#fee2e2', color: '#dc2626', label: 'Not ready' },
  blocked:         { background: '#fecaca', color: '#991b1b', label: 'Blocked' },
  not_checked:     { background: '#f1f5f9', color: '#94a3b8', label: 'Not checked' },
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function CampaignCard({
  campaign,
  onStatusChange,
}: {
  campaign: Campaign
  onStatusChange: (id: string, status: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const statusBadge = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.archived
  const channelBadge = CHANNEL_BADGE[campaign.channel] ?? CHANNEL_BADGE.manual

  async function handleStatus(newStatus: string) {
    setLoading(true)
    await onStatusChange(campaign.id, newStatus)
    setLoading(false)
  }

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #f1f5f9',
      borderRadius: 10,
      padding: '16px 18px',
      borderLeft: `3px solid ${statusBadge.background}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 5 }}>
            {campaign.name}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...statusBadge, fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px' }}>
              {campaign.status.replace(/_/g, ' ')}
            </span>
            <span style={{ ...channelBadge, fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 7px' }}>
              {campaign.channel}
            </span>
            {(() => {
              const chip = READINESS_CHIP[campaign.latest_check_status ?? 'not_checked'] ?? READINESS_CHIP.not_checked
              return (
                <span style={{ ...chip, fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 7px' }}>
                  {chip.label}{campaign.latest_check_score != null && campaign.latest_check_status ? ` · ${campaign.latest_check_score}` : ''}
                </span>
              )
            })()}
          </div>
        </div>
        <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0, marginLeft: 8 }}>
          {timeAgo(campaign.created_at)}
        </span>
      </div>

      {campaign.objective && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campaign.objective}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {campaign.project_name && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{campaign.project_name}</span>
        )}
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          {campaign.item_count ?? 0} item{campaign.item_count !== 1 ? 's' : ''}
        </span>
        {campaign.success_metric && (
          <span style={{
            fontSize: 10, color: '#94a3b8', fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
          }}>
            {campaign.success_metric}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link
          href={`/campaigns/${campaign.id}`}
          style={{
            fontSize: 11, fontWeight: 500, color: '#6366f1', textDecoration: 'none',
            padding: '4px 10px', borderRadius: 5, border: '1px solid #e0e7ff',
            background: '#eef2ff',
          }}
        >
          View
        </Link>
        {campaign.status === 'draft' && (
          <button
            onClick={() => handleStatus('ready_for_review')}
            disabled={loading}
            style={{
              fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 5,
              border: '1px solid #fde68a', background: '#fef9c3', color: '#b45309',
              cursor: 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            Mark ready for review
          </button>
        )}
        {campaign.status === 'ready_for_review' && (
          <button
            onClick={() => handleStatus('approved')}
            disabled={loading}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5,
              border: 'none', background: '#16a34a', color: '#ffffff',
              cursor: 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            Approve campaign
          </button>
        )}
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [projects, setProjects] = useState<Project[]>([])
  const [generating, setGenerating] = useState(false)
  const [generateProjectId, setGenerateProjectId] = useState<string>('')

  const fetchCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      if (projectFilter !== 'all') params.set('project_id', projectFilter)
      params.set('limit', '100')
      const res = await fetch(`/api/campaigns?${params}`)
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [activeTab, projectFilter])

  useEffect(() => {
    setLoading(true)
    fetchCampaigns()
  }, [fetchCampaigns])

  // 30s auto-refresh
  useEffect(() => {
    const id = setInterval(fetchCampaigns, 30_000)
    return () => clearInterval(id)
  }, [fetchCampaigns])

  // Load projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => {
        if (d.projects) {
          setProjects(d.projects)
          if (d.projects[0]?.id) setGenerateProjectId(d.projects[0].id)
        }
      })
      .catch(() => {})
  }, [])

  async function handleStatusChange(id: string, status: string) {
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    } catch {
      // silently fail
    }
  }

  async function handleGenerate() {
    const pid = generateProjectId || projects[0]?.id
    if (!pid) return
    setGenerating(true)
    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: pid }),
      })
      const data = await res.json()
      if (data.campaign) {
        setCampaigns(prev => [data.campaign, ...prev])
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false)
    }
  }

  const filtered = activeTab === 'all' ? campaigns : campaigns.filter(c => c.status === activeTab)

  return (
    <div style={{ padding: '40px 32px', maxWidth: 820 }} className="page-enter">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Campaigns
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Organize approved outputs into structured marketing campaigns.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {projects.length > 1 && (
            <select
              value={generateProjectId}
              onChange={e => setGenerateProjectId(e.target.value)}
              style={{
                fontSize: 12, padding: '7px 10px', borderRadius: 6,
                border: '1px solid #e2e8f0', background: '#ffffff', color: '#374151',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || projects.length === 0}
            style={{
              fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 7,
              border: 'none', background: '#6366f1', color: '#ffffff', cursor: 'pointer',
              opacity: (generating || projects.length === 0) ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {generating ? 'Generating…' : 'Generate campaign'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          style={{
            fontSize: 12, padding: '6px 10px', borderRadius: 6,
            border: '1px solid #e2e8f0', background: '#ffffff', color: '#374151',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="all">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 4px', marginRight: 18, height: 38, fontSize: 12,
              fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: activeTab === t.id ? '2px solid #0f172a' : '2px solid transparent',
              transition: 'color 0.1s', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Safety note */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#64748b',
      }}>
        Campaign approval is internal only. No emails or messages are sent until a separate explicit launch action.
      </div>

      {/* Campaign list */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '32px 0', textAlign: 'center' }}>
          {activeTab === 'all'
            ? 'No campaigns yet. Generate one from approved assets or create manually.'
            : `No ${activeTab.replace(/_/g, ' ')} campaigns.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
