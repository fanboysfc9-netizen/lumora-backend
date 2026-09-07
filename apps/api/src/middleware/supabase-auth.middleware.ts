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

export function sanitizeAuthDiagnosticMessage(value: unknown): string {
  return String(value || 'unknown')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .slice(0, 240)
}

function logSupabaseConfigDiagnostic() {
  const url = process.env.SUPABASE_URL || ''
  const anonConfigured = Boolean(process.env.SUPABASE_ANON_KEY)
  const publishableConfigured = Boolean(process.env.SUPABASE_PUBLISHABLE_KEY)
  let host = 'unknown'
  try { host = url ? new URL(url).hostname : 'invalid' } catch {}
  console.error('[AUTH_DIAGNOSTIC] supabase_config', JSON.stringify({
    urlConfigured: Boolean(url),
    host,
    anonKeyConfigured: anonConfigured,
    publishableKeyConfigured: publishableConfigured,
    selectedKey: anonConfigured ? 'SUPABASE_ANON_KEY' : publishableConfigured ? 'SUPABASE_PUBLISHABLE_KEY' : 'none'
  }))
}

function logSupabaseVerificationDiagnostic(error: any, data: any) {
  console.error('[AUTH_DIAGNOSTIC] token_verification', JSON.stringify({
    result: error || !data?.user?.id ? 'failed' : 'success',
    status: typeof error?.status === 'number' ? error.status : undefined,
    code: typeof error?.code === 'string' ? error.code : undefined,
    name: typeof error?.name === 'string' ? error.name : undefined,
    message: sanitizeAuthDiagnosticMessage(error?.message)
  }))
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
    logSupabaseConfigDiagnostic()
    const supabase = client || getSupabaseClient()
    const { data, error } = await supabase.auth.getUser(token)
    logSupabaseVerificationDiagnostic(error, data)
    const userId = data.user?.id
    if (error || !userId) return res.status(401).json({ error: 'invalid or expired authentication' })

    req.auth = { userId, accessToken: token }
    return next()
  } catch (error) {
    console.error('[AUTH_DIAGNOSTIC] token_verification_exception', JSON.stringify({
      name: typeof (error as any)?.name === 'string' ? (error as any).name : undefined,
      status: typeof (error as any)?.status === 'number' ? (error as any).status : undefined,
      code: typeof (error as any)?.code === 'string' ? (error as any).code : undefined,
      message: sanitizeAuthDiagnosticMessage((error as any)?.message)
    }))
    return res.status(401).json({ error: 'invalid or expired authentication' })
  }
}

export function createSupabaseAuthMiddleware(client?: Pick<SupabaseClient, 'auth'>) {
  return (req: Request, res: Response, next: NextFunction) => authenticateWithClient(req, res, next, client)
}

export function createOptionalSupabaseAuthMiddleware(client?: Pick<SupabaseClient, 'auth'>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!getBearerToken(req)) return next()
    return authenticateWithClient(req, res, next, client)
  }
}

export async function authenticateSupabaseRequest(req: Request, res: Response, next: NextFunction) {
  return authenticateWithClient(req, res, next)
}

export default authenticateSupabaseRequest