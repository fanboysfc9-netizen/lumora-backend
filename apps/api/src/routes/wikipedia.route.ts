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
    return url.hostname.toLowerCase() === 'en.wikipedia.org' ? url.toString() : undefined
  } catch { return undefined }
}

async function articleExtract(source: string | undefined) {
  if (!source) return ''
  try {
    const title = decodeURIComponent(new URL(source).pathname.split('/wiki/')[1] || '').replace(/_/g, ' ').trim()
    if (!title) return ''
    const apiUrl = new URL('https://en.wikipedia.org/w/api.php')
    apiUrl.search = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      explaintext: '1',
      exchars: '12000',
      redirects: '1',
      titles: title,
      format: 'json',
      formatversion: '2'
    }).toString()
    const response = await fetch(apiUrl.toString(), {
      headers: { accept: 'application/json', 'user-agent': 'Lumora/1.0 (Wikipedia article search)' }
    })
    if (!response.ok) return ''
    const data = await response.json() as { query?: { pages?: Array<{ extract?: string }> } }
    return String(data.query?.pages?.[0]?.extract || '').slice(0, 12000)
  } catch { return '' }
}

router.post('/search', createOptionalSupabaseAuthMiddleware(), async (req: Request, res) => {
  try {
    const query = cleanQuery(req.body?.query)
    if (!query) return res.status(400).json({ ok: false, error: 'question or topic is required' })
    if (!(process.env.SERP_API_KEY || process.env.SERPAPI_KEY)) {
      return res.status(503).json({ ok: false, error: 'Article search is not configured.' })
    }
    const scopedResults = await knowledgeRouter.fetchSerpResults(`site:en.wikipedia.org ${query}`, { timeoutMs: 3500 })
    const results = scopedResults.length ? scopedResults : await knowledgeRouter.fetchSerpResults(query, { timeoutMs: 3500 })
    const articles = await Promise.all(results
      .map((result) => ({ ...result, source: result.source ? wikipediaUrl(result.source) : undefined }))
      .filter((result) => Boolean(result.source))
      .slice(0, 5)
      .map(async (result) => ({ ...result, extract: await articleExtract(result.source) })))
    return res.json({ ok: true, query, articles })
  } catch (error: any) {
    console.error('[wikipedia] search failed', error?.message || error)
    return res.status(502).json({ ok: false, error: 'Wikipedia article search is unavailable.' })
  }
})

export default router