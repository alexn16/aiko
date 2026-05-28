/**
 * Login layout — standalone, no sidebar or SetupGate.
 * Used by /login and /api/auth/* redirects.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
