// Executes a previously-approved web operator action.
// Checks browser runtime and routes to playwright-executor.

import type { WebOperatorAction } from './web-operator'
import { updateWebOperatorAction } from './web-operator'
import { markStepCompleted, markStepFailed } from './action-steps'

export async function checkBrowserRuntimeAndExecute(action: WebOperatorAction): Promise<{
  success: boolean
  action: WebOperatorAction
  error?: string
}> {
  let browserAvailable = false
  try {
    const pw = await import('playwright').catch(() => null)
    browserAvailable = pw !== null
  } catch {
    browserAvailable = false
  }

  if (!browserAvailable) {
    await markStepFailed(action.id, {
      stepId: action.action_type,
      message: 'Browser runtime not configured.',
    }).catch(() => {})
    await updateWebOperatorAction(action.id, {
      status: 'approved',
      output: { error: 'Browser runtime not configured. Action is approved and will execute when runtime is connected.' },
    })
    return { success: false, action, error: 'Browser runtime not configured.' }
  }

  try {
    const { executeWebAction } = await import('./playwright-executor')
    const result = await executeWebAction(action, {
      action_type: action.action_type,
      target_url: action.target_url,
      description: action.description,
      input: action.input,
    })
    await updateWebOperatorAction(action.id, {
      status: 'completed',
      output: result.output,
      screenshot_url: result.screenshot_url ?? null,
      completed_at: new Date().toISOString(),
    })
    await markStepCompleted(action.id, {
      stepId: action.action_type,
      message: 'Approved action resumed and completed.',
      screenshot_url: result.screenshot_url ?? null,
      result: result.output,
    }).catch(() => {})
    return { success: true, action: { ...action, status: 'completed', output: result.output } }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await markStepFailed(action.id, {
      stepId: action.action_type,
      message: errMsg,
    }).catch(() => {})
    await updateWebOperatorAction(action.id, {
      status: 'failed',
      output: { error: errMsg },
      completed_at: new Date().toISOString(),
    })
    return { success: false, action: { ...action, status: 'failed' }, error: errMsg }
  }
}
