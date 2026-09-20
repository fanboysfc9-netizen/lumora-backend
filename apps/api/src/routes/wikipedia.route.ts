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

async function articleExtract(source: string | undefined) {
  if (!source) return ''
  try {
    const title = decodeURIComponent(new URL(source).pathname.split('/wiki/')[1] || '').replace(/_/g, ' ')
    if (!title) return ''
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { accept: 'application/json' } })
    if (!response.ok) return ''
    const data = await response.json() as { extract?: string }
    return String(data.extract || '').slice(0, 5000)
  } catch { return '' }
}

router.post('/search', createOptionalSupabaseAuthMiddleware(), async (req: Request, res) => {
  try {
    const query = cleanQuery(req.body?.query)
    if (!query) return res.status(400).json({ ok: false, error: 'question or topic is required' })
    const results = await knowledgeRouter.fetchSerpResults(`site:wikipedia.org ${query}`, { timeoutMs: 3500 })
    const articles = await Promise.all(results
      .map((result) => ({ ...result, source: result.source ? wikipediaUrl(result.source) : undefined }))
      .filter((result) => Boolean(result.source))
      .slice(0, 6)
      .map(async (result) => ({ ...result, extract: await articleExtract(result.source) })))
    return res.json({ ok: true, query, articles })
  } catch (error: any) {
    console.error('[wikipedia] search failed', error?.message || error)
    return res.status(200).json({ ok: true, query: '', articles: [], error: 'unavailable' })
  }
})

export default router