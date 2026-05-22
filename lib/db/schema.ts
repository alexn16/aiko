export interface ModelConfig {
  id: string
  agent_slot: string
  base_url: string
  api_key: string
  model: string
  context_window: number
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  target_market: string | null
  value_prop: string | null
  strategy: Record<string, unknown> | null
  active: boolean
  created_at: string
}

export interface Agent {
  id: string
  project_id: string
  name: string
  role: string
  status: 'idle' | 'active' | 'browsing' | 'writing' | 'waiting' | 'error' | 'paused'
  current_task: string | null
  progress: number
  latest_output: string | null
  updated_at: string
}

export interface AgentLog {
  id: string
  agent_id: string
  project_id: string
  action: 'thought' | 'browser_action' | 'data_extracted' | 'message_generated' | 'error'
  details: Record<string, unknown> | null
  screenshot_path: string | null
  created_at: string
}

export interface Lead {
  id: string
  project_id: string
  company_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  country: string
  lat: number | null
  lng: number | null
  source: string | null
  source_url: string | null
  status: 'new' | 'contacted' | 'replied' | 'qualified' | 'rejected'
  notes: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
}

export interface Approval {
  id: string
  project_id: string
  lead_id: string
  agent_name: string | null
  channel: 'email' | 'linkedin' | 'whatsapp' | 'form' | 'social'
  subject: string | null
  body: string
  status: 'pending' | 'quality_passed' | 'quality_rejected' | 'approved' | 'rejected' | 'sent'
  sent_at: string | null
  created_at: string
}

export interface Campaign {
  id: string
  project_id: string
  name: string
  channel: string | null
  status: string
  stats: { sent: number; opened: number; replied: number; qualified: number }
  created_at: string
}

export interface Setting {
  id: string
  key: string
  value: Record<string, unknown>
  updated_at: string
}

// ── CEO Multi-Project System ──────────────────────────────────────────────────

export interface CompanyMemory {
  id: string
  summary: string
  global_priorities: string[]
  active_projects: string[]
  blocked_items: string[]
  last_updated_by: string
  updated_at: string
}

export interface ProjectMemory {
  id: string
  project_id: string
  notes: string
  next_steps: string[]
  blockers: string[]
  context: Record<string, unknown>
  updated_at: string
}

export interface ProjectMap {
  id: string
  project_id: string
  nodes: Array<{ id: string; label: string; type: string; count?: number }>
  edges: Array<{ from: string; to: string }>
  updated_at: string
}

export interface ProjectManager {
  id: string
  name: string
  specialty: string
  status: 'available' | 'busy' | 'away'
  project_id: string | null
  current_focus: string
  created_at: string
}

export interface CeoCommand {
  id: string
  command: string
  response: string
  intent: string
  actions: Array<{ type: string; data: Record<string, unknown> }>
  project_id: string | null
  created_at: string
}

export interface ProjectWithPM extends Project {
  goal: string | null
  assigned_pm_id: string | null
  pm_name?: string | null
}

export interface CeoReviewFinding {
  project_id: string
  project_name: string
  status: 'healthy' | 'attention' | 'blocked' | 'stale'
  issues: string[]
  positive: string[]
}

export interface PMReport {
  id: string
  project_id: string
  project_manager_id: string | null
  pm_name: string | null
  project_name?: string
  status: 'healthy' | 'attention' | 'blocked' | 'stale'
  summary: string
  progress: number
  blockers: string[]
  completed_work: string[]
  current_focus: string
  recommended_next_actions: string[]
  needs_client_approval: boolean
  created_at: string
}

export interface CeoReview {
  id: string
  summary: string
  project_count: number
  active_project_count: number
  pending_approval_count: number
  blocked_project_count: number
  priority_project_id: string | null
  priority_project_name: string | null
  findings: CeoReviewFinding[]
  recommended_actions: string[]
  created_at: string
}
