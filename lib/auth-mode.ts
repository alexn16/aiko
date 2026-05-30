/**
 * AIKO_AUTH_MODE controls whether Google login is required for all routes.
 *
 *   optional (default) — /connect-ai and /api/providers/** are accessible
 *                        without a session. Provider connections can be stored
 *                        with user_id = null (global / single-user mode).
 *
 *   required           — all dashboard routes require a session. Matches
 *                        multi-tenant / hosted deployments.
 */

export function isAuthOptional(): boolean {
  return (process.env.AIKO_AUTH_MODE ?? 'optional') !== 'required'
}

export function isAuthRequired(): boolean {
  return !isAuthOptional()
}

export function getAuthMode(): 'optional' | 'required' {
  return isAuthOptional() ? 'optional' : 'required'
}
