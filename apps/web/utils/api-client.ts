import { Session } from '@supabase/supabase-js'

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
  if (!session?.access_token) throw new AuthenticationRequiredError()

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(url, { ...init, headers })
  if (response.status === 401) throw new ApiAuthenticationError()
  return response
}
