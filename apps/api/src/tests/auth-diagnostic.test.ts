import { sanitizeAuthDiagnosticMessage } from '../middleware/supabase-auth.middleware'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function run() {
  console.log('[TEST] auth diagnostic redaction')
  const sanitized = sanitizeAuthDiagnosticMessage('Bearer secret-token eyJheader.payload.signature')
  assert(!sanitized.includes('secret-token'), 'Bearer token must be redacted')
  assert(!sanitized.includes('eyJheader.payload.signature'), 'JWT must be redacted')
  assert(sanitized.includes('[REDACTED]'), 'Bearer redaction marker must be present')
  assert(sanitized.includes('[REDACTED_JWT]'), 'JWT redaction marker must be present')
  console.log('[PASS] auth diagnostic redaction')
}

if (require.main === module) {
  try { run() } catch (error) { console.error('[FAIL] auth diagnostic redaction', error); process.exit(1) }
}