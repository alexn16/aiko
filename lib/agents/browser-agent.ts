import { Browser, Page } from 'playwright'
import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'
import { launchBrowser, newPage } from '@/lib/browser/controller'
import { saveScreenshot } from '@/lib/browser/screenshot'

const BROWSER_SYSTEM_PROMPT = `
You are a browser agent. You control a real web browser.
You receive a screenshot of the current browser state and decide the next action.

Your response must always be a JSON object with this exact structure:
{
  "thought": "what you observe and why you are taking this action",
  "action": "click | type | scroll | navigate | extract | done | stuck",
  "coordinate": [x, y],
  "text": "text to type",
  "url": "https://...",
  "direction": "up | down",
  "data": {},
  "message": "explanation"
}

Rules:
- Only output valid JSON. No prose before or after.
- If you have successfully completed the task, use action "done".
- If you are stuck (same state 3 times in a row), use action "stuck".
- For extract actions, put all found data in the "data" field as structured JSON.
- Coordinates must be within the visible viewport (1280x800).
- Never interact with cookie banners or popups unless they block your task — dismiss them.
`

export interface BrowserTask {
  instruction: string
  agentId: string
  projectId: string
  modelConfig: LLMConfig
  onProgress?: (event: BrowserEvent) => void
}

export interface BrowserEvent {
  type: 'thought' | 'action' | 'screenshot' | 'extract' | 'done' | 'stuck' | 'error'
  data: unknown
  screenshotPath?: string
}

export async function runBrowserAgent(task: BrowserTask): Promise<unknown> {
  let browser: Browser | null = null
  let page: Page | null = null
  const extractedData: unknown[] = []

  try {
    await db.query(
      'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
      ['browsing', task.instruction, 5, task.agentId]
    )

    browser = await launchBrowser()
    page = await newPage(browser)

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    const MAX_STEPS = 60
    let stuckCount = 0
    let lastScreenshotHash = ''

    for (let step = 0; step < MAX_STEPS; step++) {
      // Check if agent was stopped
      const agentCheck = await db.query('SELECT status FROM agents WHERE id=$1', [task.agentId])
      if (agentCheck.rows[0]?.status === 'paused') break

      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      const screenshotPath = await saveScreenshot(screenshotBuffer, task.agentId, step)

      task.onProgress?.({ type: 'screenshot', data: step, screenshotPath })

      const currentHash = screenshotBase64.slice(0, 100)
      if (currentHash === lastScreenshotHash) stuckCount++
      else stuckCount = 0
      lastScreenshotHash = currentHash

      const isMultimodal = task.modelConfig.model.includes('vision') ||
                           task.modelConfig.model.includes('llava') ||
                           task.modelConfig.model.includes('4o') ||
                           task.modelConfig.model.includes('claude')

      let userContent: string
      if (isMultimodal) {
        userContent = `[SCREENSHOT:data:image/jpeg;base64,${screenshotBase64}]\n\nTask: ${task.instruction}\nStep: ${step + 1}\nCurrent URL: ${page.url()}\n${stuckCount > 1 ? `WARNING: You appear stuck (${stuckCount} identical states). Try a different approach.` : ''}`
      } else {
        const pageText = await page.evaluate(() => document.body.innerText.slice(0, 3000))
        userContent = `Task: ${task.instruction}\nStep: ${step + 1}\nCurrent URL: ${page.url()}\n\nPage content:\n${pageText}\n${stuckCount > 1 ? `WARNING: Stuck on this page. Try a different approach.` : ''}`
      }

      conversationHistory.push({ role: 'user', content: userContent })

      const response = await callLLM(
        task.modelConfig,
        [
          { role: 'system', content: BROWSER_SYSTEM_PROMPT },
          ...conversationHistory.slice(-10),
        ],
        { maxTokens: 500, jsonMode: true }
      )

      conversationHistory.push({ role: 'assistant', content: response })

      let decision: {
        thought: string
        action: string
        coordinate?: [number, number]
        text?: string
        url?: string
        direction?: string
        data?: unknown
        message?: string
      }

      try {
        decision = JSON.parse(response)
      } catch {
        task.onProgress?.({ type: 'error', data: `Invalid JSON response: ${response}` })
        continue
      }

      await db.query(
        'INSERT INTO agent_logs (agent_id, project_id, action, details, screenshot_path) VALUES ($1,$2,$3,$4,$5)',
        [task.agentId, task.projectId, 'thought', { thought: decision.thought, action: decision.action }, screenshotPath]
      )

      task.onProgress?.({ type: 'thought', data: decision.thought, screenshotPath })

      switch (decision.action) {
        case 'click':
          if (decision.coordinate) {
            await page.mouse.click(decision.coordinate[0], decision.coordinate[1])
            await page.waitForTimeout(800)
          }
          break

        case 'type':
          if (decision.text) {
            await page.keyboard.type(decision.text, { delay: 40 })
            await page.waitForTimeout(300)
          }
          break

        case 'navigate':
          if (decision.url) {
            await page.goto(decision.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
            await page.waitForTimeout(1000)
          }
          break

        case 'scroll': {
          const delta = decision.direction === 'down' ? 600 : -600
          await page.evaluate((d) => window.scrollBy(0, d), delta)
          await page.waitForTimeout(400)
          break
        }

        case 'extract':
          extractedData.push(decision.data)
          task.onProgress?.({ type: 'extract', data: decision.data })
          await db.query(
            'INSERT INTO agent_logs (agent_id, project_id, action, details) VALUES ($1,$2,$3,$4)',
            [task.agentId, task.projectId, 'data_extracted', decision.data as Record<string, unknown>]
          )
          break

        case 'done':
          task.onProgress?.({ type: 'done', data: decision.message })
          await db.query(
            'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
            ['idle', 100, decision.message ?? 'Task complete', task.agentId]
          )
          return extractedData

        case 'stuck':
          task.onProgress?.({ type: 'stuck', data: decision.message })
          await db.query(
            'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
            ['waiting', `Stuck: ${decision.message}. Awaiting instructions.`, task.agentId]
          )
          return null
      }

      const progress = Math.min(90, 5 + (step / MAX_STEPS) * 85)
      await db.query('UPDATE agents SET progress=$1, updated_at=NOW() WHERE id=$2', [Math.round(progress), task.agentId])
      task.onProgress?.({ type: 'action', data: { step, action: decision.action } })
    }

    await db.query(
      'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
      ['waiting', 'Max steps reached. Review and give new instructions.', task.agentId]
    )
    return extractedData

  } catch (error) {
    await db.query(
      'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
      ['error', String(error), task.agentId]
    )
    throw error
  } finally {
    if (browser) await browser.close()
  }
}
