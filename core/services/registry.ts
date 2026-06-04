// Central service registry: expose singletons and lazy getters for shared services.
// Keep this file minimal and free of heavy side-effects. Callers should use the
// getters to obtain instances.

function errorToString(e: unknown) {
  if (e instanceof Error) return e.message
  try {
    return JSON.stringify(e)
  } catch (_err) {
    return String(e)
  }
}

export function getFirebaseDb(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const initFirebase: any = require('../memory/firebase.service').default
    return initFirebase()
  } catch (err: unknown) {
    console.warn('[registry] getFirebaseDb: failed to load firebase service:', errorToString(err))
    return null
  }
}

export function getMemoryService(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const memoryService: any = require('../memory/memory.service').default
    return memoryService
  } catch (err: unknown) {
    console.warn('[registry] getMemoryService: failed to load memory service:', errorToString(err))
    return null
  }
}

export function getKnowledgeRouter(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kr: any = require('../cortex-adapt/knowledgeRouter').default
    return kr
  } catch (err: unknown) {
    console.warn('[registry] getKnowledgeRouter: failed to load knowledgeRouter:', errorToString(err))
    return null
  }
}

// Groq / AI service is app-specific; provide a protected, lazy loader that tries
// common app paths. Return null if not available (e.g., when running in non-API contexts).
export function getGroqService(): any | null {
  try {
    // Try the app-local service (source path)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const groq: any = require('../../apps/api/src/services/groq.service').default
    return groq
  } catch (err: unknown) {
    try {
      // Fallback: compiled dist path (when running from built output)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const groq: any = require('../../apps/api/dist/apps/api/src/services/groq.service').default
      return groq
    } catch (err2: unknown) {
      console.warn('[registry] getGroqService: groq service not available in this context:', errorToString(err2))
      return null
    }
  }
}

export default { getFirebaseDb, getMemoryService, getKnowledgeRouter, getGroqService }
