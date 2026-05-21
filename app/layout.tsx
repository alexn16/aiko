import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'AÏKO — AI Marketing OS',
  description: 'Open, self-hostable AI marketing operating system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8fafc', color: '#0f172a', display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
