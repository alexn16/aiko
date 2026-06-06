import { SimpleTasksPanel } from '@/components/tasks/SimpleTasksPanel'
import { PageShell } from '@/components/ui/PageShell'
import { MinimalCard } from '@/components/ui/MinimalCard'

export default function TasksPage() {
  return (
    <PageShell title="Tasks" subtitle="Internal work only. Updating a task never runs an external action." maxWidth={980}>
      <MinimalCard>
        <SimpleTasksPanel />
      </MinimalCard>
    </PageShell>
  )
}
