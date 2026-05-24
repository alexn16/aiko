'use client'
import { useEffect, useState } from 'react'
import type { ToolConnection } from '@/lib/tools/tool-router'

const CARD: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 10,
  border: '1px solid #f1f5f9',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  padding: '20px 24px',
  marginBottom: 16,
}

function statusBadge(status: string) {
  const styles: Record<string, React.CSSProperties> = {
    connected:      { background: '#d1fae5', color: '#065f46' },
    not_configured: { background: '#f1f5f9', color: '#64748b' },
    error:          { background: '#fee2e2', color: '#991b1b' },
    coming_soon:    { background: '#fef3c7', color: '#92400e' },
  }
  const labels: Record<string, string> = {
    connected:      'Connected',
    not_configured: 'Not configured',
    error:          'Error',
    coming_soon:    'Coming next',
  }
  const s = styles[status] ?? styles.not_configured
  return (
    <span style={{
      ...s,
      fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {labels[status] ?? status}
    </span>
  )
}

type Provider = 'tavily' | 'brave' | 'serpapi'

export default function ToolsPage() {
  const [connections, setConnections] = useState<ToolConnection[]>([])
  const [loading, setLoading] = useState(true)

  // Web search config state
  const [wsConfiguring, setWsConfiguring] = useState(false)
  const [wsProvider, setWsProvider] = useState<Provider>('tavily')
  const [wsApiKey, setWsApiKey] = useState('')
  const [wsSaving, setWsSaving] = useState(false)
  const [wsMsg, setWsMsg] = useState('')

  // Website reader test state
  const [wrTestUrl, setWrTestUrl] = useState('')
  const [wrTesting, setWrTesting] = useState(false)
  const [wrResult, setWrResult] = useState<Record<string, unknown> | null>(null)
  const [wrError, setWrError] = useState('')

  // Web search test state
  const [wsTestRunning, setWsTestRunning] = useState(false)
  const [wsTestMsg, setWsTestMsg] = useState('')

  async function loadConnections() {
    try {
      const res = await fetch('/api/tool-connections')
      const d = await res.json()
      setConnections(d.connections ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConnections() }, [])

  function getConn(tool_type: string): ToolConnection | undefined {
    return connections.find(c => c.tool_type === tool_type)
  }

  async function saveWebSearch() {
    setWsSaving(true)
    setWsMsg('')
    try {
      const wsConn = getConn('web_search')
      const url = wsConn ? `/api/tool-connections/${wsConn.id}` : '/api/tool-connections'
      const method = wsConn ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = {
        config: { provider: wsProvider },
        encrypted_secret: wsApiKey,
        status: 'not_configured',
      }
      if (!wsConn) {
        body.tool_type = 'web_search'
        body.name = 'Web Search'
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')

      // Auto-test
      const testRes = await fetch('/api/tool-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_type: 'web_search' }),
      })
      const testData = await testRes.json()

      if (testData.success) {
        setWsMsg('Connected successfully.')
        setWsConfiguring(false)
        setWsApiKey('')
      } else {
        setWsMsg(`Test failed: ${testData.error ?? 'Unknown error'}`)
      }

      await loadConnections()
    } catch (err) {
      setWsMsg(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setWsSaving(false)
    }
  }

  async function testWebSearch() {
    setWsTestRunning(true)
    setWsTestMsg('')
    try {
      const res = await fetch('/api/tool-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_type: 'web_search' }),
      })
      const d = await res.json()
      setWsTestMsg(d.success ? 'Connection OK.' : `Error: ${d.error ?? 'Unknown'}`)
      await loadConnections()
    } catch {
      setWsTestMsg('Test failed.')
    } finally {
      setWsTestRunning(false)
    }
  }

  async function testWebsiteReader() {
    if (!wrTestUrl.trim()) return
    setWrTesting(true)
    setWrResult(null)
    setWrError('')
    try {
      const res = await fetch('/api/tools/read-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: wrTestUrl.trim() }),
      })
      const d = await res.json()
      if (!res.ok) {
        setWrError(d.error ?? 'Error')
      } else {
        setWrResult(d)
      }
    } catch (err) {
      setWrError(err instanceof Error ? err.message : 'Error')
    } finally {
      setWrTesting(false)
    }
  }

  const wsConn = getConn('web_search')
  const wrConn = getConn('website_reader')

  return (
    <div style={{ padding: '40px 32px', maxWidth: 720 }}>

      {/* Secondary-tool notice */}
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 24,
        fontSize: 12,
        color: '#92400e',
        lineHeight: 1.6,
      }}>
        <strong>Note:</strong> The Tools page connects optional API-key-based search providers (Tavily, Brave, SerpAPI).
        These are secondary to the Web Operator. AÏKO&apos;s primary external execution runs through the Web Operator at{' '}
        <a href="/operator" style={{ color: '#92400e', textDecoration: 'underline' }}>/operator</a>.
        Configure search providers here only as a supplementary acceleration — they are not required.
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Tool Connections
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Connect external services for AÏKO agents.
        </p>
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</div>
      )}

      {!loading && (
        <>
          {/* ── Web Search card ─────────────────────────────────────────────── */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Web Search</span>
              {statusBadge(wsConn?.status ?? 'not_configured')}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Search the internet for leads, companies, and market data.
              Requires an API key from a supported provider.
            </p>

            {wsConn?.last_tested_at && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                Last tested: {new Date(wsConn.last_tested_at).toLocaleString()}
              </div>
            )}
            {wsConn?.last_error && (
              <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>
                Last error: {wsConn.last_error}
              </div>
            )}

            {!wsConfiguring && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setWsConfiguring(true); setWsMsg('') }}
                  style={{
                    background: '#0f172a', color: '#fff',
                    border: 'none', borderRadius: 7, padding: '7px 14px',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {wsConn?.status === 'connected' ? 'Reconfigure' : 'Configure'}
                </button>
                {wsConn?.status === 'connected' && (
                  <button
                    onClick={testWebSearch}
                    disabled={wsTestRunning}
                    style={{
                      background: '#f8fafc', color: '#374151',
                      border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 14px',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {wsTestRunning ? 'Testing…' : 'Test connection'}
                  </button>
                )}
              </div>
            )}
            {wsTestMsg && (
              <div style={{ marginTop: 8, fontSize: 12, color: wsTestMsg.includes('Error') ? '#ef4444' : '#065f46' }}>
                {wsTestMsg}
              </div>
            )}

            {wsConfiguring && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Provider</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['tavily', 'brave', 'serpapi'] as Provider[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setWsProvider(p)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, fontSize: 12,
                          border: wsProvider === p ? '2px solid #6366f1' : '1px solid #e2e8f0',
                          background: wsProvider === p ? '#eef2ff' : '#f8fafc',
                          color: wsProvider === p ? '#4338ca' : '#374151',
                          cursor: 'pointer', fontWeight: wsProvider === p ? 600 : 400,
                        }}
                      >
                        {p === 'tavily' ? 'Tavily' : p === 'brave' ? 'Brave Search' : 'SerpAPI'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 6 }}>API Key</div>
                  <input
                    type="password"
                    value={wsApiKey}
                    onChange={e => setWsApiKey(e.target.value)}
                    placeholder="Paste your API key…"
                    style={{
                      width: '100%', padding: '8px 12px', fontSize: 13,
                      border: '1px solid #e2e8f0', borderRadius: 7,
                      background: '#fafafa', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                    Stored server-side only. Never returned to the browser.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={saveWebSearch}
                    disabled={wsSaving || !wsApiKey.trim()}
                    style={{
                      background: '#6366f1', color: '#fff',
                      border: 'none', borderRadius: 7, padding: '7px 16px',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {wsSaving ? 'Saving…' : 'Save & Test'}
                  </button>
                  <button
                    onClick={() => { setWsConfiguring(false); setWsApiKey(''); setWsMsg('') }}
                    style={{
                      background: 'none', color: '#94a3b8',
                      border: 'none', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {wsMsg && (
                  <div style={{ fontSize: 12, color: wsMsg.includes('failed') || wsMsg.includes('Error') ? '#ef4444' : '#065f46' }}>
                    {wsMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Website Reader card ─────────────────────────────────────────── */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Website Reader</span>
              {statusBadge(wrConn?.status ?? 'connected')}
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Read and extract content from public web pages. No API key required — uses plain fetch.
              Available as long as Auto/Approval or Full Access mode is active.
            </p>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Test a URL</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  value={wrTestUrl}
                  onChange={e => setWrTestUrl(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={e => e.key === 'Enter' && testWebsiteReader()}
                  style={{
                    flex: 1, padding: '7px 12px', fontSize: 13,
                    border: '1px solid #e2e8f0', borderRadius: 7,
                    background: '#fafafa', outline: 'none',
                  }}
                />
                <button
                  onClick={testWebsiteReader}
                  disabled={wrTesting || !wrTestUrl.trim()}
                  style={{
                    background: '#0f172a', color: '#fff',
                    border: 'none', borderRadius: 7, padding: '7px 14px',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {wrTesting ? 'Reading…' : 'Read'}
                </button>
              </div>
            </div>

            {wrError && (
              <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{wrError}</div>
            )}

            {wrResult && (() => {
              const r = wrResult as { title?: string; description?: string; text_preview?: string; status_code?: number; links?: unknown[] }
              return (
                <div style={{
                  background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 8,
                  padding: '12px 14px', fontSize: 12, color: '#374151',
                }}>
                  {r.title && (
                    <div style={{ fontWeight: 600, marginBottom: 4, color: '#0f172a' }}>
                      {r.title}
                    </div>
                  )}
                  {r.description && (
                    <div style={{ color: '#64748b', marginBottom: 8, fontStyle: 'italic' }}>
                      {r.description}
                    </div>
                  )}
                  {r.text_preview && (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#374151' }}>
                      {r.text_preview.slice(0, 500)}…
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
                    Status {r.status_code ?? 0} · {Array.isArray(r.links) ? r.links.length : 0} links found
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── Email card ──────────────────────────────────────────────────── */}
          <div style={{ ...CARD, opacity: 0.6, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>✉️</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Email</span>
              {statusBadge('coming_soon')}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Send approved outreach emails. Connect your SMTP or SendGrid account.
              This integration is coming in the next release.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
