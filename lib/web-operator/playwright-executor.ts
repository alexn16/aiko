// Playwright executor — only imported when browser runtime is confirmed available.
// Handles actual browser actions via the existing lib/browser/controller utilities.

import type { Page, BrowserContext, BrowserContextOptions } from 'playwright'
import { detectPageState, ManualTakeoverRequired } from '@/lib/web-operator/page-state-detector'
type GmailFillToResult = { success: boolean; output: Record<string, unknown> }
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
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

// ── Per-operator browser context isolation ──────────────────────────────────────

const operatorContexts = new Map<string, BrowserContext>()

function getStorageStatePath(profileKey: string): string {
  return path.join(process.cwd(), '.operator-profiles', `${profileKey}.json`)
}

export async function getOperatorContext(profileKey: string): Promise<BrowserContext> {
  if (operatorContexts.has(profileKey)) {
    const ctx = operatorContexts.get(profileKey)!
    try {
      const pages = ctx.pages()
      if (pages.length >= 0) return ctx  // still open
    } catch {
      operatorContexts.delete(profileKey)
    }
  }

  const { launchBrowser } = await import('@/lib/browser/controller')
  const browser = await launchBrowser()
  const storageStatePath = getStorageStatePath(profileKey)

  const contextOptions: BrowserContextOptions = {}
  if (existsSync(storageStatePath)) {
    contextOptions.storageState = storageStatePath
  }

  const context = await browser.newContext(contextOptions)
  operatorContexts.set(profileKey, context)
  return context
}

export async function saveOperatorStorageState(profileKey: string): Promise<void> {
  const ctx = operatorContexts.get(profileKey)
  if (!ctx) return
  try {
    const dir = path.join(process.cwd(), '.operator-profiles')
    mkdirSync(dir, { recursive: true })
    await ctx.storageState({ path: getStorageStatePath(profileKey) })
  } catch {
    // non-fatal
  }
}

export async function getOperatorPage(profileKey: string): Promise<Page> {
  const ctx = await getOperatorContext(profileKey)
  const pages = ctx.pages()
  if (pages.length > 0) return pages[0]
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  return page
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

// ── Unified action dispatcher ───────────────────────────────────────────────────

export async function executeAction(opts: {
  actionType: string
  input: Record<string, unknown>
  profileKey?: string
}): Promise<{ output: Record<string, unknown>; page_state: typeof capturePageState extends (page: Page) => Promise<infer R> ? R : never }> {
  const page = opts.profileKey
    ? await getOperatorPage(opts.profileKey)
    : await (async () => {
        const { launchBrowser, newPage } = await import('@/lib/browser/controller')
        const browser = await launchBrowser()
        return newPage(browser)
      })()

  const fakeAction = {
    id: 'direct',
    session_id: null,
    project_id: null,
    agent_role: 'Web Operator',
    action_type: opts.actionType as WebOperatorActionType,
    target_url: (opts.input.url as string | undefined) ?? null,
    description: (opts.input.description as string | undefined) ?? opts.actionType,
    status: 'running',
    input: opts.input,
    output: {},
    screenshot_url: null,
    page_title: null,
    page_preview: null,
    retry_count: 0,
    failure_reason: null,
    is_sensitive: false,
    requires_approval: false,
    approval_item_id: null,
    source_task_id: null,
    requested_by_role: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  } as WebOperatorAction

  const result = await executeWebAction(fakeAction, {
    action_type: opts.actionType as WebOperatorActionType,
    target_url: fakeAction.target_url,
    description: fakeAction.description,
    input: opts.input,
    profileKey: opts.profileKey,
  })

  return {
    output: result.output,
    page_state: result._page as never,
  }
}

// ── Gmail browser actions ───────────────────────────────────────────────────────

async function executeOpenGmail(opts: { profileKey?: string }): Promise<ExecuteResult> {
  const page = await getOperatorPage(opts.profileKey ?? 'default')
  await withRetry(async () => {
    await page.goto('https://mail.google.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  }, 'open_url')

  const url = page.url()
  if (url.includes('accounts.google.com') || url.includes('signin') || url.includes('ServiceLogin')) {
    const detectedState = await detectPageState(page)
    throw new ManualTakeoverRequired({
      ...detectedState,
      type: 'login_required',
      requires_manual_takeover: true,
      waiting_reason: 'login_required',
      user_message: 'Gmail login required. Please log in manually in the operator browser window, then click "Login / CAPTCHA completed".',
      is_sensitive: true,
    })
  }

  const state = await capturePageState(page)
  return {
    output: { url: state.url, title: state.title },
    _page: state,
  }
}

export async function executeDetectGmailLogin(opts: { profileKey?: string }): Promise<ExecuteResult> {
  const page = await getOperatorPage(opts.profileKey ?? 'default')
  const url = page.url()
  const title = await page.title().catch(() => '')
  const isLoggedIn = url.includes('mail.google.com') && !url.includes('accounts.google.com')
  return {
    output: { is_logged_in: isLoggedIn, url, title },
    _page: { url, title, preview: '', screenshot_url: null, is_sensitive: false },
  }
}

async function executeGmailFillTo(opts: { profileKey?: string; to: string }, page?: Page): Promise<GmailFillToResult> {
  const p = page ?? await getOperatorPage(opts.profileKey ?? 'default')
  const toSelectors = [
    '[aria-label="To recipients"]',
    'input[aria-label="To"]',
    'textarea[name="to"]',
    '[data-hovercard-id]',
  ]
  for (const sel of toSelectors) {
    const el = p.locator(sel).first()
    if (await el.count() > 0) {
      await el.click()
      await el.type(opts.to, { delay: 50 })
      await p.keyboard.press('Tab')
      return { success: true, output: { to: opts.to } }
    }
  }
  throw new Error('Could not find To field — selector_not_found')
}

async function executeGmailFillSubject(opts: { profileKey?: string; subject: string }, page?: Page): Promise<GmailFillToResult> {
  const p = page ?? await getOperatorPage(opts.profileKey ?? 'default')
  const subjectEl = p.locator('input[name="subjectbox"], [aria-label="Subject"]').first()
  await subjectEl.click()
  await subjectEl.fill(opts.subject)
  return { success: true, output: { subject: opts.subject } }
}

async function executeGmailFillBody(opts: { profileKey?: string; body: string }, page?: Page): Promise<GmailFillToResult> {
  const p = page ?? await getOperatorPage(opts.profileKey ?? 'default')
  const bodySelectors = [
    'div[aria-label="Message Body"]',
    'div[role="textbox"][aria-multiline="true"]',
    'div.Am.Al.editable',
  ]
  for (const sel of bodySelectors) {
    const el = p.locator(sel).first()
    if (await el.count() > 0) {
      await el.click()
      await el.type(opts.body, { delay: 20 })
      return { success: true, output: { body_length: opts.body.length } }
    }
  }
  throw new Error('Could not find message body — selector_not_found')
}

async function executeCreateGmailDraft(opts: { profileKey?: string; to?: string; subject?: string; body?: string }): Promise<ExecuteResult> {
  const page = await getOperatorPage(opts.profileKey ?? 'default')

  if (!page.url().includes('mail.google.com')) {
    await page.goto('https://mail.google.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  }

  const composeSelectors = [
    '[gh="cm"]',
    'div[role="button"][data-tooltip*="Compose"]',
    'div.T-I.T-I-KE',
    '[aria-label="Compose"]',
  ]
  let composed = false
  for (const sel of composeSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.count() > 0) {
      await btn.click()
      composed = true
      break
    }
  }
  if (!composed) {
    throw new Error('Could not find Gmail Compose button — selector_not_found')
  }

  await page.waitForTimeout(1000)

  if (opts.to) {
    await executeGmailFillTo({ profileKey: opts.profileKey, to: opts.to }, page)
  }
  if (opts.subject) {
    await executeGmailFillSubject({ profileKey: opts.profileKey, subject: opts.subject }, page)
  }
  if (opts.body) {
    await executeGmailFillBody({ profileKey: opts.profileKey, body: opts.body }, page)
  }

  const state = await capturePageState(page)
  return {
    output: { composed: true, to: opts.to, subject: opts.subject },
    _page: state,
  }
}

async function executeSendGmailDraft(opts: { profileKey?: string }): Promise<ExecuteResult> {
  const p = await getOperatorPage(opts.profileKey ?? 'default')
  const sendSelectors = [
    '[aria-label="Send ‪(Ctrl-Enter)‬"]',
    'div[aria-label^="Send"]',
    '.T-I-atl',
  ]
  for (const sel of sendSelectors) {
    const el = p.locator(sel).first()
    if (await el.count() > 0) {
      await el.click()
      await p.waitForTimeout(1500)
      const state = await capturePageState(p)
      return { output: { sent: true }, _page: state }
    }
  }
  throw new Error('Could not find Gmail Send button — selector_not_found')
}

// ── Gmail reply-status actions ──────────────────────────────────────────────────

/**
 * executeSearchGmail — searches Gmail for emails from a specific address.
 * Safety: does NOT open attachments, does NOT follow external links.
 * Only reads subject lines and snippet text visible in the thread list.
 */
async function executeSearchGmail(opts: {
  profileKey?: string
  query: string         // e.g. "from:foo@bar.com" or "subject:..."
}): Promise<ExecuteResult> {
  const page = await getOperatorPage(opts.profileKey ?? 'default')

  if (!page.url().includes('mail.google.com')) {
    await page.goto('https://mail.google.com/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  }

  // Use Gmail's search box
  const searchSelectors = ['input[aria-label="Search mail"]', 'input[name="q"]', '#gs']
  let searched = false
  for (const sel of searchSelectors) {
    const el = page.locator(sel).first()
    if (await el.count() > 0) {
      await el.click()
      await el.fill(opts.query)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2000)
      searched = true
      break
    }
  }
  if (!searched) {
    throw new Error('Could not find Gmail search box — selector_not_found')
  }

  // Capture result list (subject + snippet only, no message body)
  const threads = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr.zA'))
    return rows.slice(0, 10).map(row => {
      const subject = (row.querySelector('span.bog') as HTMLElement)?.innerText ?? ''
      const snippet = (row.querySelector('span.y2') as HTMLElement)?.innerText ?? ''
      const sender  = (row.querySelector('span.yP, span.zF') as HTMLElement)?.innerText ?? ''
      const date    = (row.querySelector('td.xW span') as HTMLElement)?.title ?? (row.querySelector('td.xW span') as HTMLElement)?.innerText ?? ''
      const isUnread = row.classList.contains('zE')
      return { subject, snippet, sender, date, unread: isUnread }
    })
  })

  const state = await capturePageState(page)
  return {
    output: { query: opts.query, thread_count: threads.length, threads },
    _page: state,
  }
}

/**
 * executeCheckGmailReply — opens Gmail, searches for emails from a lead,
 * and returns whether a reply exists.
 * Safety rules enforced:
 *   - Does NOT open attachments.
 *   - Does NOT click external links in emails.
 *   - Only reads subject + snippet from the thread list view.
 *   - Does NOT open individual emails (avoids read-receipts and content exposure).
 */
async function executeCheckGmailReply(opts: {
  profileKey?: string
  lead_email: string
  subject_hint?: string
}): Promise<ExecuteResult> {
  const query = `from:${opts.lead_email}`
  const searchResult = await executeSearchGmail({ profileKey: opts.profileKey, query })
  const threads = (searchResult.output.threads ?? []) as Array<{
    subject: string; snippet: string; sender: string; date: string; unread: boolean
  }>

  const hasReply = threads.length > 0
  const latestThread = threads[0] ?? null

  // Match against subject hint if provided (case-insensitive partial match)
  const relevantThreads = opts.subject_hint
    ? threads.filter(t => t.subject.toLowerCase().includes(opts.subject_hint!.toLowerCase()))
    : threads

  return {
    output: {
      lead_email: opts.lead_email,
      has_reply: hasReply,
      relevant_thread_count: relevantThreads.length,
      latest_thread: latestThread,
      // Summary for display — derived only from visible thread list, no email body opened
      summary: hasReply
        ? `${threads.length} email(s) from ${opts.lead_email}. Latest: "${latestThread?.subject}" (${latestThread?.date})`
        : `No emails from ${opts.lead_email} found in inbox.`,
    },
    _page: searchResult._page,
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
    profileKey?: string
  }
): Promise<ExecuteResult> {
  // If profileKey is provided, use isolated operator context; otherwise fall back to new browser
  let page: Page
  let ownsBrowser = false

  if (opts.profileKey) {
    page = await getOperatorPage(opts.profileKey)
  } else {
    const { launchBrowser, newPage } = await import('@/lib/browser/controller')
    const browser = await launchBrowser()
    ownsBrowser = true
    page = await newPage(browser)
  }

  const cleanup = async () => {
    if (ownsBrowser) {
      try {
        await page.context().browser()?.close()
      } catch { /* non-fatal */ }
    }
  }

  try {
    switch (opts.action_type) {
      case 'open_url':
      case 'read_page': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        if (!url) throw new Error('No URL provided for open_url/read_page action')

        const { result: coreOutput, retryCount } = await withRetry(async () => {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

          // Detect CAPTCHA/login/security screens — stop and hand off to user
          const detectedState = await detectPageState(page)
          if (detectedState.requires_manual_takeover) {
            throw new ManualTakeoverRequired(detectedState)
          }

          const title = await page.title()
          const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) ?? '')
          return { title, body_text: bodyText, url: page.url(), text_preview: bodyText }
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

        // Try DuckDuckGo first — more headless-friendly than Google.
        // Fall back to Google if DDG returns 0 results.
        const { result: coreOutput, retryCount } = await withRetry(async () => {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
          await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

          // Check for CAPTCHA/block on DDG
          const ddgState = await detectPageState(page)
          if (ddgState.requires_manual_takeover) {
            throw new ManualTakeoverRequired(ddgState)
          }

          // DuckDuckGo HTML endpoint result selectors
          const ddgResults = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.result__title a, .result__a'))
            const snippets = Array.from(document.querySelectorAll('.result__snippet'))
            return items.slice(0, 10).map((a, i) => ({
              title:   (a as HTMLElement).innerText.trim(),
              url:     (a as HTMLAnchorElement).href ?? '',
              snippet: (snippets[i] as HTMLElement | undefined)?.innerText.trim() ?? '',
            })).filter(r => r.title && r.url && !r.url.includes('duckduckgo.com'))
          })

          if (ddgResults.length > 0) {
            return { query, results: ddgResults }
          }

          // Fallback: Google
          const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
          await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

          // Check for Google CAPTCHA/unusual traffic block
          const googleState = await detectPageState(page)
          if (googleState.requires_manual_takeover) {
            throw new ManualTakeoverRequired(googleState)
          }

          const googleResults = await page.evaluate(() => {
            // Try multiple selector patterns Google uses
            const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
            const results: Array<{ title: string; url: string; snippet: string }> = []
            for (const a of links) {
              const h = a.querySelector('h3')
              if (!h) continue
              const href = a.href ?? ''
              if (!href.startsWith('http') || href.includes('google.com')) continue
              const snippet = a.closest('div')?.querySelector('[data-sncf]')?.textContent ?? ''
              results.push({ title: (h as HTMLElement).innerText.trim(), url: href, snippet: snippet.trim() })
              if (results.length >= 10) break
            }
            return results
          })

          return { query, results: googleResults }
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

      case 'open_gmail': {
        await cleanup()
        return executeOpenGmail({ profileKey: opts.profileKey })
      }

      case 'detect_gmail_login': {
        await cleanup()
        return executeDetectGmailLogin({ profileKey: opts.profileKey })
      }

      case 'create_email_draft': {
        await cleanup()
        return executeCreateGmailDraft({
          profileKey: opts.profileKey,
          to: opts.input?.to as string | undefined,
          subject: opts.input?.subject as string | undefined,
          body: opts.input?.body as string | undefined,
        })
      }

      case 'fill_gmail_to': {
        const result = await executeGmailFillTo({
          profileKey: opts.profileKey,
          to: String(opts.input?.to ?? ''),
        })
        const ps = await capturePageState(page)
        await cleanup()
        return { output: result.output, _page: ps }
      }

      case 'fill_gmail_subject': {
        const result = await executeGmailFillSubject({
          profileKey: opts.profileKey,
          subject: String(opts.input?.subject ?? ''),
        })
        const ps = await capturePageState(page)
        await cleanup()
        return { output: result.output, _page: ps }
      }

      case 'fill_gmail_body': {
        const result = await executeGmailFillBody({
          profileKey: opts.profileKey,
          body: String(opts.input?.body ?? ''),
        })
        const ps = await capturePageState(page)
        await cleanup()
        return { output: result.output, _page: ps }
      }

      case 'send_gmail_draft': {
        await cleanup()
        return executeSendGmailDraft({ profileKey: opts.profileKey })
      }

      case 'search_gmail': {
        await cleanup()
        return executeSearchGmail({
          profileKey: opts.profileKey,
          query: String(opts.input?.query ?? ''),
        })
      }

      case 'check_gmail_reply': {
        await cleanup()
        return executeCheckGmailReply({
          profileKey: opts.profileKey,
          lead_email: String(opts.input?.lead_email ?? ''),
          subject_hint: opts.input?.subject_hint ? String(opts.input.subject_hint) : undefined,
        })
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
    await cleanup()
  }
}
