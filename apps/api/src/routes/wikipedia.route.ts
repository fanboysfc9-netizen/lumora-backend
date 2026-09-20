import { Router, Request } from 'express'
import { createOptionalSupabaseAuthMiddleware } from '../middleware/supabase-auth.middleware'
import knowledgeRouter from 'core/cortex-adapt/knowledgeRouter'

const router = Router()

function cleanQuery(value: unknown) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}

function wikipediaUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname.includes('wikipedia.org') ? url.toString() : undefined
  } catch { return undefined }
}

router.post('/search', createOptionalSupabaseAuthMiddleware(), async (req: Request, res) => {
  try {
    const query = cleanQuery(req.body?.query)
    if (!query) return res.status(400).json({ ok: false, error: 'question or topic is required' })
    const results = await knowledgeRouter.fetchSerpResults(`site:wikipedia.org ${query}`, { timeoutMs: 3500 })
    const articles = results
      .map((result) => ({ ...result, source: result.source ? wikipediaUrl(result.source) : undefined }))
      .filter((result) => Boolean(result.source))
      .slice(0, 6)
    return res.json({ ok: true, query, articles })
  } catch (error: any) {
    console.error('[wikipedia] search failed', error?.message || error)
    return res.status(200).json({ ok: true, query: '', articles: [], error: 'unavailable' })
  }
})

export default router