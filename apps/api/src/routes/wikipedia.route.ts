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
    const hostname = url.hostname.toLowerCase()
    if (hostname !== 'en.wikipedia.org' && hostname !== 'en.m.wikipedia.org') return undefined
    if (!url.pathname.startsWith('/wiki/')) return undefined
    url.hostname = 'en.wikipedia.org'
    return url.toString()
  } catch { return undefined }
}

async function searchWikipediaPages(query: string) {
  const apiUrl = new URL('https://en.wikipedia.org/w/api.php')
  apiUrl.search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '5',
    format: 'json'
  }).toString()
  const response = await fetch(apiUrl.toString(), {
    headers: { accept: 'application/json', 'user-agent': 'Lumora/1.0 (Wikipedia article search)' }
  })
  if (!response.ok) throw new Error(`Wikipedia search HTTP ${response.status}`)
  const data = await response.json() as { query?: { search?: Array<{ title?: string; snippet?: string }> } }
  return (data.query?.search || [])
    .filter((result) => Boolean(result.title))
    .map((result) => ({
      title: String(result.title),
      snippet: String(result.snippet || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
      source: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(result.title).replace(/ /g, '_'))}`
    }))
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
    const hasSerpApiKey = Boolean(process.env.SERP_API_KEY || process.env.SERPAPI_KEY)
    let candidates: Array<{ title: string; snippet: string; source?: string }> = []
    if (hasSerpApiKey) {
      const scopedResults = await knowledgeRouter.fetchSerpResults(`site:en.wikipedia.org ${query}`, { timeoutMs: 6000 })
      candidates = scopedResults
        .map((result) => ({ ...result, source: result.source ? wikipediaUrl(result.source) : undefined }))
        .filter((result) => Boolean(result.source))
      if (!candidates.length) {
        const generalResults = await knowledgeRouter.fetchSerpResults(query, { timeoutMs: 6000 })
        candidates = generalResults
          .map((result) => ({ ...result, source: result.source ? wikipediaUrl(result.source) : undefined }))
          .filter((result) => Boolean(result.source))
      }
    }
    if (!candidates.length) candidates = await searchWikipediaPages(query)
    const articles = await Promise.all(candidates
      .slice(0, 5)
      .map(async (result) => ({ ...result, extract: await articleExtract(result.source) })))
    return res.json({ ok: true, query, articles })
  } catch (error: any) {
    console.error('[wikipedia] search failed', error?.message || error)
    return res.status(502).json({ ok: false, error: 'Wikipedia article search is unavailable.' })
  }
})

export default router