import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    if (!client) client = createClient(parsed.toString(), key)
  } catch {
    return null
  }
  return client
}

export function isSupabaseBrowserConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
