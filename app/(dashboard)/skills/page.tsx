'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type AISkill = {
  skill_id: string
  name: string
  category: string
  description: string
  safety_level: string
  enabled: boolean
}

type WebSkill = {
  skill_id: string
  name: string
  description: string
  status: string
}

type Playbook = {
  playbook_id: string
  name: string
  description: string
  status: string
}

const card: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  background: '#fff',
  padding: 16,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

function StatusPill({ text, tone = 'green' }: { text: string; tone?: 'green' | 'slate' }) {
  const styles = tone === 'green'
    ? { background: '#ecfdf5', color: '#047857', borderColor: '#bbf7d0' }
    : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }
  return (
    <span style={{ border: `1px solid ${styles.borderColor}`, background: styles.background, color: styles.color, borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 800 }}>
      {text}
    </span>
  )
}

export default function SkillsPage() {
  const [aiSkills, setAiSkills] = useState<AISkill[]>([])
  const [webSkills, setWebSkills] = useState<WebSkill[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/ai-skills').then(r => r.json()).catch(() => ({ skills: [] })),
      fetch('/api/web-operator/skills').then(r => r.json()).catch(() => ({ skills: [] })),
      fetch('/api/web-operator/playbooks').then(r => r.json()).catch(() => ({ playbooks: [] })),
    ]).then(([ai, web, pb]) => {
      setAiSkills(Array.isArray(ai.skills) ? ai.skills : [])
      setWebSkills(Array.isArray(web.skills) ? web.skills : [])
      setPlaybooks(Array.isArray(pb.playbooks) ? pb.playbooks : [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 28 }}>
      <header style={{ marginBottom: 22 }}>
        <p style={{ margin: '0 0 6px', color: '#2563eb', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Skills
        </p>
        <h1 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 32, letterSpacing: 0 }}>AÏKO skills</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
          AI Skills create drafts internally. Web Operator Skills use websites in the browser. Playbooks define safe workflows.
        </p>
      </header>

      {loading ? <div style={card}>Loading skills...</div> : null}

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>AI Skills</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Think and create text/files.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {aiSkills.map(skill => (
            <article key={skill.skill_id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>{skill.name}</h3>
                <StatusPill text={skill.enabled ? 'enabled' : 'disabled'} tone={skill.enabled ? 'green' : 'slate'} />
              </div>
              <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{skill.description}</p>
              <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 12 }}>{skill.category} · {skill.safety_level}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Web Operator Skills</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Use websites in the browser.</p>
          </div>
          <Link href="/operator-skills" style={{ color: '#2563eb', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>Open details</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {webSkills.slice(0, 6).map(skill => (
            <article key={skill.skill_id} style={card}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>{skill.name}</h3>
              <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{skill.description}</p>
              <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 12 }}>{skill.status}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Playbooks</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Step-by-step workflows.</p>
          </div>
          <Link href="/operator-playbooks" style={{ color: '#2563eb', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>Open details</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {playbooks.slice(0, 6).map(playbook => (
            <article key={playbook.playbook_id} style={card}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>{playbook.name}</h3>
              <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{playbook.description}</p>
              <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 12 }}>{playbook.status}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
