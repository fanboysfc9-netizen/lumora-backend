export type YouTubeVideo = {
  videoId: string
  title: string
  thumbnailUrl: string
  channelTitle: string
  publishedAt: string | null
  watchUrl: string
  embedUrl: string
}

export type YouTubeSearchResult = {
  enabled: boolean
  videos: YouTubeVideo[]
  cached?: boolean
  error?: 'not_configured' | 'invalid_query' | 'unavailable'
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_LIMIT = 32
const cache = new Map<string, { expiresAt: number; videos: YouTubeVideo[] }>()

export function normalizeYouTubeQuery(value: unknown) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function safeVideo(item: any): YouTubeVideo | null {
  const videoId = typeof item?.id?.videoId === 'string' ? item.id.videoId.trim() : ''
  const snippet = item?.snippet
  if (!videoId || !snippet || typeof snippet.title !== 'string') return null
  return {
    videoId,
    title: snippet.title.slice(0, 240),
    thumbnailUrl: typeof snippet.thumbnails?.medium?.url === 'string' ? snippet.thumbnails.medium.url : '',
    channelTitle: typeof snippet.channelTitle === 'string' ? snippet.channelTitle.slice(0, 160) : '',
    publishedAt: typeof snippet.publishedAt === 'string' ? snippet.publishedAt : null,
    watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
  }
}

export function clearYouTubeCache() {
  cache.clear()
}

export async function searchYouTube(value: unknown, options: { fetchImpl?: FetchLike; apiKey?: string; timeoutMs?: number } = {}): Promise<YouTubeSearchResult> {
  const query = normalizeYouTubeQuery(value)
  if (!query) return { enabled: Boolean(options.apiKey || process.env.YOUTUBE_API_KEY), videos: [], error: 'invalid_query' }

  const apiKey = options.apiKey || process.env.YOUTUBE_API_KEY
  if (!apiKey) return { enabled: false, videos: [], error: 'not_configured' }

  const key = query.toLowerCase()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { enabled: true, videos: cached.videos, cached: true }
  if (cached) cache.delete(key)

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${query} educational tutorial`,
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '6',
    relevanceLanguage: 'en',
    key: apiKey
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000)
  try {
    const response = await (options.fetchImpl || fetch)(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, { signal: controller.signal })
    if (!response.ok) return { enabled: true, videos: [], error: 'unavailable' }
    const payload = await response.json() as any
    const videos = Array.isArray(payload?.items) ? payload.items.map(safeVideo).filter(Boolean) as YouTubeVideo[] : []
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, videos })
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
    return { enabled: true, videos }
  } catch {
    return { enabled: true, videos: [], error: 'unavailable' }
  } finally {
    clearTimeout(timeout)
  }
}

export default { searchYouTube, normalizeYouTubeQuery, clearYouTubeCache }