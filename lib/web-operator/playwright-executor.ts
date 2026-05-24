// Playwright executor — only imported when browser runtime is confirmed available.
// Handles actual browser actions via the existing lib/browser/controller utilities.

import type { Page } from 'playwright'
import type { WebOperatorAction, WebOperatorActionType } from './web-operator'

interface ExecuteResult {
  output: Record<string, unknown>
  screenshot_url?: string | null
  _page?: {
    url: string
    title: string
    preview: string
    screenshot_url: string | null
    is_sensitive: boolean
  }
  retry_count?: number
  failure_reason?: string
}

// ── Page state capture ──────────────────────────────────────────────────────────

async function capturePageState(page: Page): Promise<{
  url: string
  title: string
  preview: string
  screenshot_url: string | null
  is_sensitive: boolean
}> {
  try {
    const url = page.url()
    const title = await page.title().catch(() => '')
    const preview = await page.evaluate(() => {
      const body = document.body
      if (!body) return ''
      return body.innerText?.slice(0, 500) ?? ''
    }).catch(() => '')
    const sensitive = isSensitivePage(url, title)
    let screenshot_url: string | null = null
    if (!sensitive) {
      const { takeScreenshot } = await import('@/lib/browser/screenshot')
      screenshot_url = await takeScreenshot(page).catch(() => null)
    }
    return { url, title, preview, screenshot_url, is_sensitive: sensitive }
  } catch {
    return { url: '', title: '', preview: '', screenshot_url: null, is_sensitive: false }
  }
}

// ── Sensitive page detection ────────────────────────────────────────────────────

function isSensitivePage(url: string, title: string): boolean {
  const patterns = [/login/i, /signin/i, /password/i, /auth/i, /account\/security/i]
  return patterns.some(p => p.test(url) || p.test(title))
}

// ── Safe retry wrapper ──────────────────────────────────────────────────────────

const SAFE_ACTION_TYPES = ['search', 'open_url', 'read_page', 'copy_data']

async function withRetry<T>(
  fn: () => Promise<T>,
  actionType: string,
  maxRetries = 1
): Promise<{ result: T; retryCount: number }> {
  if (!SAFE_ACTION_TYPES.includes(actionType)) {
    return { result: await fn(), retryCount: 0 }
  }
  try {
    return { result: await fn(), retryCount: 0 }
  } catch (err) {
    if (maxRetries <= 0) throw err
    await new Promise(r => setTimeout(r, 1500))
    try {
      return { result: await fn(), retryCount: 1 }
    } catch (err2) {
      throw err2
    }
  }
}

// ── Structured failure reasons ──────────────────────────────────────────────────

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('timeout') || msg.includes('Timeout')) return 'navigation_timeout'
  if (msg.includes('net::ERR') || msg.includes('network')) return 'network_error'
  if (msg.includes('not found') || msg.includes('No element')) return 'selector_not_found'
  if (msg.includes('browser') || msg.includes('Target closed')) return 'browser_not_available'
  if (msg.includes('blocked') || msg.includes('403') || msg.includes('401')) return 'access_blocked'
  return 'unknown_error'
}

// ── Session recovery ────────────────────────────────────────────────────────────

export async function recoverSession(): Promise<{ success: boolean; error?: string }> {
  try {
    const { launchBrowser } = await import('@/lib/browser/controller')
    // Launch a fresh browser to verify runtime is working
    const browser = await launchBrowser()
    await browser.close()
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Main executor ───────────────────────────────────────────────────────────────

export async function executeWebAction(
  action: WebOperatorAction,
  opts: {
    action_type: WebOperatorActionType
    target_url?: string | null
    description: string
    input?: Record<string, unknown>
  }
): Promise<ExecuteResult> {
  const { launchBrowser, newPage } = await import('@/lib/browser/controller')
  const browser = await launchBrowser()

  try {
    const page = await newPage(browser)

    switch (opts.action_type) {
      case 'open_url':
      case 'read_page': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        if (!url) throw new Error('No URL provided for open_url/read_page action')

        const { result: coreOutput, retryCount } = await withRetry(async () => {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          const title = await page.title()
          const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) ?? '')
          return { title, body_text: bodyText, url: page.url() }
        }, opts.action_type)

        const pageState = await capturePageState(page)
        return {
          output: coreOutput,
          screenshot_url: pageState.screenshot_url,
          retry_count: retryCount,
          _page: pageState,
        }
      }

      case 'search': {
        const query = String(opts.input?.query ?? opts.description)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

        const { result: coreOutput, retryCount } = await withRetry(async () => {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          const results = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('h3')).slice(0, 10)
            return items.map(h => ({
              title: h.innerText,
              href: (h.closest('a') as HTMLAnchorElement | null)?.href ?? '',
            }))
          })
          return { query, results }
        }, opts.action_type)

        const pageState = await capturePageState(page)
        return {
          output: coreOutput,
          screenshot_url: pageState.screenshot_url,
          retry_count: retryCount,
          _page: pageState,
        }
      }

      case 'click': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        const selector = String(opts.input?.selector ?? '')
        if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (selector) await page.click(selector, { timeout: 10000 })
        const pageState = await capturePageState(page)
        return {
          output: { clicked: selector, url: page.url() },
          screenshot_url: pageState.screenshot_url,
          _page: pageState,
        }
      }

      case 'type': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        const selector = String(opts.input?.selector ?? '')
        const text = String(opts.input?.text ?? '')
        if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (selector && text) await page.fill(selector, text)
        const pageState = await capturePageState(page)
        return {
          output: { typed_into: selector, text },
          screenshot_url: pageState.screenshot_url,
          _page: pageState,
        }
      }

      case 'copy_data': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        if (!url) throw new Error('No URL provided for copy_data action')

        const { result: coreOutput, retryCount } = await withRetry(async () => {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          const data = await page.evaluate(() => document.body?.innerText?.slice(0, 10000) ?? '')
          return { data, url: page.url() }
        }, opts.action_type)

        const pageState = await capturePageState(page)
        return {
          output: coreOutput,
          screenshot_url: pageState.screenshot_url,
          retry_count: retryCount,
          _page: pageState,
        }
      }

      default:
        throw new Error(`Action type "${opts.action_type}" requires manual execution or is not yet automated.`)
    }
  } catch (err) {
    const failure_reason = classifyError(err)
    throw Object.assign(
      err instanceof Error ? err : new Error(String(err)),
      { failure_reason }
    )
  } finally {
    await browser.close()
  }
}
