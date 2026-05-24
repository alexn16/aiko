import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Page } from 'playwright'

const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH ?? './screenshots'

// Web Operator screenshot directory — served as static files by Next.js
const OPERATOR_SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots')

/**
 * Capture a screenshot from a Playwright Page and save it to public/screenshots/.
 * Returns the relative URL path (/screenshots/op-{uuid}.png) or null on failure.
 * Never throws.
 */
export async function takeScreenshot(page: Page): Promise<string | null> {
  try {
    fs.mkdirSync(OPERATOR_SCREENSHOT_DIR, { recursive: true })
    const uuid = randomUUID()
    const filename = `op-${uuid}.png`
    const filePath = path.join(OPERATOR_SCREENSHOT_DIR, filename)
    await page.screenshot({ path: filePath, type: 'png' })
    return `/screenshots/${filename}`
  } catch {
    return null
  }
}

export async function saveScreenshot(
  buffer: Buffer,
  agentId: string,
  step: number
): Promise<string> {
  const dir = path.join(SCREENSHOT_PATH, agentId)
  fs.mkdirSync(dir, { recursive: true })

  const filename = `step-${String(step).padStart(3, '0')}.jpg`
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  // Also write a 'latest.jpg' for BrowserStream polling
  const latestPath = path.join(dir, 'latest.jpg')
  fs.writeFileSync(latestPath, buffer)

  return filePath
}

export function getLatestScreenshotPath(agentId: string): string {
  return path.join(SCREENSHOT_PATH, agentId, 'latest.jpg')
}
