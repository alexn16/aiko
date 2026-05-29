'use client'
import { signIn, useSession } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// useSearchParams requires a Suspense boundary in Next.js 14 App Router
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/ceo'
  const error = searchParams.get('error')

  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)
  const [googleOrigin, setGoogleOrigin] = useState<string | null>(null)
  const [missingEnv, setMissingEnv] = useState<string[]>([])

  // Check whether Google OAuth credentials are configured on this instance
  useEffect(() => {
    fetch('/api/auth/diagnostics')
      .then(r => r.json())
      .then(d => {
        setGoogleConfigured(
          d?.google_login?.client_id_set === true &&
          d?.google_login?.client_secret_set === true
        )
        setRedirectUri(d?.google_login?.expected_redirect_uri ?? null)
        setGoogleOrigin(d?.google_login?.google_origin ?? null)
        setMissingEnv(d?.missing_env ?? [])
      })
      .catch(() => setGoogleConfigured(null)) // unknown — don't block
  }, [])

  // Already signed in → redirect
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace(callbackUrl)
    }
  }, [status, session, router, callbackUrl])

  if (status === 'loading') return null

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
        width: '100%',
        maxWidth: 400,
        padding: '40px 36px 36px',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.04em', marginBottom: 4 }}>
            AÏKO
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            AI Marketing OS
          </div>
        </div>

        <h1 style={{ fontSize: 17, fontWeight: 600, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Sign in to AÏKO
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
          Use your Google account to sign in. This identifies you in AÏKO — it does not connect ChatGPT or Claude automatically.
        </p>

        {/* Google credentials not configured — show full setup instructions */}
        {googleConfigured === false && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
            padding: '14px 16px', marginBottom: 16, fontSize: 12, color: '#78350f',
            lineHeight: 1.7, textAlign: 'left',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
              Google OAuth not configured
            </div>

            {missingEnv.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>Missing env vars: </span>
                {missingEnv.map((v, i) => (
                  <span key={v}>
                    <code style={{ fontFamily: 'monospace', background: '#fef3c7', borderRadius: 3, padding: '1px 4px' }}>{v}</code>
                    {i < missingEnv.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}

            <div style={{ fontWeight: 600, marginBottom: 6 }}>Setup steps:</div>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <li>
                Open{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#b45309', fontWeight: 600 }}
                >
                  Google Cloud Console → APIs &amp; Services → Credentials
                </a>
              </li>
              <li>
                Click <strong>Create Credentials → OAuth 2.0 Client ID</strong>, choose <strong>Web application</strong>
              </li>
              <li>
                Under <strong>Authorized JavaScript origins</strong>, add:
                <div style={{
                  fontFamily: 'monospace', background: '#fef3c7', borderRadius: 4,
                  padding: '3px 8px', marginTop: 3, fontSize: 11, wordBreak: 'break-all',
                }}>
                  {googleOrigin ?? 'http://localhost:3001'}
                </div>
              </li>
              <li>
                Under <strong>Authorized redirect URIs</strong>, add:
                <div style={{
                  fontFamily: 'monospace', background: '#fef3c7', borderRadius: 4,
                  padding: '3px 8px', marginTop: 3, fontSize: 11, wordBreak: 'break-all',
                }}>
                  {redirectUri ?? 'http://localhost:3001/api/auth/callback/google'}
                </div>
              </li>
              <li>
                Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into{' '}
                <code style={{ fontFamily: 'monospace', background: '#fef3c7', borderRadius: 3, padding: '1px 4px' }}>.env.local</code>:
                <div style={{
                  fontFamily: 'monospace', background: '#fef3c7', borderRadius: 4,
                  padding: '6px 8px', marginTop: 3, fontSize: 11, whiteSpace: 'pre',
                }}>
                  {'GOOGLE_CLIENT_ID=your-client-id\nGOOGLE_CLIENT_SECRET=your-client-secret'}
                </div>
              </li>
              <li>
                <strong>Restart the dev server</strong> to pick up the new env vars
              </li>
            </ol>
          </div>
        )}

        {/* Sign-in error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#dc2626',
          }}>
            {error === 'OAuthSignin'
              ? 'Google OAuth failed to start. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set correctly.'
              : error === 'OAuthCallback'
              ? 'Google OAuth callback failed. Verify the redirect URI in Google Cloud Console matches: http://localhost:3001/api/auth/callback/google'
              : error === 'OAuthAccountNotLinked'
              ? 'This email is linked to a different sign-in method.'
              : error === 'Callback'
              ? 'Sign-in callback error — check server logs for details.'
              : `Sign-in error: ${error}`}
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl })}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '12px 0',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            color: '#374151',
            cursor: 'pointer',
            transition: 'background 0.1s, box-shadow 0.1s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ffffff' }}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 20, lineHeight: 1.5 }}>
          Your Google account is used only for login.{' '}
          Connect AI brains separately in <strong style={{ color: '#94a3b8' }}>Connect AI</strong>.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  )
}
