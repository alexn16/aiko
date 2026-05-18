import { chromium, Browser, Page } from 'playwright'

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: process.env.BROWSER_HEADLESS !== 'false',
  })
}

export async function newPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  return page
}
