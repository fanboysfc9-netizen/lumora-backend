import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '../lib/supabase-browser'

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !isSupabaseBrowserConfigured()) {
      setError('Supabase authentication is not configured.')
      setLoading(false)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return { error: new Error('Supabase authentication is not configured.') }
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setError(result.error.message)
    return result
  }

  async function signUp(email: string, password: string, termsAccepted: boolean) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return { error: new Error('Supabase authentication is not configured.') }
    if (!termsAccepted) return { error: new Error('Accept the Terms & Conditions to create an account.') }
    const result = await supabase.auth.signUp({ email, password, options: { data: { terms_accepted: true } } })
    if (result.error) setError(result.error.message)
    return result
  }

  async function resetPassword(email: string) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return { error: new Error('Supabase authentication is not configured.') }
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` })
    if (result.error) setError(result.error.message)
    return result
  }

  async function updatePassword(password: string) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return { error: new Error('Supabase authentication is not configured.') }
    const result = await supabase.auth.updateUser({ password })
    if (result.error) setError(result.error.message)
    return result
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return { error: new Error('Supabase authentication is not configured.') }
    const result = await supabase.auth.signOut()
    if (result.error) setError(result.error.message)
    return result
  }

  async function refreshSession() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return null
    const result = await supabase.auth.getSession()
    if (result.error) setError(result.error.message)
    if (result.data.session) setSession(result.data.session)
    return result.data.session
  }

  return { session, loading, error, signIn, signUp, signOut, resetPassword, updatePassword, refreshSession }
}
