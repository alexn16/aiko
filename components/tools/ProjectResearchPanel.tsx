'use client'
import { useState, useEffect } from 'react'

interface WebSearchResult {
  title: string
  url: string
  snippet: string
  source?: string
}

interface ModeState {
  mode: string
  paused: boolean
}

interface Props {
  projectId: string
  projectName?: string
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 10,
  border: '1px solid #f1f5f9',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  padding: '18px 20px',
  marginBottom: 16,
}

function ModeWarning({ mode }: { mode: string }) {
  if (mode === 'auto_approval' || mode === 'full_access') return null
  return (
    <div style={{
      background: '#fef3c7', border: '1px solid #fcd34d',
      borderRadius: 8, padding: '10px 14px', marginBottom: 16,
      fontSize: 13, color: '#92400e',
    }}>
      <strong>Web tools require Auto/Approval Required mode or higher.</strong>{' '}
      Go to <a href="/mode" style={{ color: '#78350f', fontWeight: 600 }}>Operating Mode</a> and switch from Read Only to enable research tools.
    </div>
  )
}

export function ProjectResearchPanel({ projectId, projectName }: Props) {
  const [mode, setMode] = useState<ModeState>({ mode: 'read_only', paused: false })

  // Web search state
  const [query, setQuery] = useState(projectName ?? '')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<WebSearchResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchProvider, setSearchProvider] = useState('')
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [savingIdx, setSavingIdx] = useState<number | null>(null)

  // Website reader state
  const [readUrl, setReadUrl] = useState('')
  const [reading, setReading] = useState(false)
  const [readResult, setReadResult] = useState<{
    title?: string
    description?: string
    text_preview?: string
    status_code?: number
    url?: string
    final_url?: string
    links?: string[]
  } | null>(null)
  const [readError, setReadError] = useState('')
  const [readSaved, setReadSaved] = useState(false)
  const [savingRead, setSavingRead] = useState(false)

  useEffect(() => {
    fetch('/api/mode')
      .then(r => r.json())
      .then(d => {
        if (d.mode) setMode({ mode: d.mode.mode, paused: d.mode.paused ?? false })
      })
      .catch(() => {})
  }, [])

  async function doSearch() {
    if (!query.trim()) return
    setSearching(true)
    setSearchResults([])
    setSearchError('')
    setSearchProvider('')
    setSavedIds(new Set())

    try {
      const res = await fetch('/api/tools/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), project_id: projectId, agent_role: 'research' }),
      })
      const d = await res.json()
      if (!res.ok) {
        setSearchError(d.error ?? 'Search failed')
      } else {
        setSearchResults(d.results ?? [])
        setSearchProvider(d.provider ?? '')
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSearching(false)
    }
  }

  async function saveResultAsOutput(result: WebSearchResult, idx: number) {
    setSavingIdx(idx)
    try {
      const content = `**${result.title}**\n${result.url}\n\n${result.snippet}`
      const res = await fetch('/api/task-outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          agent_role: 'research',
          output_type: 'research_brief',
          title: result.title || result.url,
          content,
          structured_data: { url: result.url, source: result.source },
        }),
      })
      if (res.ok) {
        setSavedIds(prev => { const s = new Set(prev); s.add(idx); return s })
      }
    } catch {
      // ignore
    } finally {
      setSavingIdx(null)
    }
  }

  async function doRead() {
    if (!readUrl.trim()) return
    setReading(true)
    setReadResult(null)
    setReadError('')
    setReadSaved(false)

    try {
      const res = await fetch('/api/tools/read-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: readUrl.trim(), project_id: projectId, agent_role: 'research' }),
      })
      const d = await res.json() as { error?: string; title?: string; description?: string; text_preview?: string; status_code?: number; url?: string; final_url?: string; links?: string[] }
      if (!res.ok) {
        setReadError(d.error ?? 'Read failed')
      } else if (d.error) {
        setReadError(d.error)
      } else {
        setReadResult(d)
      }
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Error')
    } finally {
      setReading(false)
    }
  }

  async function saveReadAsOutput() {
    if (!readResult) return
    setSavingRead(true)
    try {
      const content = [
        readResult.title ? `**${readResult.title}**` : '',
        readResult.description ?? '',
        readResult.url ?? '',
        '',
        readResult.text_preview ? readResult.text_preview.slice(0, 1500) : '',
      ].filter(Boolean).join('\n')

      const res = await fetch('/api/task-outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          agent_role: 'research',
          output_type: 'research_brief',
          title: readResult.title ?? readResult.url ?? 'Website content',
          content,
          structured_data: { url: readResult.url, final_url: readResult.final_url },
        }),
      })
      if (res.ok) setReadSaved(true)
    } catch {
      // ignore
    } finally {
      setSavingRead(false)
    }
  }

  return (
    <div>
      <ModeWarning mode={mode.mode} />

      {/* ── Web Search ─────────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
          🔍 Web Search
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search query…"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13,
              border: '1px solid #e2e8f0', borderRadius: 7,
              background: '#fafafa', outline: 'none',
            }}
          />
          <button
            onClick={doSearch}
            disabled={searching || !query.trim()}
            style={{
              background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: 7, padding: '8px 16px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {searchError && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{searchError}</div>
        )}

        {searchResults.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>
              {searchResults.length} results via {searchProvider}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {searchResults.map((r, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 7,
                  background: '#fafafa', border: '1px solid #f1f5f9',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a
                        href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 13, fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}
                      >
                        {r.title}
                      </a>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.url}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 4, lineHeight: 1.5 }}>
                        {r.snippet}
                      </div>
                    </div>
                    <button
                      onClick={() => saveResultAsOutput(r, i)}
                      disabled={savingIdx === i || savedIds.has(i)}
                      style={{
                        background: savedIds.has(i) ? '#d1fae5' : '#f8fafc',
                        color: savedIds.has(i) ? '#065f46' : '#374151',
                        border: '1px solid #e2e8f0', borderRadius: 6,
                        padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}
                    >
                      {savedIds.has(i) ? 'Saved' : savingIdx === i ? 'Saving…' : 'Save as output'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Read Website ───────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
          📄 Read Website
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="url"
            value={readUrl}
            onChange={e => setReadUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doRead()}
            placeholder="https://example.com"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13,
              border: '1px solid #e2e8f0', borderRadius: 7,
              background: '#fafafa', outline: 'none',
            }}
          />
          <button
            onClick={doRead}
            disabled={reading || !readUrl.trim()}
            style={{
              background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: 7, padding: '8px 16px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {reading ? 'Reading…' : 'Read'}
          </button>
        </div>

        {readError && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{readError}</div>
        )}

        {readResult && (
          <div style={{
            background: '#fafafa', border: '1px solid #f1f5f9',
            borderRadius: 8, padding: '12px 14px',
          }}>
            {readResult.title && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                {readResult.title}
              </div>
            )}
            {readResult.description && (
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontStyle: 'italic' }}>
                {readResult.description}
              </div>
            )}
            {readResult.text_preview && (
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'hidden' }}>
                {readResult.text_preview.slice(0, 800)}
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                Status {readResult.status_code ?? 0}
              </span>
              <button
                onClick={saveReadAsOutput}
                disabled={savingRead || readSaved}
                style={{
                  background: readSaved ? '#d1fae5' : '#f8fafc',
                  color: readSaved ? '#065f46' : '#374151',
                  border: '1px solid #e2e8f0', borderRadius: 6,
                  padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                }}
              >
                {readSaved ? 'Saved' : savingRead ? 'Saving…' : 'Save as task output'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
