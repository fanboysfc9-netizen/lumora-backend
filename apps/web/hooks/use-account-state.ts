import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { ApiAuthenticationError, authenticatedFetch } from '../utils/api-client'

export type AccountState = {
  profile: { id: string; display_name?: string | null; created_at: string; updated_at: string; terms_accepted_at?: string | null } | null
  subscription: Record<string, unknown> | null
  plan: Record<string, unknown> | null
  entitlements: Array<{ feature_key: string; feature_value: unknown }>
  usage: Record<string, unknown> | null
}

function accountUrl(apiUrl: string) {
  return apiUrl.replace(/\/chat\/?$/, '/account')
}

export function useAccountState(session: Pick<Session, 'access_token'> & { user: { id: string } } | null, apiUrl: string) {
  const [account, setAccount] = useState<AccountState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!session) {
      setAccount(null)
      setError(null)
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    setError(null)
    authenticatedFetch(accountUrl(apiUrl), session)
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || 'account data unavailable')
        if (active) setAccount(payload.account || null)
      })
      .catch((reason) => {
        if (!active) return
        if (reason instanceof ApiAuthenticationError) setAccount(null)
        setError(reason instanceof Error ? reason.message : 'account data unavailable')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [session?.user.id, session?.access_token, apiUrl])

  async function updateProfile(displayName: string) {
    if (!session) return { error: new Error('authentication required') }
    const response = await authenticatedFetch(`${accountUrl(apiUrl)}/profile`, session, { method: 'PATCH', body: JSON.stringify({ displayName }) })
    const payload = await response.json()
    if (!response.ok) return { error: new Error(payload?.error || 'profile update failed') }
    setAccount((current) => current ? { ...current, profile: payload.profile } : current)
    return { profile: payload.profile }
  }

  return { account, loading, error, updateProfile }
}
