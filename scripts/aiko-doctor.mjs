#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function loadDotEnvFile(fileName) {
  try {
    const text = await readFile(fileName, 'utf-8')
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Environment files are optional in hosted deployments.
  }
}

function yesNo(value) {
  return value ? 'yes' : 'no'
}

function present(name) {
  return Boolean(process.env[name])
}

async function commandVersion(command, args = ['--version']) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 3000 })
    return (stdout || stderr).trim().split('\n')[0]
  } catch {
    return null
  }
}

async function ollamaReachable() {
  const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/tags`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function playwrightReady() {
  try {
    const { chromium } = await import('playwright')
    await access(chromium.executablePath())
    return true
  } catch {
    return false
  }
}

async function writableDirectory(rawPath) {
  const dir = rawPath || '.'
  const checkFile = join(dir, '.aiko-doctor-check')
  try {
    await mkdir(dirname(checkFile), { recursive: true })
    await writeFile(checkFile, 'ok', 'utf-8')
    await rm(checkFile, { force: true })
    return true
  } catch {
    return false
  }
}

await loadDotEnvFile('.env')
await loadDotEnvFile('.env.local')

const npmVersion = await commandVersion('npm', ['--version'])
const ollamaOk = await ollamaReachable()
const playwrightOk = await playwrightReady()
const generatedFilesWritable = await writableDirectory(process.env.GENERATED_FILES_DIR || 'storage/generated-files')
const screenshotsWritable = await writableDirectory(
  process.env.SCREENSHOTS_DIR || process.env.SCREENSHOT_PATH || 'screenshots',
)
const chatgptOAuthConfigured = [
  'OPENAI_OAUTH_CLIENT_ID',
  'OPENAI_OAUTH_AUTH_URL',
  'OPENAI_OAUTH_TOKEN_URL',
  'OPENAI_OAUTH_REDIRECT_URI',
].every(present)
const claudeOAuthConfigured = [
  'CLAUDE_OAUTH_CLIENT_ID',
  'CLAUDE_OAUTH_AUTH_URL',
  'CLAUDE_OAUTH_TOKEN_URL',
].every(present)

const blockers = [
  ['DATABASE_URL present', present('DATABASE_URL')],
  ['npm available', Boolean(npmVersion)],
  ['Playwright Chromium installed', playwrightOk],
  ['generated files storage writable', generatedFilesWritable],
  ['screenshots storage writable', screenshotsWritable],
]

console.log('AÏKO doctor')
console.log('-----------')
console.log(`Node version: ${process.version}`)
console.log(`npm installed: ${yesNo(Boolean(npmVersion))}${npmVersion ? ` (${npmVersion})` : ''}`)
console.log(`DATABASE_URL present: ${yesNo(present('DATABASE_URL'))}`)
console.log(`AIKO_AUTH_MODE: ${process.env.AIKO_AUTH_MODE || 'optional'}`)
console.log(`NEXTAUTH_URL present: ${yesNo(present('NEXTAUTH_URL'))}`)
console.log(`Auth secret present: ${yesNo(present('AUTH_SECRET') || present('NEXTAUTH_SECRET'))}`)
console.log(`Ollama reachable: ${yesNo(ollamaOk)}`)
console.log(`Playwright Chromium installed: ${yesNo(playwrightOk)}`)
console.log(`Generated files storage writable: ${yesNo(generatedFilesWritable)}`)
console.log(`Screenshots storage writable: ${yesNo(screenshotsWritable)}`)
console.log(`Web Operator headed mode: ${yesNo(process.env.WEB_OPERATOR_HEADLESS === 'false')}`)
console.log('')
console.log('Provider configuration')
console.log(`OpenAI API key: ${yesNo(present('OPENAI_API_KEY'))}`)
console.log(`Anthropic API key: ${yesNo(present('ANTHROPIC_API_KEY'))}`)
console.log(`OpenRouter API key: ${yesNo(present('OPENROUTER_API_KEY'))}`)
console.log(`ChatGPT / Codex OAuth: ${yesNo(chatgptOAuthConfigured)}`)
console.log(`Claude OAuth: ${yesNo(claudeOAuthConfigured)}`)
console.log(`Claude Code token: ${yesNo(present('CLAUDE_CODE_OAUTH_TOKEN'))}`)
console.log('')

const failed = blockers.filter(([, ok]) => !ok).map(([label]) => label)
if (failed.length) {
  console.log('Blockers')
  for (const label of failed) console.log(`- ${label}`)
  process.exitCode = 1
} else {
  console.log('No local readiness blockers found.')
}
