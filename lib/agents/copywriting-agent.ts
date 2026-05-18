import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'
import { runQualityAgent } from '@/lib/agents/quality-agent'

export async function generateOutreachMessage(params: {
  leadId: string
  projectId: string
  channel: 'email' | 'linkedin' | 'whatsapp' | 'form'
  modelConfig: LLMConfig
  agentId: string
  qualityModelConfig?: LLMConfig
}) {
  const { leadId, projectId, channel, modelConfig, agentId, qualityModelConfig } = params

  const leadResult = await db.query('SELECT * FROM leads WHERE id=$1', [leadId])
  const projectResult = await db.query('SELECT * FROM projects WHERE id=$1', [projectId])
  const lead = leadResult.rows[0]
  const project = projectResult.rows[0]

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
    ['writing', `Writing ${channel} message for ${lead.company_name}`, agentId]
  )

  const wordLimits: Record<string, number> = {
    email: 120, linkedin: 60, whatsapp: 50, form: 100
  }

  const result = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a B2B copywriting agent. You write short, direct, human outreach messages.
Never write like a robot or a mass-marketing template.
Always write in the same language as the target market.
Return only JSON: { "subject": "email subject or empty string", "body": "message body" }`
    },
    {
      role: 'user',
      content: `
Project: ${project.name}
Description: ${project.description}
Target market: ${project.target_market}
Value proposition: ${project.value_prop}

Lead:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name ?? 'unknown'}
- City: ${lead.city ?? 'unknown'}
- Website: ${lead.website ?? 'not available'}

Channel: ${channel}
Word limit: ${wordLimits[channel]} words maximum

Write one outreach message. Be specific. Be human. One clear call to action.`
    }
  ], { jsonMode: true })

  const { subject, body } = JSON.parse(result)

  const approvalResult = await db.query(
    `INSERT INTO approvals (project_id, lead_id, agent_name, channel, subject, body)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [projectId, leadId, 'Copywriting Agent', channel, subject, body]
  )
  const approvalId = approvalResult.rows[0].id

  // Quality check — runs automatically after every message generation
  if (qualityModelConfig) {
    await runQualityAgent({ approvalId, modelConfig: qualityModelConfig })
  }

  await db.query(
    'UPDATE agents SET status=$1, latest_output=$2, updated_at=NOW() WHERE id=$3',
    ['idle', `Message ready for approval: ${subject || body.slice(0, 50)}`, agentId]
  )

  return approvalResult.rows[0]
}
