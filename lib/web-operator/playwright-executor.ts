// Playwright executor — only imported when browser runtime is confirmed available.
// Handles actual browser actions via the existing lib/browser/controller utilities.

import type { WebOperatorAction, WebOperatorActionType } from './web-operator'

interface ExecuteResult {
  output: Record<string, unknown>
  screenshot_url?: string | null
}

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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const title = await page.title()
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) ?? '')
        const screenshot = await page.screenshot({ type: 'png' })
        const screenshotBase64 = `data:image/png;base64,${screenshot.toString('base64')}`
        return {
          output: { title, body_text: bodyText, url: page.url() },
          screenshot_url: screenshotBase64,
        }
      }

      case 'search': {
        const query = String(opts.input?.query ?? opts.description)
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const results = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('h3')).slice(0, 10)
          return items.map(h => ({ title: h.innerText, href: (h.closest('a') as HTMLAnchorElement | null)?.href ?? '' }))
        })
        return { output: { query, results } }
      }

      case 'click': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        const selector = String(opts.input?.selector ?? '')
        if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (selector) await page.click(selector, { timeout: 10000 })
        return { output: { clicked: selector, url: page.url() } }
      }

      case 'type': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        const selector = String(opts.input?.selector ?? '')
        const text = String(opts.input?.text ?? '')
        if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (selector && text) await page.fill(selector, text)
        return { output: { typed_into: selector, text } }
      }

      case 'copy_data': {
        const url = opts.target_url ?? String(opts.input?.url ?? '')
        if (!url) throw new Error('No URL provided for copy_data action')
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const data = await page.evaluate(() => document.body?.innerText?.slice(0, 10000) ?? '')
        return { output: { data, url: page.url() } }
      }

      default:
        throw new Error(`Action type "${opts.action_type}" requires manual execution or is not yet automated.`)
    }
  } finally {
    await browser.close()
  }
}
