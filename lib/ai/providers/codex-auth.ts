import { execFile, spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { db } from '@/lib/db/client'
import type { ChatMessage } from './openai-compat'

const execFileAsync = promisify(execFile)
const CODEX_PROVIDER_ID = 'openai-codex-local'
const CODEX_DISPLAY_NAME = 'ChatGPT / Codex Local'
const CODEX_REFERENCE = 'codex-local-auth'
const DEFAULT_TIMEOUT_MS = 120_000

export type CodexAuthStatusValue =
  | 'connected'
  | 'auth_detected'
  | 'cli_detected'
  | 'not_detected'
  | 'test_failed'

export interface CodexLocalAuthStatus {
  provider: 'openai-codex-local'
  codex_cli_detected: boolean
  auth_file_detected: boolean
  auth_profile_exists: boolean
  connected: boolean
  needs_login: boolean
  account_email: string | null
  status: CodexAuthStatusValue
  can_import: boolean
  can_test: boolean
  instructions: string
  last_error: string | null
}

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
}

function authFileCandidates(): string[] {
  return [
    process.env.OPENAI_CODEX_AUTH_FILE,
    path.join(codexHome(), 'auth.json'),
  ].filter(Boolean) as string[]
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function sanitizeCodexMessage(message: string | null | undefined): string | null {
  if (!message) return null
  const home = os.homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return message
    .replace(new RegExp(`${home}[^\\s'"]*`, 'g'), '[local path]')
    .replace(/\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/\.codex\/[^\s'"]+/g, '[codex auth file]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted_api_key]')
    .replace(/(access_token|refresh_token|id_token)["'\s:=]+[A-Za-z0-9._~+/=-]+/gi, '$1=[redacted]')
    .slice(0, 500)
}

async function commandVersion(command: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, ['--version'], { timeout: 3000 })
    return (stdout || stderr).trim().split('\n')[0] || null
  } catch {
    return null
  }
}

function runCodexExec(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(new Error('Codex CLI timed out before returning a test response.'))
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Codex CLI exited with code ${code}: ${(stderr || stdout).trim()}`))
      }
    })
    child.stdin.end()
  })
}

export async function detectCodexCli(): Promise<{ detected: boolean; version: string | null }> {
  const version = await commandVersion('codex')
  return { detected: !!version, version }
}

export async function detectCodexAuthFiles(): Promise<{
  detected: boolean
  auth_mode: string | null
  account_email: string | null
}> {
  for (const candidate of authFileCandidates()) {
    if (!(await exists(candidate))) continue
    try {
      const raw = await readFile(candidate, 'utf-8')
      const parsed = JSON.parse(raw) as {
        auth_mode?: unknown
        account_email?: unknown
        email?: unknown
        tokens?: Record<string, unknown>
      }
      const authMode = typeof parsed.auth_mode === 'string' ? parsed.auth_mode : null
      const email =
        typeof parsed.account_email === 'string' ? parsed.account_email :
        typeof parsed.email === 'string' ? parsed.email :
        null
      const hasTokenShape = !!parsed.tokens && typeof parsed.tokens === 'object'
      return {
        detected: authMode === 'chatgpt' || hasTokenShape,
        auth_mode: authMode,
        account_email: email,
      }
    } catch {
      return { detected: true, auth_mode: null, account_email: null }
    }
  }
  return { detected: false, auth_mode: null, account_email: null }
}

async function getCodexProfile(userId?: string | null) {
  const res = await db.query(
    `SELECT id, status, account_email, last_error
     FROM provider_connections
     WHERE provider_catalog_id = $1 AND (user_id = $2 OR user_id IS NULL)
     ORDER BY user_id NULLS LAST, updated_at DESC
     LIMIT 1`,
    [CODEX_PROVIDER_ID, userId ?? null],
  )
  return res.rows[0] as { id: string; status: string; account_email: string | null; last_error: string | null } | undefined
}

export function getCodexAuthInstructions(): string {
  return 'Install Codex and sign in with ChatGPT locally. Run `codex login` or `codex --login`, complete the browser sign-in, then return to AÏKO and click Detect again.'
}

export async function getCodexAuthStatus(userId?: string | null): Promise<CodexLocalAuthStatus> {
  const [cli, auth, profile] = await Promise.all([
    detectCodexCli(),
    detectCodexAuthFiles(),
    getCodexProfile(userId),
  ])
  const connected = profile?.status === 'connected'
  const status: CodexAuthStatusValue = connected
    ? 'connected'
    : profile?.status === 'error'
      ? 'test_failed'
      : auth.detected
        ? 'auth_detected'
        : cli.detected
          ? 'cli_detected'
          : 'not_detected'

  return {
    provider: CODEX_PROVIDER_ID,
    codex_cli_detected: cli.detected,
    auth_file_detected: auth.detected,
    auth_profile_exists: !!profile,
    connected,
    needs_login: cli.detected && !auth.detected,
    account_email: profile?.account_email ?? auth.account_email,
    status,
    can_import: cli.detected && auth.detected,
    can_test: !!profile && cli.detected && auth.detected,
    instructions: getCodexAuthInstructions(),
    last_error: sanitizeCodexMessage(profile?.last_error) ?? null,
  }
}

export async function importCodexAuthProfile(userId?: string | null): Promise<{ ok: true; profile_id: string } | { ok: false; error: string; status: CodexLocalAuthStatus }> {
  const status = await getCodexAuthStatus(userId)
  if (!status.codex_cli_detected || !status.auth_file_detected) {
    return {
      ok: false,
      error: 'Codex local auth was not detected. Run codex login / sign in with ChatGPT using Codex, then return to AÏKO and click Detect again.',
      status,
    }
  }

  const existing = await getCodexProfile(userId)
  if (existing) return { ok: true, profile_id: existing.id }

  const inserted = await db.query(
    `INSERT INTO provider_connections
       (name, display_name, type, status, model, provider_catalog_id, compatibility,
        auth_type, auth_method, local_token_reference, account_email, user_id,
        supports_streaming, supports_chat, supports_tools, last_error, updated_at)
     VALUES ($1, $2, 'chatgpt_codex_local', 'not_connected', $3, $4, 'openai_codex',
             'local', 'local', $5, $6, $7, false, true, false, NULL, NOW())
     RETURNING id`,
    [
      CODEX_DISPLAY_NAME,
      CODEX_DISPLAY_NAME,
      process.env.CODEX_MODEL || 'codex-cli-default',
      CODEX_PROVIDER_ID,
      CODEX_REFERENCE,
      status.account_email,
      userId ?? null,
    ],
  )
  return { ok: true, profile_id: inserted.rows[0].id }
}

function messagesToPrompt(messages: ChatMessage[], jsonMode?: boolean): string {
  const rendered = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n')
  return jsonMode
    ? `${rendered}\n\nReturn only the final answer. If JSON was requested above, return valid JSON only.`
    : `${rendered}\n\nReturn only the final answer.`
}

export async function callCodexCli(
  messages: ChatMessage[],
  opts: { model?: string | null; jsonMode?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const prompt = messagesToPrompt(messages, opts.jsonMode)
  const args = [
    'exec',
    '--sandbox', 'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
    '--color', 'never',
  ]
  if (opts.model && opts.model !== 'codex-cli-default') {
    args.push('--model', opts.model)
  }
  args.push(prompt)

  const { stdout, stderr } = await runCodexExec(args, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const output = stdout.trim() || stderr.trim()
  if (!output) throw new Error('Codex CLI returned no output.')
  return output
}

export async function testCodexAuthProfile(userId?: string | null): Promise<{ ok: boolean; error?: string; output?: string; profile_id?: string }> {
  const importResult = await importCodexAuthProfile(userId)
  if (!importResult.ok) return { ok: false, error: importResult.error }

  try {
    const output = await callCodexCli([
      { role: 'system', content: 'You are testing AÏKO Codex local auth. Reply with exactly AIKO_CODEX_OK.' },
      { role: 'user', content: 'Return exactly AIKO_CODEX_OK.' },
    ], { timeoutMs: 120_000 })

    if (!output.includes('AIKO_CODEX_OK')) {
      throw new Error('Codex local auth test returned an unexpected response.')
    }

    await db.query(
      `UPDATE provider_connections
       SET status='connected', last_tested_at=NOW(), last_error=NULL, updated_at=NOW()
       WHERE id=$1`,
      [importResult.profile_id],
    )
    return { ok: true, output: 'AIKO_CODEX_OK', profile_id: importResult.profile_id }
  } catch (err) {
    const message = sanitizeCodexMessage(err instanceof Error ? err.message : String(err)) ?? 'Codex local auth test failed.'
    await db.query(
      `UPDATE provider_connections
       SET status='error', last_tested_at=NOW(), last_error=$1, updated_at=NOW()
       WHERE id=$2`,
      [message, importResult.profile_id],
    )
    return { ok: false, error: message, profile_id: importResult.profile_id }
  }
}
