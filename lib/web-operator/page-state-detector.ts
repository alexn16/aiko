/**
 * lib/web-operator/page-state-detector.ts
 *
 * Detects login walls, CAPTCHA screens, security checkpoints, and 2FA prompts.
 * Called after every major navigation step in the Playwright executor.
 *
 * Safety rules:
 *   - Detection is purely observational — no bypass, no auto-solve.
 *   - When any blocker is detected, automation stops and operator is set to
 *     waiting_user so the human can take over.
 *   - Never claims to have solved a CAPTCHA automatically.
 *   - Screenshot is suppressed on credential/password pages (is_sensitive=true).
 */

import type { Page } from 'playwright'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PageStateType =
  | 'normal'
  | 'login_required'
  | 'captcha_detected'
  | 'security_checkpoint'
  | 'two_factor_required'
  | 'manual_takeover_required'

export interface PageState {
  type: PageStateType
  url: string
  title: string
  requires_manual_takeover: boolean
  waiting_reason: string | null
  /** Human-readable message shown in the UI */
  user_message: string | null
  is_sensitive: boolean
}

// ── Signal patterns ────────────────────────────────────────────────────────────

const LOGIN_URL_PATTERNS = [
  /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i, /\/authenticate/i,
  /\/session\/new/i, /\/account\/login/i, /\/users\/login/i,
  /accounts\.google\.com/i, /login\.microsoftonline\.com/i,
  /login\.live\.com/i, /appleid\.apple\.com/i, /auth0\.com/i,
]

const LOGIN_TITLE_PATTERNS = [
  /\bsign in\b/i, /\blog in\b/i, /\blogin\b/i, /\bauthentication\b/i,
  /\baccess your account\b/i, /\bacceder\b/i, /\bidentifíquese\b/i,
]

const LOGIN_TEXT_PATTERNS = [
  /contraseña/i, /\bpassword\b/i, /\benter your password\b/i,
  /\bforgot password\b/i, /\bsign in to\b/i, /\blog into\b/i,
  /iniciar sesión/i, /\bemail.{0,20}password\b/i,
]

const CAPTCHA_URL_PATTERNS = [
  /\/sorry\//i, /\/captcha/i, /recaptcha/i, /hcaptcha/i,
  /\/interstitial/i, /\/challenge/i, /\/verify/i,
]

const CAPTCHA_TEXT_PATTERNS = [
  /unusual traffic/i, /verify you are human/i, /are you a robot/i,
  /i am not a robot/i, /prove you're human/i, /security check/i,
  /please complete the security check/i, /please verify/i,
  /recaptcha/i, /hcaptcha/i, /\bcaptcha\b/i,
  /automated queries/i, /bot detection/i,
  /comprueba que eres humano/i, /tráfico inusual/i,
]

const SECURITY_CHECKPOINT_PATTERNS = [
  /security checkpoint/i, /account locked/i, /suspicious activity/i,
  /protect your account/i, /verify your identity/i,
  /we noticed unusual activity/i, /checkpoint/i,
  /account verification/i, /verify it's you/i,
  /we've detected suspicious/i, /actividad sospechosa/i,
]

const TWO_FACTOR_PATTERNS = [
  /two.?factor/i, /2-step verification/i, /2fa/i,
  /authentication code/i, /verification code/i, /enter the code/i,
  /check your phone/i, /sent a text/i, /authenticator app/i,
  /verificación en dos pasos/i, /código de verificación/i,
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text))
}

// ── Core detector ─────────────────────────────────────────────────────────────

/**
 * Inspect the current page and return its detected state.
 * Never throws — always returns a result.
 */
export async function detectPageState(page: Page): Promise<PageState> {
  let url = ''
  let title = ''
  let bodyText = ''

  try {
    url = page.url()
    title = await page.title().catch(() => '')
    bodyText = await page.evaluate(() =>
      (document.body?.innerText ?? '').slice(0, 2000)
    ).catch(() => '')
  } catch {
    return {
      type: 'normal', url, title,
      requires_manual_takeover: false,
      waiting_reason: null, user_message: null, is_sensitive: false,
    }
  }

  const combined = `${url} ${title} ${bodyText}`

  // 2FA check first (most specific)
  if (matchesAny(combined, TWO_FACTOR_PATTERNS)) {
    return {
      type: 'two_factor_required',
      url, title,
      requires_manual_takeover: true,
      waiting_reason: 'two_factor_required',
      user_message: 'Two-factor authentication is required. Please complete it in the browser, then click "Login / CAPTCHA completed".',
      is_sensitive: true,
    }
  }

  // Security checkpoint
  if (matchesAny(combined, SECURITY_CHECKPOINT_PATTERNS)) {
    return {
      type: 'security_checkpoint',
      url, title,
      requires_manual_takeover: true,
      waiting_reason: 'security_checkpoint',
      user_message: 'A security checkpoint appeared. Please complete it in the browser, then click "Login / CAPTCHA completed".',
      is_sensitive: false,
    }
  }

  // CAPTCHA (URL or text signals)
  if (matchesAny(url, CAPTCHA_URL_PATTERNS) || matchesAny(combined, CAPTCHA_TEXT_PATTERNS)) {
    return {
      type: 'captcha_detected',
      url, title,
      requires_manual_takeover: true,
      waiting_reason: 'captcha_detected',
      user_message: 'A CAPTCHA appeared. Please solve it in the browser, then click "Login / CAPTCHA completed". The operator will not attempt to bypass it automatically.',
      is_sensitive: false,
    }
  }

  // Login wall (URL or title or body text)
  if (
    matchesAny(url, LOGIN_URL_PATTERNS) ||
    matchesAny(title, LOGIN_TITLE_PATTERNS) ||
    matchesAny(bodyText, LOGIN_TEXT_PATTERNS)
  ) {
    return {
      type: 'login_required',
      url, title,
      requires_manual_takeover: true,
      waiting_reason: 'login_required',
      user_message: 'Login is required. Please sign in in the browser, then click "Login / CAPTCHA completed".',
      is_sensitive: true,
    }
  }

  return {
    type: 'normal', url, title,
    requires_manual_takeover: false,
    waiting_reason: null, user_message: null,
    is_sensitive: isSensitiveUrl(url),
  }
}

/** Convenience wrappers */
export async function isLoginRequired(page: Page): Promise<boolean> {
  const s = await detectPageState(page)
  return s.type === 'login_required'
}

export async function isCaptchaDetected(page: Page): Promise<boolean> {
  const s = await detectPageState(page)
  return s.type === 'captcha_detected'
}

export async function isSecurityCheckpoint(page: Page): Promise<boolean> {
  const s = await detectPageState(page)
  return s.type === 'security_checkpoint' || s.type === 'two_factor_required'
}

export async function isManualTakeoverRequired(page: Page): Promise<boolean> {
  const s = await detectPageState(page)
  return s.requires_manual_takeover
}

// ── Sensitive URL check (suppress screenshot) ──────────────────────────────────

function isSensitiveUrl(url: string): boolean {
  const patterns = [/login/i, /signin/i, /password/i, /auth/i, /account\/security/i, /2fa/i, /verify/i]
  return patterns.some(p => p.test(url))
}

// ── Structured error for CAPTCHA/login blocks ──────────────────────────────────

export class ManualTakeoverRequired extends Error {
  public readonly pageState: PageState
  constructor(state: PageState) {
    super(state.user_message ?? 'Manual takeover required.')
    this.name = 'ManualTakeoverRequired'
    this.pageState = state
  }
}
