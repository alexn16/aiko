import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  source?: string
}

export interface WebSearchResponse {
  query: string
  results: WebSearchResult[]
  provider: string
  total?: number
}

// ── Implementation ─────────────────────────────────────────────────────────────

export async function searchWeb(opts: {
  query: string
  project_id?: string
  agent_role?: string
  num_results?: number
}): Promise<WebSearchResponse> {
  // Load config + secret
  const connRow = await db.query(
    `SELECT config, encrypted_secret FROM tool_connections WHERE tool_type='web_search' LIMIT 1`
  )
  const conn = connRow.rows[0]
  const config = (conn?.config ?? {}) as Record<string, unknown>
  const secret = (conn?.encrypted_secret ?? '') as string
  const provider = String(config.provider ?? '')
  const num = opts.num_results ?? 5

  if (provider === 'tavily') {
    if (!secret) throw new Error('No API key configured for Tavily. Add it at /tools.')

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: secret, query: opts.query, max_results: num }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Tavily error ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json() as {
      results?: Array<{ title?: string; url?: string; content?: string; source?: string }>
    }

    const results: WebSearchResult[] = (data.results ?? []).map(r => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
      source: r.source,
    }))

    return { query: opts.query, results, provider: 'tavily', total: results.length }
  }

  if (provider === 'brave') {
    if (!secret) throw new Error('No API key configured for Brave Search. Add it at /tools.')

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(opts.query)}&count=${num}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': secret },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Brave Search error ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json() as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
    }

    const results: WebSearchResult[] = (data.web?.results ?? []).map(r => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.description ?? '',
    }))

    return { query: opts.query, results, provider: 'brave', total: results.length }
  }

  if (provider === 'serpapi') {
    if (!secret) throw new Error('No API key configured for SerpAPI. Add it at /tools.')

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(opts.query)}&num=${num}&api_key=${secret}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`SerpAPI error ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json() as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string; source?: string }>
    }

    const results: WebSearchResult[] = (data.organic_results ?? []).slice(0, num).map(r => ({
      title: r.title ?? '',
      url: r.link ?? '',
      snippet: r.snippet ?? '',
      source: r.source,
    }))

    return { query: opts.query, results, provider: 'serpapi', total: results.length }
  }

  throw new Error('No web search provider connected. Add an API key at /tools.')
}
