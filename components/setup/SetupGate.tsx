'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SetupStateResponse {
  setup_required: boolean
}

export function SetupGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/setup/state')
      .then(r => r.json() as Promise<SetupStateResponse>)
      .then(d => { setSetupRequired(!!d.setup_required); setChecked(true) })
      .catch(() => { setSetupRequired(true); setChecked(true) })
  }, [])

  useEffect(() => {
    if (!checked || !setupRequired) return
    const path = window.location.pathname
    const exempt = ['/setup', '/connect-ai', '/login', '/api/']
    if (!exempt.some(p => path.startsWith(p))) {
      router.replace('/setup')
    }
  }, [checked, setupRequired, router])

  if (!checked) return null
  return <>{children}</>
}
