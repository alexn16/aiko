#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function loadDotEnvLocal() {
  try {
    const text = await readFile('.env.local', 'utf-8')
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
    // .env.local is optional in hosted deployments where env comes from the platform.
  }
}

function yesNo(value) { return value ? 'yes' : 'no' }
function present(name) { return !!process.env[name] }

async function commandVersion(command, args = ['--version']) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 3000 })
    return (stdout || stderr).trim().split('\n')[0]
  } catch {
    return null
  }
}

async function commandExists(command) {
  try {
    await execFileAsync('/bin/sh', ['-lc', `command -v ${command}`], { timeout: 1500 })
    return true
  } catch {
    return false
  }
}

async function fileExists(path) {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

async function ollamaReachable() {
  const base = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
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

async function codexLocalProfileExists() {
  if (!process.env.DATABASE_URL) return null
  let client
  try {
    const pg = await import('pg')
    client = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query(
      `SELECT 1 FROM provider_connections WHERE provider_catalog_id='openai-codex-local' LIMIT 1`,
    )
    return res.rowCount > 0
  } catch {
    return null
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

await loadDotEnvLocal()

const npmVersion = await commandVersion('npm', ['--version'])
const claudeCliDetected = await commandExists('claude')
const codexCliDetected = await commandExists('codex')
const codexHome = process.env.CODEX_HOME ?? `${process.env.HOME ?? ''}/.codex`
const codexAuthDetected = await fileExists(process.env.OPENAI_CODEX_AUTH_FILE ?? `${codexHome}/auth.json`)
const codexProfileExists = await codexLocalProfileExists()
const ollamaOk = await ollamaReachable()
const chatgptConfigured = ['OPENAI_OAUTH_CLIENT_ID', 'OPENAI_OAUTH_AUTH_URL', 'OPENAI_OAUTH_TOKEN_URL', 'OPENAI_OAUTH_REDIRECT_URI'].every(present)
const claudeOAuthConfigured = ['CLAUDE_OAUTH_CLIENT_ID', 'CLAUDE_OAUTH_AUTH_URL', 'CLAUDE_OAUTH_TOKEN_URL'].every(present)
const openaiKeyPresent = present('OPENAI_API_KEY')
const anthropicKeyPresent = present('ANTHROPIC_API_KEY')

console.log('AÏKO setup check')
console.log('----------------')
console.log(`Node version: ${process.version}`)
console.log(`npm installed: ${yesNo(!!npmVersion)}${npmVersion ? ` (${npmVersion})` : ''}`)
console.log(`DATABASE_URL present: ${yesNo(present('DATABASE_URL'))}`)
console.log(`AIKO_AUTH_MODE: ${process.env.AIKO_AUTH_MODE ?? 'optional'}`)
console.log(`Ollama reachable: ${yesNo(ollamaOk)}`)
console.log(`Codex CLI detected: ${yesNo(codexCliDetected)}`)
console.log(`Codex local auth detected: ${yesNo(codexAuthDetected)}`)
console.log(`ChatGPT/Codex local profile exists: ${codexProfileExists === null ? 'unknown' : yesNo(codexProfileExists)}`)
console.log(`ChatGPT / Codex OAuth App configured: ${yesNo(chatgptConfigured)}`)
console.log(`Claude OAuth configured: ${yesNo(claudeOAuthConfigured)}`)
console.log(`Claude Code CLI detected: ${yesNo(claudeCliDetected)}`)
console.log(`CLAUDE_CODE_OAUTH_TOKEN present: ${yesNo(present('CLAUDE_CODE_OAUTH_TOKEN'))}`)
console.log(`OPENAI_API_KEY present: ${yesNo(openaiKeyPresent)}`)
console.log(`ANTHROPIC_API_KEY present: ${yesNo(anthropicKeyPresent)}`)
console.log('')

let next = 'Set DATABASE_URL, run npm install, then open /setup.'
if (!present('DATABASE_URL')) next = 'Set DATABASE_URL before running AÏKO.'
else if (codexCliDetected && codexAuthDetected) next = 'Open /setup and choose ChatGPT / Codex Local.'
else if (ollamaOk) next = 'Open /setup and choose Ollama local.'
else if (openaiKeyPresent) next = 'Open /setup and choose OpenAI API key.'
else if (anthropicKeyPresent) next = 'Open /setup and choose Anthropic API key.'
else if (chatgptConfigured) next = 'Open /setup and choose ChatGPT / Codex OAuth App.'
else if (claudeCliDetected || claudeOAuthConfigured) next = 'Open /setup and choose Claude.'
else next = 'Open /setup and connect Ollama, OpenAI API key, or Anthropic API key.'
console.log(`Suggested next step: ${next}`)
