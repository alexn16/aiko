import fs from 'fs'
import path from 'path'

const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH ?? './screenshots'

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
