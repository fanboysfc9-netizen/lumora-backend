import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type VerifiedAuth = { userId: string; accessToken: string }

function getClient(auth: VerifiedAuth): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase account storage is not configured')

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.accessToken}` } }
  })
}

async function readSingle(client: SupabaseClient, table: string, userId: string, select: string) {
  const { data, error } = await client.from(table).select(select).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function getCurrentProfile(auth: VerifiedAuth) {
  const { data, error } = await getClient(auth).from('profiles').select('id,display_name,created_at,updated_at,terms_accepted_at').eq('id', auth.userId).maybeSingle()
  if (error) throw error
  return data
}

export async function updateCurrentProfile(auth: VerifiedAuth, input: { displayName?: string }) {
  const displayName = input.displayName === undefined ? undefined : String(input.displayName).trim().slice(0, 80)
  if (displayName === undefined) throw new Error('no profile changes supplied')
  const { data, error } = await getClient(auth)
    .from('profiles')
    .update({ display_name: displayName || null, updated_at: new Date().toISOString() })
    .eq('id', auth.userId)
    .select('id,display_name,created_at,updated_at,terms_accepted_at')
    .single()
  if (error) throw error
  return data
}

export async function getCurrentSubscription(auth: VerifiedAuth) {
  return readSingle(getClient(auth), 'subscriptions', auth.userId, 'id,user_id,plan_id,status,current_period_start,current_period_end,created_at,updated_at')
}

export async function getCurrentPlan(auth: VerifiedAuth) {
  const subscription: any = await getCurrentSubscription(auth)
  if (!subscription) return null
  const { data, error } = await getClient(auth).from('plans').select('id,name,display_name,description,is_active').eq('id', subscription.plan_id).maybeSingle()
  if (error) throw error
  return data
}

export async function getCurrentEntitlements(auth: VerifiedAuth) {
  const plan = await getCurrentPlan(auth)
  if (!plan || !plan.is_active) return []
  const { data, error } = await getClient(auth).from('entitlements').select('id,plan_id,feature_key,feature_value').eq('plan_id', plan.id)
  if (error) throw error
  return data || []
}

export async function getCurrentUsage(auth: VerifiedAuth) {
  const periodStart = new Date()
  periodStart.setUTCDate(1)
  const { data, error } = await getClient(auth).from('usage_counters').select('user_id,period_start,request_count,created_at,updated_at').eq('user_id', auth.userId).eq('period_start', periodStart.toISOString().slice(0, 10)).maybeSingle()
  if (error) throw error
  return data
}

export async function getCurrentAccount(auth: VerifiedAuth) {
  const [profile, subscription, plan, entitlements, usage] = await Promise.all([
    getCurrentProfile(auth),
    getCurrentSubscription(auth),
    getCurrentPlan(auth),
    getCurrentEntitlements(auth),
    getCurrentUsage(auth)
  ])
  return { profile, subscription, plan, entitlements, usage }
}

export default { getCurrentProfile, updateCurrentProfile, getCurrentSubscription, getCurrentPlan, getCurrentEntitlements, getCurrentUsage, getCurrentAccount }
