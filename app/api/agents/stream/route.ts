import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: object) => `data: ${JSON.stringify(data)}\n\n`

      const interval = setInterval(async () => {
        try {
          const [agents, logs, leads] = await Promise.all([
            db.query('SELECT * FROM agents WHERE project_id=$1 ORDER BY name', [projectId]),
            db.query(
              `SELECT * FROM agent_logs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20`,
              [projectId]
            ),
            db.query(
              `SELECT id, company_name, contact_name, email, city, status, lat, lng
               FROM leads WHERE project_id=$1 AND lat IS NOT NULL ORDER BY created_at DESC`,
              [projectId]
            ),
          ])

          controller.enqueue(
            new TextEncoder().encode(
              encode({ type: 'state', agents: agents.rows, logs: logs.rows, leads: leads.rows })
            )
          )
        } catch {
          clearInterval(interval)
          controller.close()
        }
      }, 1500)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
