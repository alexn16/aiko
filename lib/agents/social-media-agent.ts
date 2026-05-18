import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runSocialMediaAgent(params: {
  projectId: string
  agentId: string
  platform: string
  modelConfig: LLMConfig
}) {
  const { projectId, agentId, platform, modelConfig } = params

  const projectResult = await db.query('SELECT * FROM projects WHERE id=$1', [projectId])
  const project = projectResult.rows[0]

  const recentWins = await db.query(
    `SELECT COUNT(*) as qualified FROM leads WHERE project_id=$1 AND status='qualified'`,
    [projectId]
  )

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
    ['writing', `Drafting ${platform} post`, agentId]
  )

  const result = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a social media agent for B2B marketing. Write a ${platform} post that showcases value without being salesy.
Max 200 words. Use the project context and recent performance.
Return JSON: { "post": "the content", "hashtags": ["tag1", "tag2"] }`
    },
    {
      role: 'user',
      content: `Project: ${project.name}
Value prop: ${project.value_prop}
Target: ${project.target_market}
Recent wins: ${recentWins.rows[0]?.qualified ?? 0} qualified leads`
    }
  ], { jsonMode: true, maxTokens: 400 })

  const { post, hashtags } = JSON.parse(result)
  const body = `${post}\n\n${hashtags.map((h: string) => `#${h}`).join(' ')}`

  await db.query(
    `INSERT INTO approvals (project_id, agent_name, channel, body)
     VALUES ($1,$2,$3,$4)`,
    [projectId, 'Social Media Agent', 'social', body]
  )

  await db.query(
    'UPDATE agents SET status=$1, latest_output=$2, progress=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 'Post ready for approval', 100, agentId]
  )
}
