/**
 * Login layout — passthrough only.
 * The sidebar, SetupGate and AIChatWidget are excluded by the SetupGate
 * bypass (it checks window.location.pathname for /login).
 * Do NOT add <html> or <body> here — only the root layout may do that
 * in Next.js App Router.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
