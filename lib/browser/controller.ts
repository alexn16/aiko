import { chromium, Browser, Page } from 'playwright'

/**
 * Resolve headless setting.
 *
 * Priority order:
 *   1. WEB_OPERATOR_HEADLESS — specific to Web Operator sessions
 *   2. BROWSER_HEADLESS     — legacy generic flag
 *   3. Default: true        — headless by default (safe for server)
 *
 * Set WEB_OPERATOR_HEADLESS=false to see the browser window locally.
 * This is useful when a site shows a CAPTCHA/login that needs human help.
 */
function isHeadless(): boolean {
  if (process.env.WEB_OPERATOR_HEADLESS !== undefined) {
    return process.env.WEB_OPERATOR_HEADLESS !== 'false'
  }
  if (process.env.BROWSER_HEADLESS !== undefined) {
    return process.env.BROWSER_HEADLESS !== 'false'
  }
  return true
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: isHeadless(),
    // In headed mode, keep the browser open long enough for manual takeover
    slowMo: isHeadless() ? 0 : 50,
  })
}

export async function newPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  return page
}
