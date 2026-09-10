import { clearYouTubeCache, searchYouTube } from '../services/youtube.service'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export async function run() {
  clearYouTubeCache()
  const missing = await searchYouTube('algebra', { apiKey: '' })
  assert(missing.error === 'not_configured' && missing.videos.length === 0, 'Missing API key must disable search safely')

  const invalid = await searchYouTube('   ', { apiKey: 'test-key' })
  assert(invalid.error === 'invalid_query', 'Blank queries must be rejected')

  let calls = 0
  const fetchImpl = async (url: string) => {
    calls += 1
    assert(url.includes('key=test-key'), 'The server must send the configured key to YouTube')
    return response({ items: [{ id: { videoId: 'abc123' }, snippet: { title: 'Algebra basics', channelTitle: 'Learning channel', publishedAt: '2026-01-01', thumbnails: { medium: { url: 'https://img.example/thumb.jpg' } } } }] })
  }
  const first = await searchYouTube('Algebra   JHS', { apiKey: 'test-key', fetchImpl })
  const second = await searchYouTube('algebra jhs', { apiKey: 'test-key', fetchImpl })
  assert(first.videos.length === 1 && first.videos[0].videoId === 'abc123', 'Successful search must return safe video metadata')
  assert(second.cached === true && calls === 1, 'Equivalent searches must use the bounded cache')
  assert(!JSON.stringify(first).includes('test-key'), 'API key must never appear in the public result')

  clearYouTubeCache()
  const failed = await searchYouTube('calculus', { apiKey: 'test-key', fetchImpl: async () => response({}, 500) })
  assert(failed.error === 'unavailable' && failed.videos.length === 0, 'API failures must return safe empty results')

  clearYouTubeCache()
  const timedOut = await searchYouTube('physics', { apiKey: 'test-key', timeoutMs: 1, fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
  }) })
  assert(timedOut.error === 'unavailable', 'Timeouts must return safe empty results')

  console.log('[PASS] YouTube service contracts')
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1 })