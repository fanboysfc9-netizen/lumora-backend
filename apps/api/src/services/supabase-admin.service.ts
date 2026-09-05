import { createClient, SupabaseClient } from '@supabase/supabase-js'

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Account deletion is not configured')
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function deleteAuthUser(userId: string) {
  const { error } = await getAdminClient().auth.admin.deleteUser(userId)
  if (error) throw error
}

export default { deleteAuthUser }
