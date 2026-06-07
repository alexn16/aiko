/**
 * lib/browser/controller.ts
 *
 * Browser launch abstraction for Web Operator.
 *
 * Modes (WEB_OPERATOR_BROWSER_MODE):
 *   isolated      — Playwright Chromium, no persistent profile (original default)
 *   persistent    — Playwright Chromium, AÏKO-managed persistent profile dir (new default)
 *   system_chrome — Installed Google Chrome, owner-configured profile
 *
 * System Chrome is recommended for local owner use so Kevin can reuse
 * existing logins (Canva, Gmail, LinkedIn, etc.) in a dedicated Chrome profile.
 *
 * Safety: this module never runs during npm test or npm run build.
 * Callers are responsible for not invoking browser launch in test contexts.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import os from 'os'
import path from 'path'
import { existsSync } from 'fs'
import { mkdirSync } from 'fs'

export type BrowserMode = 'isolated' | 'persistent' | 'system_chrome'

// ── Mode resolution ────────────────────────────────────────────────────────────

export function getBrowserMode(): BrowserMode {
  const raw = process.env.WEB_OPERATOR_BROWSER_MODE?.toLowerCase().trim()
  if (raw === 'isolated') return 'isolated'
  if (raw === 'system_chrome') return 'system_chrome'
  return 'persistent'
}

export function isHeadless(): boolean {
  if (process.env.WEB_OPERATOR_HEADLESS !== undefined) {
    return process.env.WEB_OPERATOR_HEADLESS !== 'false'
  }
  if (process.env.BROWSER_HEADLESS !== undefined) {
    return process.env.BROWSER_HEADLESS !== 'false'
  }
  // system_chrome is always headed — it is meant for owner-supervised work.
  if (getBrowserMode() === 'system_chrome') return false
  return true
}

// ── Chrome executable detection ────────────────────────────────────────────────

const CHROME_PATHS_MACOS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
]

const CHROME_PATHS_LINUX = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

export function detectChromeExecutable(): string | null {
  const envPath = process.env.WEB_OPERATOR_CHROME_EXECUTABLE_PATH?.trim()
  if (envPath) return envPath

  const candidates =
    process.platform === 'darwin' ? CHROME_PATHS_MACOS :
    process.platform === 'linux' ? CHROME_PATHS_LINUX : []

  return candidates.find(p => existsSync(p)) ?? null
}

// ── Profile directory ──────────────────────────────────────────────────────────

export function getChromeUserDataDir(): string | null {
  const envDir = process.env.WEB_OPERATOR_CHROME_USER_DATA_DIR?.trim()
  if (envDir) return envDir.replace(/^~/, os.homedir())

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
  }
  if (process.platform === 'linux') {
    return path.join(os.homedir(), '.config', 'google-chrome')
  }
  return null
}

export function getChromeProfileDirectory(): string {
  return process.env.WEB_OPERATOR_CHROME_PROFILE_DIRECTORY?.trim() || 'Default'
}

/**
 * Full path for a persistent Playwright context using AÏKO's own Chromium.
 * Each operator gets its own subfolder so contexts don't collide.
 */
export function getAikoPersistentProfileDir(profileKey: string): string {
  const base = process.env.WEB_OPERATOR_PROFILE_BASE_DIR
    ? path.resolve(process.env.WEB_OPERATOR_PROFILE_BASE_DIR)
    : path.join(process.cwd(), '.operator-profiles-persistent')
  const dir = path.join(base, profileKey)
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── Health check ───────────────────────────────────────────────────────────────

export type ChromeSetupStatus = {
  mode: BrowserMode
  chrome_executable: string | null
  chrome_found: boolean
  chrome_user_data_dir: string | null
  chrome_profile_directory: string
  ready: boolean
  owner_message: string
  setup_instructions: string
}

export function getChromeSetupStatus(): ChromeSetupStatus {
  const mode = getBrowserMode()
  const exe = detectChromeExecutable()
  const userDataDir = getChromeUserDataDir()
  const profileDir = getChromeProfileDirectory()
  const ready = mode !== 'system_chrome' || (!!exe)

  let owner_message: string
  let setup_instructions: string

  if (mode === 'system_chrome') {
    if (!exe) {
      owner_message = 'Google Chrome was not found. Set WEB_OPERATOR_CHROME_EXECUTABLE_PATH or use AÏKO profile mode.'
      setup_instructions = 'Install Google Chrome or set WEB_OPERATOR_CHROME_EXECUTABLE_PATH in .env.local.'
    } else {
      owner_message = 'Kevin will use your normal Chrome profile.'
      setup_instructions = profileDir === 'Default'
        ? 'Tip: Create a Chrome profile named "AÏKO", log in to your sites once, then set WEB_OPERATOR_CHROME_PROFILE_DIRECTORY=AÏKO.'
        : `Using Chrome profile: ${profileDir}`
    }
  } else if (mode === 'persistent') {
    owner_message = 'Kevin uses an AÏKO-managed Chromium profile. Logins persist between sessions.'
    setup_instructions = 'Set WEB_OPERATOR_BROWSER_MODE=system_chrome in .env.local to use your real Chrome browser.'
  } else {
    owner_message = 'Kevin uses an isolated Chromium session. No logins are saved between sessions.'
    setup_instructions = 'Set WEB_OPERATOR_BROWSER_MODE=persistent or system_chrome for persistent logins.'
  }

  return {
    mode,
    chrome_executable: exe,
    chrome_found: !!exe,
    chrome_user_data_dir: userDataDir,
    chrome_profile_directory: profileDir,
    ready,
    owner_message,
    setup_instructions,
  }
}

// ── Browser launch ─────────────────────────────────────────────────────────────

/** Guard: throw if called during test runs. */
function assertNotTest(context: string): void {
  if (process.env.NODE_ENV === 'test') {
    throw new Error(`${context} is disabled during tests.`)
  }
}

/**
 * Launch a new isolated Playwright Chromium browser (one-shot, no profile).
 * Used for simple single-page tasks that don't need login persistence.
 */
export async function launchBrowser(): Promise<Browser> {
  assertNotTest('System browser launch')
  return chromium.launch({
    headless: isHeadless(),
    slowMo: isHeadless() ? 0 : 50,
  })
}

/**
 * Launch a persistent browser context.
 *
 * Mode selection:
 *   system_chrome  → Chrome executable + configured Chrome profile dir
 *   persistent     → Playwright Chromium + AÏKO-managed persistent profile dir
 *   isolated       → Playwright Chromium + temp context (no userDataDir)
 *
 * Returns the BrowserContext directly (launchPersistentContext returns a context, not a browser).
 */
export async function launchPersistentBrowserContext(profileKey: string): Promise<BrowserContext> {
  assertNotTest('System browser launch')
  const mode = getBrowserMode()
  const headed = !isHeadless()

  if (mode === 'system_chrome') {
    const exe = detectChromeExecutable()
    if (!exe) {
      throw new Error(
        'Google Chrome was not found. Set WEB_OPERATOR_CHROME_EXECUTABLE_PATH in .env.local, or set WEB_OPERATOR_BROWSER_MODE=persistent to use AÏKO\'s Chromium profile.',
      )
    }
    const userDataDir = getChromeUserDataDir()
    const profileDir = getChromeProfileDirectory()

    // Use a dedicated AÏKO dir inside the Chrome user data dir, or a standalone dir.
    // We do NOT default to the user's Default profile to avoid conflicts when Chrome is open.
    const aikoProfileDir = userDataDir
      ? path.join(userDataDir, profileDir)
      : path.join(os.homedir(), '.aiko-chrome-profile')

    mkdirSync(aikoProfileDir, { recursive: true })

    try {
      return await chromium.launchPersistentContext(aikoProfileDir, {
        executablePath: exe,
        headless: false,
        slowMo: 50,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
        ],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/lock|already running|single instance/i.test(msg)) {
        throw new Error(
          'Chrome profile is already in use. Close Chrome or configure a dedicated AÏKO Chrome profile.\n' +
          'Tip: Create a Chrome profile named "AÏKO", set WEB_OPERATOR_CHROME_PROFILE_DIRECTORY=AÏKO in .env.local, then try again.',
        )
      }
      throw err
    }
  }

  if (mode === 'persistent') {
    const profileDir = getAikoPersistentProfileDir(profileKey)
    return chromium.launchPersistentContext(profileDir, {
      headless: !headed,
      slowMo: headed ? 50 : 0,
    })
  }

  // isolated — launch fresh Chromium, new context, no stored state
  const browser = await launchBrowser()
  return browser.newContext()
}

export async function newPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  return page
}
