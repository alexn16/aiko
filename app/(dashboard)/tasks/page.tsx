import { SimpleTasksPanel } from '@/components/tasks/SimpleTasksPanel'

export default function TasksPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 28 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 30, letterSpacing: 0 }}>
            Tasks
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
            Internal work created from plans and AI skills. Updating a task never runs an external action.
          </p>
        </div>
        <section style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 18,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        }}>
          <SimpleTasksPanel />
        </section>
      </div>
    </div>
  )
}
