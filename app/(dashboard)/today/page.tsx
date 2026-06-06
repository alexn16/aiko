import Link from 'next/link'
import { getDailyBrief } from '@/lib/daily-brief'

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: 28,
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 18,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

const linkButton: React.CSSProperties = {
  display: 'inline-flex',
  border: '1px solid #dbeafe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
}

function ItemList({ title, items, empty }: {
  title: string
  items: Array<{ type: string; title: string; description: string; href: string; action_label: string }>
  empty: string
}) {
  return (
    <section style={cardStyle}>
      <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 12 }}>{title}</div>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(item => (
            <div key={`${item.type}-${item.title}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <div style={{ color: '#0f172a', fontSize: 15, fontWeight: 900 }}>{item.title}</div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{item.description}</div>
              <Link href={item.href} style={{ ...linkButton, marginTop: 10 }}>{item.action_label}</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default async function TodayPage() {
  const brief = await getDailyBrief()

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: '#2563eb', fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
            {brief.date}
          </div>
          <h1 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 32, letterSpacing: 0 }}>
            Today
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
            {brief.greeting} {brief.today_summary}
          </p>
        </div>

        <section style={{ ...cardStyle, marginBottom: 16, borderColor: '#bfdbfe', background: '#f8fbff' }}>
          <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
            Recommended next action
          </div>
          {brief.recommended_next_action ? (
            <>
              <p style={{ margin: '0 0 12px', color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
                <b>{brief.recommended_next_action.title}</b><br />
                {brief.recommended_next_action.description}
              </p>
              <Link href={brief.recommended_next_action.href} style={linkButton}>
                {brief.recommended_next_action.action_label}
              </Link>
            </>
          ) : (
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Choose what you want AÏKO to work on.</p>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <ItemList title="Priority" items={brief.priority_items.slice(0, 8)} empty="No urgent items need attention." />
          <ItemList title="Waiting for you" items={brief.waiting_for_user} empty="No manual help needed." />
          <ItemList title="Approvals" items={brief.pending_approvals} empty="No approvals needed." />
          <ItemList title="Blocked tasks" items={brief.blocked_tasks} empty="No blocked tasks." />
          <ItemList title="Next tasks" items={brief.next_tasks.slice(0, 5)} empty="Tasks created from plans will appear here." />

          <section style={cardStyle}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#334155', marginBottom: 12 }}>Recent output</div>
            {brief.recent_outputs.length === 0 ? (
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Generated reports and files will appear here.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {brief.recent_outputs.map(output => (
                  <Link key={`${output.type}-${output.id}`} href={output.href} style={{
                    display: 'block',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 12,
                    textDecoration: 'none',
                  }}>
                    <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 900 }}>{output.title}</div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                      {output.type}{output.project_name ? ` · ${output.project_name}` : ''}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
