'use client'
import { AgentCard } from '@/components/agents/AgentCard'
import { Agent } from '@/lib/db/schema'

interface AgentGridProps {
  agents: Agent[]
  maxCount?: number
}

export function AgentGrid({ agents, maxCount }: AgentGridProps) {
  const visible = maxCount ? agents.slice(0, maxCount) : agents

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 12,
    }}>
      {visible.map(agent => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
