import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ChatMessage } from './openai-compat'

const execFileAsync = promisify(execFile)

export interface ClaudeCodeDetection {
  cli_detected: boolean
  token_env_detected: boolean
  local_auth_detected: boolean
  available: boolean
  detail: string
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('/bin/sh', ['-lc', `command -v ${command}`], { timeout: 1500 })
    return true
  } catch {
    return false
  }
}

export async function detectClaudeCodeLocal(): Promise<ClaudeCodeDetection> {
  const cliDetected = await commandExists('claude')
  const tokenEnvDetected = !!process.env.CLAUDE_CODE_OAUTH_TOKEN
  const localAuthDetected = cliDetected || tokenEnvDetected
  const available = cliDetected && localAuthDetected
  return {
    cli_detected: cliDetected,
    token_env_detected: tokenEnvDetected,
    local_auth_detected: localAuthDetected,
    available,
    detail: available
      ? 'Claude Code CLI/local auth detected on the server.'
      : tokenEnvDetected
        ? 'CLAUDE_CODE_OAUTH_TOKEN is present, but the claude CLI is not installed; use Anthropic API key instead.'
        : 'Claude Code local auth not detected. Use Anthropic API key instead.',
  }
}

function messagesToPrompt(messages: ChatMessage[]): string {
  return messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
}

export async function callClaudeCodeCli(messages: ChatMessage[]): Promise<string> {
  const detection = await detectClaudeCodeLocal()
  if (!detection.available) throw new Error(detection.detail)
  if (!detection.cli_detected) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is present, but the claude CLI is not installed on the server.')
  }

  const prompt = messagesToPrompt(messages)
  const { stdout } = await execFileAsync('claude', ['--print', prompt], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  })
  return stdout.trim()
}

export async function testClaudeCodeCli(): Promise<void> {
  const detection = await detectClaudeCodeLocal()
  if (!detection.available) throw new Error(detection.detail)
  if (detection.cli_detected) {
    await callClaudeCodeCli([{ role: 'user', content: 'Reply with exactly AIKO_CLAUDE_CODE_OK.' }])
  }
}
