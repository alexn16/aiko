import cron from 'node-cron'
import { db } from '@/lib/db/client'
import { getAllModelConfigs } from '@/lib/models/config'
import { runCeoAgent } from '@/lib/agents/ceo-agent'
import { runProjectManagerAgent } from '@/lib/agents/project-manager-agent'

async function runScheduledAgents() {
  try {
    const configs = await getAllModelConfigs()
    const fallback = configs['researchAgent'] ?? Object.values(configs)[0]
    if (!fallback) return

    const projects = await db.query('SELECT id FROM projects WHERE active=true')

    for (const project of projects.rows) {
      const [ceoRow, pmRow] = await Promise.all([
        db.query("SELECT id FROM agents WHERE project_id=$1 AND name='CEO Agent' LIMIT 1", [project.id]),
        db.query("SELECT id FROM agents WHERE project_id=$1 AND name='Project Manager Agent' LIMIT 1", [project.id]),
      ])

      if (ceoRow.rows[0]) {
        await runCeoAgent({
          projectId: project.id,
          agentId: ceoRow.rows[0].id,
          modelConfig: configs['ceoAgent'] ?? fallback,
        }).catch(err => console.error('[scheduler] CEO agent error:', err))
      }

      if (pmRow.rows[0]) {
        await runProjectManagerAgent({
          projectId: project.id,
          agentId: pmRow.rows[0].id,
          modelConfig: configs['projectManagerAgent'] ?? fallback,
        }).catch(err => console.error('[scheduler] PM agent error:', err))
      }
    }
  } catch (err) {
    console.error('[scheduler] error:', err)
  }
}

export function setupScheduler() {
  // CEO and PM agents run every 30 minutes as per spec
  cron.schedule('*/30 * * * *', runScheduledAgents)
  console.log('[scheduler] CEO + PM agents scheduled every 30 minutes')
}
