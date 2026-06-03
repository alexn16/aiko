'use client'

import { useEffect, useState } from 'react'

type Playbook = {
  playbook_id: string
  skill_id: string
  name: string
  description: string
  trigger_patterns: string[]
  steps: string[]
  approval_gates: string[]
  forbidden_steps: string[]
  status: string
  examples?: string[]
}

function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'approval' | 'blocked' }) {
  const cls = tone === 'approval'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : tone === 'blocked'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-50 text-slate-700'
  return <span className={`rounded-full border px-2 py-1 text-xs ${cls}`}>{label}</span>
}

export default function OperatorPlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/web-operator/playbooks')
      .then(r => r.json())
      .then(data => setPlaybooks(Array.isArray(data.playbooks) ? data.playbooks : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Web Operator Playbooks</p>
        <h1 className="text-3xl font-bold text-slate-950">Safe website workflows</h1>
        <p className="max-w-3xl text-slate-600">
          Skills define safety policy. Playbooks define transparent step-by-step browser workflows for known sites, including manual takeover points and approval gates.
        </p>
      </header>

      {loading ? <div className="rounded-xl border p-6 text-slate-500">Loading playbooks…</div> : null}

      <section className="grid gap-4 md:grid-cols-2">
        {playbooks.map(playbook => (
          <article key={playbook.playbook_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{playbook.name}</h2>
                <p className="text-sm text-slate-500">{playbook.playbook_id} · {playbook.skill_id}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{playbook.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{playbook.description}</p>

            <div className="mt-4 space-y-3">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Trigger patterns</h3>
                <div className="flex flex-wrap gap-2">{playbook.trigger_patterns.map(p => <Pill key={p} label={p} />)}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Steps</h3>
                <ol className="space-y-1 text-sm text-slate-700">
                  {playbook.steps.map((step, index) => (
                    <li key={step}><span className="font-mono text-xs text-slate-400">{index + 1}.</span> {step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Approval gates</h3>
                <div className="flex flex-wrap gap-2">{playbook.approval_gates.map(a => <Pill key={a} label={a} tone="approval" />)}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Forbidden steps</h3>
                <div className="flex flex-wrap gap-2">{playbook.forbidden_steps.map(a => <Pill key={a} label={a} tone="blocked" />)}</div>
              </div>
            </div>

            {playbook.examples?.length ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Examples</p>
                <ul className="mt-1 list-disc pl-5">
                  {playbook.examples.map(example => <li key={example}>{example}</li>)}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  )
}
