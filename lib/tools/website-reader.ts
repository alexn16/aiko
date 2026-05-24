// ── Types ──────────────────────────────────────────────────────────────────────

export interface WebsiteReadResult {
  url: string
  final_url: string
  status_code: number
  title: string
  description: string
  text_preview: string   // first 2000 chars of cleaned body text
  links: string[]        // first 20 absolute href links found
  error?: string
}

// ── Implementation ─────────────────────────────────────────────────────────────

export async function readWebsite(opts: {
  url: string
  project_id?: string
  agent_role?: string
}): Promise<WebsiteReadResult> {
  const blank: WebsiteReadResult = {
    url: opts.url,
    final_url: opts.url,
    status_code: 0,
    title: '',
    description: '',
    text_preview: '',
    links: [],
  }

  // 1. Validate URL
  let parsed: URL
  try {
    parsed = new URL(opts.url)
  } catch {
    return { ...blank, error: 'Invalid URL. Must be http or https.' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ...blank, error: 'Invalid URL. Must be http or https.' }
  }

  // 2. Fetch
  let res: Response
  try {
    res = await fetch(opts.url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'AIKO-Research-Bot/1.0 (internal research tool)' },
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { ...blank, error: `Fetch failed: ${errMsg}` }
  }

  const status_code = res.status
  const final_url = res.url || opts.url

  let body: string
  try {
    body = await res.text()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { ...blank, final_url, status_code, error: `Could not read body: ${errMsg}` }
  }

  // 3. Extract title
  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : ''

  // 4. Extract description
  const descMatch =
    body.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i) ||
    body.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i) ||
    body.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*?)["']/i) ||
    body.match(/<meta\s+content=["']([^"']*?)["']\s+property=["']og:description["']/i)
  const description = descMatch ? descMatch[1].trim() : ''

  // 5. Strip HTML tags and get text preview
  const stripped = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const text_preview = stripped.slice(0, 2000)

  // 6. Extract absolute links
  const hrefRegex = /href=["']([^"']+)["']/gi
  const links: string[] = []
  let match: RegExpExecArray | null
  while ((match = hrefRegex.exec(body)) !== null && links.length < 20) {
    const href = match[1]
    try {
      const absolute = new URL(href, final_url)
      if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
        links.push(absolute.href)
      }
    } catch {
      // skip relative or invalid
    }
  }

  return {
    url: opts.url,
    final_url,
    status_code,
    title,
    description,
    text_preview,
    links,
  }
}
