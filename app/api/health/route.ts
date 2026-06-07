import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db/client'
import { getAuthMode } from '@/lib/auth-mode'
import { getSetupState } from '@/lib/setup-state'
import { checkAssignedBrainHealth, formatProviderHealthForOwner } from '@/lib/ai/provider-health'
import pkg from '@/package.json'

export const dynamic = 'force-dynamic'

interface DatabaseHealth {
  ok: boolean
  error: string | null
}

function summarizeDatabaseError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  if (message.includes('connection') || message.includes('econnrefused')) return 'database_connection_failed'
  if (message.includes('timeout')) return 'database_timeout'
  if (message.includes('does not exist')) return 'database_schema_missing'
  if (message.includes('password') || message.includes('authentication')) return 'database_auth_failed'
  if (message.includes('database_url') || message.includes('connectionstring')) return 'database_url_invalid'
  return 'database_unavailable'
}

async function checkDatabase(): Promise<DatabaseHealth> {
  try {
    await db.query('SELECT 1')
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: summarizeDatabaseError(err) }
  }
}

async function checkPlaywrightRuntime(): Promise<boolean> {
  try {
    const pw = await import('playwright').catch(() => null)
    return pw !== null
  } catch {
    return false
  }
}

async function checkWritable(relativeDir: string): Promise<boolean> {
  const base = path.resolve(process.cwd(), relativeDir)
  const marker = `.aiko-health-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const filePath = path.join(base, marker)
  try {
    await fs.mkdir(base, { recursive: true })
    await fs.writeFile(filePath, 'ok', 'utf-8')
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [database, setup, runtimeAvailable, generatedWritable, screenshotsWritable, brainHealth] = await Promise.all([
    checkDatabase(),
    getSetupState().catch(() => ({ setup_required: true, can_ceo_think: false })),
    checkPlaywrightRuntime(),
    checkWritable(path.join('storage', 'generated-files')),
    checkWritable(process.env.SCREENSHOT_PATH ?? 'screenshots'),
    checkAssignedBrainHealth('ceo').catch(() => null),
  ])

  const health = {
    ok: database.ok && generatedWritable && screenshotsWritable,
    version: typeof pkg.version === 'string' ? pkg.version : null,
    timestamp: new Date().toISOString(),
    auth_mode: getAuthMode(),
    database,
    setup: {
      required: !!setup.setup_required,
      can_ceo_think: !!setup.can_ceo_think,
    },
    web_operator: {
      runtime_available: runtimeAvailable,
      headed_mode: process.env.WEB_OPERATOR_HEADLESS === 'false',
    },
    storage: {
      generated_files_writable: generatedWritable,
      screenshots_writable: screenshotsWritable,
    },
    brain: brainHealth ? formatProviderHealthForOwner(brainHealth) : null,
  }

  return NextResponse.json(health, { status: health.ok ? 200 : 503 })
}
