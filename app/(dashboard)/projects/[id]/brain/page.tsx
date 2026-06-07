'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AdvancedDisclosure } from '@/components/ui/AdvancedDisclosure'
import { MinimalCard } from '@/components/ui/MinimalCard'
import { PageShell } from '@/components/ui/PageShell'
import { PrimaryAction } from '@/components/ui/PrimaryAction'

type Brain = {
  one_liner: string | null
  positioning: string | null
  target_audience: string | null
  problem: string | null
  solution: string | null
  key_features: string[]
  differentiators: string[]
  tone_of_voice: string | null
  proof_points: string[]
  forbidden_claims: string[]
  current_goal: string | null
  preferred_channels: string[]
  owner_notes: string | null
  source_summary: string | null
}

type Completeness = { score: number; missing: string[] }

const EMPTY: Brain = {
  one_liner: '', positioning: '', target_audience: '', problem: '', solution: '',
  key_features: [], differentiators: [], tone_of_voice: '', proof_points: [],
  forbidden_claims: [], current_goal: '', preferred_channels: [], owner_notes: '',
  source_summary: null,
}

const INPUT: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '9px 11px', fontSize: 13, color: '#0f172a', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.08em', display: 'block', marginBottom: 5,
}

function arrField(val: string[]): string { return val.join('\n') }
function parseArr(val: string): string[] { return val.split('\n').map(s => s.trim()).filter(Boolean) }

export default function ProjectBrainPage() {
  const params = useParams()
  const projectId = String(params.id)
  const [brain, setBrain] = useState<Brain>(EMPTY)
  const [completeness, setCompleteness] = useState<Completeness>({ score: 0, missing: [] })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [promptPreview, setPromptPreview] = useState('')

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/brain`)
    if (res.ok) {
      const data = await res.json()
      if (data.brain) setBrain({ ...EMPTY, ...data.brain })
      if (data.completeness) setCompleteness(data.completeness)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [projectId])

  async function save() {
    setSaving(true); setMessage('')
    try {
      const res = await fetch(`/api/projects/${projectId}/brain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brain),
      })
      const data = await res.json()
      if (data.brain) { setBrain({ ...EMPTY, ...data.brain }); setMessage('Saved.') }
      await load()
    } catch { setMessage('Could not save.') }
    finally { setSaving(false) }
  }

  async function generate() {
    setGenerating(true); setMessage('')
    try {
      const res = await fetch(`/api/projects/${projectId}/brain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      })
      const data = await res.json()
      if (data.brain) { setBrain({ ...EMPTY, ...data.brain }); setMessage('Generated from existing context. Review and edit.') }
      await load()
    } catch { setMessage('Could not generate.') }
    finally { setGenerating(false) }
  }

  async function previewPrompt() {
    const res = await fetch(`/api/projects/${projectId}/brain`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview_prompt' }),
    })
    const data = await res.json()
    setPromptPreview(data.prompt ?? '')
  }

  function field(label: string, key: keyof Brain, placeholder?: string, tall = false) {
    const val = brain[key]
    const strVal = Array.isArray(val) ? arrField(val as string[]) : (val ?? '')
    return (
      <div key={key}>
        <label style={LABEL}>{label}</label>
        {tall ? (
          <textarea
            style={{ ...INPUT, minHeight: 80, resize: 'vertical' }}
            value={strVal}
            placeholder={placeholder}
            onChange={e => setBrain(b => ({ ...b, [key]: Array.isArray(val) ? parseArr(e.target.value) : e.target.value }))}
          />
        ) : (
          <input
            style={INPUT}
            value={strVal}
            placeholder={placeholder}
            onChange={e => setBrain(b => ({ ...b, [key]: Array.isArray(val) ? parseArr(e.target.value) : e.target.value }))}
          />
        )}
      </div>
    )
  }

  const scoreColor = completeness.score >= 80 ? '#166534' : completeness.score >= 50 ? '#92400e' : '#991b1b'
  const scoreBg = completeness.score >= 80 ? '#dcfce7' : completeness.score >= 50 ? '#fef3c7' : '#fee2e2'

  return (
    <PageShell title="Project Brain" subtitle="Rich context that improves every AI output for this project." maxWidth={860}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 800, borderRadius: 999, padding: '4px 14px', background: scoreBg, color: scoreColor }}>
            {completeness.score}% complete
          </span>
          {completeness.missing.length > 0 && (
            <span style={{ fontSize: 12, color: '#64748b' }}>Missing: {completeness.missing.join(', ')}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryAction onClick={generate} disabled={generating} variant="secondary">{generating ? 'Generating…' : 'Generate from context'}</PrimaryAction>
          <PrimaryAction onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryAction>
        </div>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: message.includes('Could not') ? '#fef2f2' : '#f0fdf4', color: message.includes('Could not') ? '#991b1b' : '#166534', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {brain.source_summary && (
        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontSize: 12, marginBottom: 16 }}>
          {brain.source_summary}
        </div>
      )}

      <MinimalCard>
        <div style={{ display: 'grid', gap: 16 }}>
          {field('One-liner', 'one_liner', 'AÏKO is a local AI Marketing Operating System that works like a virtual marketing company.')}
          {field('Positioning', 'positioning', 'What it does and why it matters.', true)}
          {field('Target audience', 'target_audience', 'Founders, indie hackers, small teams…')}
          {field('Problem it solves', 'problem', 'People need controlled execution, not random chatbots.', true)}
          {field('Solution', 'solution', 'CEO + agents + approvals + supervised browser.', true)}
          {field('Current goal', 'current_goal', 'Promote AÏKO as a safe local AI marketing OS.')}
        </div>
      </MinimalCard>

      <MinimalCard style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {field('Key features (one per line)', 'key_features', 'CEO Chat\nWeb Operator Kevin\nApproval-first safety', true)}
          {field('Differentiators (one per line)', 'differentiators', 'Local/private\nNormal Chrome\nSafe by default', true)}
          {field('Tone of voice', 'tone_of_voice', 'Clear, premium, practical, calm, founder-focused.')}
          {field('Preferred channels (one per line)', 'preferred_channels', 'LinkedIn\nReddit\nHacker News', true)}
        </div>
      </MinimalCard>

      <MinimalCard style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {field('Do NOT claim (one per line)', 'forbidden_claims', 'Fully autonomous posting\nBypasses CAPTCHA', true)}
          {field('Proof points (one per line)', 'proof_points', 'Works with local Ollama\nApproval-first safety model', true)}
          {field('Owner notes', 'owner_notes', 'Anything else the AI should know about this project.', true)}
        </div>
      </MinimalCard>

      <AdvancedDisclosure title="View prompt context">
        <PrimaryAction onClick={previewPrompt} variant="secondary" style={{ marginBottom: 12 }}>Load prompt preview</PrimaryAction>
        {promptPreview && (
          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 11, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
            {promptPreview}
          </pre>
        )}
      </AdvancedDisclosure>
    </PageShell>
  )
}
