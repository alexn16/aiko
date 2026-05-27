import { redirect } from 'next/navigation'

/**
 * Legacy /approval route — redirects to the canonical /approvals page.
 * The approval_items table and /approvals route are the single source of truth.
 */
export default function LegacyApprovalRedirect() {
  redirect('/approvals')
}
