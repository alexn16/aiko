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
