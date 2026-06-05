export {};
import { performance } from 'perf_hooks'

const baseUrl = process.env.BASE_URL || 'http://localhost:4000'
const origins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'https://example.com'
]

async function tryFetch(method: string, path: string, origin: string, body?: any, extraHeaders: Record<string,string> = {}) {
  const url = `${baseUrl}${path}`
  const headers: Record<string,string> = {
    Origin: origin,
    'User-Agent': 'Lumora-E2E/1.0',
    ...extraHeaders
  }
  if (body) headers['Content-Type'] = 'application/json'
  const start = performance.now()
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const elapsed = performance.now() - start
    const text = await res.text()
    let json: any
    try { json = JSON.parse(text) } catch (e) { json = undefined }
    const aco = res.headers.get('access-control-allow-origin')
    return { ok: true, status: res.status, headers: res.headers, accessControlAllowOrigin: aco, bodyText: text, json, elapsed }
  } catch (err) {
    const elapsed = performance.now() - start
    return { ok: false, error: String(err), elapsed }
  }
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res && res.status === 200) return true
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function runCorsChecks() {
  console.log('\n[CORS CHECKS]')
  const results: any[] = []
  for (const origin of origins) {
    const r = await tryFetch('GET', '/', origin)
    results.push({ origin, ok: r.ok, status: r.status, accessControlAllowOrigin: r.accessControlAllowOrigin })
    console.log(`Origin=${origin} status=${r.status} ACAO=${r.accessControlAllowOrigin}`)
  }
  return results
}

async function runFunctionalRequests() {
  console.log('\n[FUNCTIONAL CHECKS]')
  const testUser = `e2e-${Date.now()}`
  const chatResp = await tryFetch('POST', '/api/chat', origins[0], { userId: testUser, message: 'Hello from E2E' })
  console.log('/api/chat ->', chatResp.ok ? `${chatResp.status} (${chatResp.elapsed.toFixed(1)}ms)` : `ERR ${chatResp.error}`)

  const coreResp = await tryFetch('POST', '/api/lumora-core', origins[0], { question: 'Explain photosynthesis' })
  console.log('/api/lumora-core ->', coreResp.ok ? `${coreResp.status} (${coreResp.elapsed.toFixed(1)}ms)` : `ERR ${coreResp.error}`)
  return { chatResp, coreResp }
}

async function runLatencyBench(iter = 20) {
  console.log('\n[LATENCY BENCHMARK]')
  const timings: number[] = []
  for (let i = 0; i < iter; i++) {
    const r = await tryFetch('GET', '/health', origins[1])
    if (r.ok) timings.push(r.elapsed)
    await new Promise(r => setTimeout(r, 50))
  }
  if (timings.length === 0) return null
  timings.sort((a,b)=>a-b)
  const sum = timings.reduce((s,x)=>s+x,0)
  const avg = sum / timings.length
  const p95 = timings[Math.floor(timings.length * 0.95) - 1] || timings[timings.length-1]
  console.log(`min=${timings[0].toFixed(1)}ms avg=${avg.toFixed(1)}ms p95=${(p95||timings[timings.length-1]).toFixed(1)}ms`)
  return { min: timings[0], avg, p95 }
}

async function simulateFailures() {
  console.log('\n[FAILURE SIMULATIONS]')
  // 1) Client-side timeout (abort)
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 50)
  const start = performance.now()
  try {
    await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origins[0] }, body: JSON.stringify({ userId: 'e2e', message: 'timeout' }), signal: controller.signal })
    console.log('Abort test: unexpected success')
  } catch (e: any) {
    console.log('Abort test: caught', e?.name || String(e))
  } finally { clearTimeout(id) }

  // 2) Bad request -> expect 400
  const bad = await tryFetch('POST', '/api/chat', origins[0], { message: 'missing userId' })
  console.log('/api/chat missing userId ->', bad.ok ? bad.status : bad.error)

  // 3) Non-existent endpoint -> expect 404
  const notFound = await tryFetch('GET', '/api/this-does-not-exist', origins[0])
  console.log('/api/this-does-not-exist ->', notFound.ok ? notFound.status : notFound.error)

  return { abortTest: true, bad, notFound }
}

async function main() {
  console.log('E2E runner baseUrl=', baseUrl)
  const ready = await waitForServer(15000)
  if (!ready) {
    console.error('Server not ready at', baseUrl)
    process.exit(2)
  }

  const cors = await runCorsChecks()
  const func = await runFunctionalRequests()
  const bench = await runLatencyBench(30)
  const failures = await simulateFailures()

  console.log('\nE2E SUMMARY')
  console.log({ cors, functional: { chat: func.chatResp?.status, core: func.coreResp?.status }, bench, failures })
  process.exit(0)
}

main().catch(e => { console.error('E2E runner error', e); process.exit(3) })
