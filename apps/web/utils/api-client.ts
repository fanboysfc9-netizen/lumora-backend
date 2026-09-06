import { Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '../lib/supabase-browser'

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required. Please sign in to continue.')
    this.name = 'AuthenticationRequiredError'
  }
}

export class ApiAuthenticationError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.')
    this.name = 'ApiAuthenticationError'
  }
}

export async function authenticatedFetch(
  url: string,
  session: Pick<Session, 'access_token'> | null,
  init: RequestInit = {}
) {
  const supabase = getSupabaseBrowserClient()
  const currentSession = supabase ? (await supabase.auth.getSession()).data.session : null
  const requestSession = currentSession || session
  if (!requestSession?.access_token) throw new AuthenticationRequiredError()

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${requestSession.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(url, { ...init, headers })
  if (response.status === 401 && supabase) {
    const refreshed = (await supabase.auth.refreshSession()).data.session
    if (refreshed?.access_token && refreshed.access_token !== requestSession.access_token) {
      headers.set('Authorization', `Bearer ${refreshed.access_token}`)
      const retry = await fetch(url, { ...init, headers })
      if (retry.status !== 401) return retry
    }
  }
  if (response.status === 401) throw new ApiAuthenticationError()
  return response
}
