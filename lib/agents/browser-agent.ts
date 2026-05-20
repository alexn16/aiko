import { Browser, Page } from 'playwright'
import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'
import { launchBrowser, newPage } from '@/lib/browser/controller'
import { saveScreenshot } from '@/lib/browser/screenshot'

const BROWSER_SYSTEM_PROMPT = `
You are a browser agent. You control a real web browser to complete marketing research tasks.
You receive either a screenshot (vision models) or page text (text-only models) and decide the next action.

Your response must be a JSON object with this exact structure:
{
  "thought": "what you observe and what you plan to do next",
  "action": "click | type | scroll | navigate | extract | press_key | wait | done | stuck",
  "coordinate": [x, y],
  "text": "text to type (for type action)",
  "key": "Enter | Tab | Escape | ArrowDown (for press_key action)",
  "url": "https://... (for navigate action)",
  "direction": "up | down (for scroll action)",
  "ms": 1500,
  "data": {},
  "message": "explanation for done/stuck"
}

## RULES

Output valid JSON only. No text before or after.

## ACTIONS
- click: click at [x, y] coordinate
- type: type text into the focused element (click first)
- navigate: go to a URL directly
- scroll: scroll the page up or down by ~600px
- press_key: press a keyboard key (use for Enter to submit forms, Escape to close popups)
- wait: pause for ms milliseconds (use after navigation or for lazy-loaded content, default 1500ms)
- extract: emit all data found so far into the "data" field as structured JSON
- done: task complete
- stuck: cannot make progress

## COOKIE BANNERS & POPUPS
When you see a cookie consent dialog, GDPR notice, or any popup blocking content:
- Find and click the "Accept", "Accept all", "Allow", "Agree", "OK", or "Close" button immediately
- Use Escape if no dismiss button is visible
- Do this before attempting any other action on the page

## LOGIN WALLS
If a page requires login to view content:
- Do NOT attempt to log in
- Extract whatever public information is visible
- Navigate to an alternative source or use action "done" with message "login required"

## LEAD EXTRACTION FORMAT
When extracting lead/company data, always use this structure in the data field:
{
  "leads": [
    {
      "company_name": "...",
      "contact_name": "...",
      "email": "...",
      "phone": "...",
      "website": "https://...",
      "city": "...",
      "country": "..."
    }
  ]
}

Only include fields you actually found. Never invent data.
Extract in batches — if you find 5+ leads on a page, extract them all at once before navigating.

## COORDINATES
- Viewport is 1280x800
- For text links and buttons, aim for the center of the element
- If a click doesn't work, try scrolling to reveal the element first
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

function screenshotHash(base64: string): string {
  // Sample 5 positions spread across the image for a reliable fingerprint
  const len = base64.length
  return [
    base64.slice(0, 60),
    base64.slice(Math.floor(len * 0.2), Math.floor(len * 0.2) + 40),
    base64.slice(Math.floor(len * 0.5), Math.floor(len * 0.5) + 40),
    base64.slice(Math.floor(len * 0.8), Math.floor(len * 0.8) + 40),
    String(len),
  ].join('|')
}

export async function runBrowserAgent(task: BrowserTask): Promise<unknown> {
  let browser: Browser | null = null
  let page: Page | null = null
  const extractedData: unknown[] = []

  try {
    await db.query(
      'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
      ['browsing', task.instruction.slice(0, 120), 5, task.agentId]
    )

    browser = await launchBrowser()
    page = await newPage(browser)

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    const MAX_STEPS = 60
    let stuckCount = 0
    let lastHash = ''

    for (let step = 0; step < MAX_STEPS; step++) {
      const agentCheck = await db.query('SELECT status FROM agents WHERE id=$1', [task.agentId])
      if (agentCheck.rows[0]?.status === 'paused') break

      const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75 })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      const screenshotPath = await saveScreenshot(screenshotBuffer, task.agentId, step)

      task.onProgress?.({ type: 'screenshot', data: step, screenshotPath })

      const hash = screenshotHash(screenshotBase64)
      if (hash === lastHash) stuckCount++
      else { stuckCount = 0; lastHash = hash }

      const isMultimodal = /vision|llava|4o|claude|gpt-4v|gemini/i.test(task.modelConfig.model)

      let userContent: string
      if (isMultimodal) {
        userContent = [
          `[SCREENSHOT:data:image/jpeg;base64,${screenshotBase64}]`,
          `Task: ${task.instruction}`,
          `Step: ${step + 1} / ${MAX_STEPS}`,
          `URL: ${page.url()}`,
          stuckCount >= 2 ? `⚠️ STUCK ${stuckCount}x: You are on the same page. Try a different approach, navigate elsewhere, or dismiss popups.` : '',
          `Leads extracted so far: ${extractedData.length}`,
        ].filter(Boolean).join('\n')
      } else {
        const pageText = await page.evaluate(() => {
          // Strip script/style content, get visible text
          const clone = document.documentElement.cloneNode(true) as HTMLElement
          clone.querySelectorAll('script,style,noscript').forEach(el => el.remove())
          return clone.innerText?.slice(0, 4000) ?? ''
        })
        userContent = [
          `Task: ${task.instruction}`,
          `Step: ${step + 1} / ${MAX_STEPS}`,
          `URL: ${page.url()}`,
          `Page title: ${await page.title()}`,
          stuckCount >= 2 ? `⚠️ STUCK ${stuckCount}x: Try a different approach or navigate away.` : '',
          `\nPage content:\n${pageText}`,
          `\nLeads extracted so far: ${extractedData.length}`,
        ].filter(Boolean).join('\n')
      }

      conversationHistory.push({ role: 'user', content: userContent })

      const response = await callLLM(
        task.modelConfig,
        [
          { role: 'system', content: BROWSER_SYSTEM_PROMPT },
          ...conversationHistory.slice(-12),
        ],
        { maxTokens: 600, jsonMode: true }
      )

      conversationHistory.push({ role: 'assistant', content: response })

      let decision: {
        thought: string
        action: string
        coordinate?: [number, number]
        text?: string
        key?: string
        url?: string
        direction?: string
        ms?: number
        data?: unknown
        message?: string
      }

      try {
        decision = JSON.parse(response)
      } catch {
        task.onProgress?.({ type: 'error', data: `Invalid JSON at step ${step + 1}` })
        continue
      }

      await db.query(
        'INSERT INTO agent_logs (agent_id, project_id, action, details, screenshot_path) VALUES ($1,$2,$3,$4,$5)',
        [task.agentId, task.projectId, 'thought', { thought: decision.thought, action: decision.action, url: page.url() }, screenshotPath]
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
            await page.keyboard.type(decision.text, { delay: 35 })
            await page.waitForTimeout(300)
          }
          break

        case 'press_key':
          if (decision.key) {
            await page.keyboard.press(decision.key)
            await page.waitForTimeout(600)
          }
          break

        case 'wait':
          await page.waitForTimeout(decision.ms ?? 1500)
          break

        case 'navigate':
          if (decision.url) {
            await page.goto(decision.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
            await page.waitForTimeout(1200)
          }
          break

        case 'scroll': {
          const delta = decision.direction === 'up' ? -700 : 700
          await page.evaluate((d) => window.scrollBy(0, d), delta)
          await page.waitForTimeout(400)
          break
        }

        case 'extract':
          extractedData.push(decision.data)
          task.onProgress?.({ type: 'extract', data: decision.data })
          await db.query(
            'INSERT INTO agent_logs (agent_id, project_id, action, details) VALUES ($1,$2,$3,$4)',
            [task.agentId, task.projectId, 'data_extracted', { count: extractedData.length, sample: decision.data }]
          )
          break

        case 'done':
          task.onProgress?.({ type: 'done', data: decision.message })
          await db.query(
            'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
            ['idle', 100, decision.message ?? `Task complete. Extracted ${extractedData.length} items.`, task.agentId]
          )
          return extractedData

        case 'stuck':
          task.onProgress?.({ type: 'stuck', data: decision.message })
          await db.query(
            'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
            ['waiting', `Stuck: ${decision.message ?? 'No progress possible'}. Send a new instruction to continue.`, task.agentId]
          )
          return extractedData.length > 0 ? extractedData : null
      }

      const progress = Math.min(90, 5 + (step / MAX_STEPS) * 85)
      await db.query('UPDATE agents SET progress=$1, updated_at=NOW() WHERE id=$2', [Math.round(progress), task.agentId])
      task.onProgress?.({ type: 'action', data: { step, action: decision.action } })
    }

    await db.query(
      'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
      ['waiting', `Max steps reached. Extracted ${extractedData.length} items. Send instructions to continue.`, 95, task.agentId]
    )
    return extractedData

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await db.query(
      'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
      ['error', msg.slice(0, 200), task.agentId]
    )
    throw error
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
