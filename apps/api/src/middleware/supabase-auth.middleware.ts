import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextFunction, Request, Response } from 'express'

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; accessToken: string }
    }
  }
}

export function getBearerToken(req: Request): string | null {
  const header = req.header('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase authentication is not configured')

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

async function authenticateWithClient(req: Request, res: Response, next: NextFunction, client?: Pick<SupabaseClient, 'auth'>) {
  const token = getBearerToken(req)
  if (!token) return res.status(401).json({ error: 'authentication required' })

  try {
    const supabase = client || getSupabaseClient()
    const { data, error } = await supabase.auth.getUser(token)
    const userId = data.user?.id
    if (error || !userId) return res.status(401).json({ error: 'invalid or expired authentication' })

    req.auth = { userId, accessToken: token }
    return next()
  } catch (error) {
    console.error('[auth] Supabase token validation failed:', error instanceof Error ? error.message : error)
    return res.status(401).json({ error: 'invalid or expired authentication' })
  }
}

export function createSupabaseAuthMiddleware(client?: Pick<SupabaseClient, 'auth'>) {
  return (req: Request, res: Response, next: NextFunction) => authenticateWithClient(req, res, next, client)
}

export async function authenticateSupabaseRequest(req: Request, res: Response, next: NextFunction) {
  return authenticateWithClient(req, res, next)
}

export default authenticateSupabaseRequest