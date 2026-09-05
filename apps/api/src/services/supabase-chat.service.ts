import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { VerifiedAuth } from './account.service'

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string; mode?: string }

function client(auth: VerifiedAuth): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase chat storage is not configured')

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.accessToken}` } }
  })
}

async function getOwnedConversation(supabase: SupabaseClient, auth: VerifiedAuth, conversationId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function getOrCreateConversation(supabase: SupabaseClient, auth: VerifiedAuth, conversationId?: string) {
  if (conversationId) {
    const existing = await getOwnedConversation(supabase, auth, conversationId)
    if (!existing) throw new Error('conversation not found')
    return existing.id
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: auth.userId, title: 'New conversation' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function persistExchange(auth: VerifiedAuth, conversationId: string | undefined, messages: ChatMessage[]) {
  const supabase = client(auth)
  const id = await getOrCreateConversation(supabase, auth, conversationId)
  const rows = messages.map((message) => ({
    conversation_id: id,
    user_id: auth.userId,
    role: message.role,
    content: message.content,
    meta: message.mode ? { mode: message.mode } : {}
  }))

  const { error: messageError } = await supabase.from('messages').insert(rows)
  if (messageError) throw messageError

  const { error: conversationError } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.userId)
  if (conversationError) throw conversationError

  return id
}

export async function getHistory(auth: VerifiedAuth, conversationId?: string, limit = 200) {
  const supabase = client(auth)
  let selectedConversationId = conversationId

  if (selectedConversationId) {
    const owned = await getOwnedConversation(supabase, auth, selectedConversationId)
    if (!owned) throw new Error('conversation not found')
  } else {
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    selectedConversationId = data?.id
  }

  if (!selectedConversationId) return { conversationId: null, history: [] }

  const { data, error } = await supabase
    .from('messages')
    .select('role,content,created_at')
    .eq('conversation_id', selectedConversationId)
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  return {
    conversationId: selectedConversationId,
    history: (data || []).map((message) => ({ role: message.role, text: message.content }))
  }
}

export default { persistExchange, getHistory }
