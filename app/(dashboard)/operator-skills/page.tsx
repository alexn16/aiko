'use client'

import { useEffect, useState } from 'react'

type Skill = {
  skill_id: string
  name: string
  website_pattern: string | null
  description: string
  allowed_actions: string[]
  approval_required_actions: string[]
  forbidden_actions: string[]
  login_policy: string
  output_types: string[]
  status: string
  examples?: string[]
}

function ActionPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'approval' | 'blocked' }) {
  const cls = tone === 'approval'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : tone === 'blocked'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-50 text-slate-700'
  return <span className={`rounded-full border px-2 py-1 text-xs ${cls}`}>{label}</span>
}

export default function OperatorSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/web-operator/skills')
      .then(r => r.json())
      .then(data => setSkills(Array.isArray(data.skills) ? data.skills : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Web Operator Skills</p>
        <h1 className="text-3xl font-bold text-slate-950">Website workflow guardrails</h1>
        <p className="max-w-3xl text-slate-600">
          Skills define how operators work on external websites through browser actions only. Manual login/takeover is expected, and posting, sending, sharing, publishing, or downloading final assets requires approval.
        </p>
      </header>

      {loading ? <div className="rounded-xl border p-6 text-slate-500">Loading skills…</div> : null}

      <section className="grid gap-4 md:grid-cols-2">
        {skills.map(skill => (
          <article key={skill.skill_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{skill.name}</h2>
                <p className="text-sm text-slate-500">{skill.skill_id} · {skill.website_pattern ?? '*'}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{skill.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{skill.description}</p>
            <p className="mt-2 text-xs text-slate-500">Login policy: {skill.login_policy}</p>

            <div className="mt-4 space-y-3">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Allowed actions</h3>
                <div className="flex flex-wrap gap-2">{skill.allowed_actions.map(a => <ActionPill key={a} label={a} />)}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Approval required</h3>
                <div className="flex flex-wrap gap-2">{skill.approval_required_actions.map(a => <ActionPill key={a} label={a} tone="approval" />)}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Forbidden</h3>
                <div className="flex flex-wrap gap-2">{skill.forbidden_actions.map(a => <ActionPill key={a} label={a} tone="blocked" />)}</div>
              </div>
            </div>

            {skill.examples?.length ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Examples</p>
                <ul className="mt-1 list-disc pl-5">
                  {skill.examples.map(example => <li key={example}>{example}</li>)}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  )
}