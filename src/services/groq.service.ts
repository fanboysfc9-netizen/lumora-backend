/*
  Groq service — centralized AI layer for Lumora Cognita.
  Responsibilities:
  - Cache available models at startup
  - Resolve preferred models per mode and fall back safely
  - Provide `askGroq` (central entrypoint) which builds prompts, injects memory,
    and updates memory after responses
  - Implement safe retry/fallback behaviour so the API never crashes on model issues
*/

import getSystemPrompt, { Mode } from '../../../../core/cognita/systemPrompt'
import memoryService from '../../../../core/memory/memory.service'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

// Load SDK (CommonJS require; SDK may be absent in dev env)
let Groq: any
try {
  Groq = require('groq-sdk').Groq
} catch (e) {
  Groq = null
}

// Preferred model mapping (logical names -> preferred model id)
export function getModel(mode: string): string {
  switch (mode) {
    case 'standard':
      return 'llama-3.1-70b-versatile'
    case 'coding':
      return 'llama-3.1-70b-versatile'
    case 'creative':
      return 'mixtral-8x7b-32768'
    case 'fast':
      return 'llama-3.1-8b-instant'
    case 'research':
      return 'llama-3.1-70b-versatile'
    default:
      return 'llama-3.1-70b-versatile'
  }
}

type ErrorClassification = 'auth' | 'model' | 'quota' | 'network' | 'unknown'

class GroqService {
  apiKey: string
  client: any
  // cached model list
  availableModels: string[] = []
  private modelFetchPromise?: Promise<void>

  // lightweight in-memory per-user memory (last 20 messages)
  private userMemories: Map<string, { role: 'user' | 'assistant'; content: string; timestamp: number }[]> = new Map()

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || ''

    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not set. Set GROQ_API_KEY in the environment.')
    }

    if (!Groq) {
      throw new Error('groq-sdk is not installed. Run `npm install groq-sdk` in apps/api')
    }

    try {
      this.client = new Groq({ apiKey: this.apiKey })
    } catch (err: any) {
      throw new Error(`Failed to construct Groq client: ${err?.message || String(err)}`)
    }

    // Start model list fetch in background and cache it
    this.modelFetchPromise = this.client.models
      .list()
      .then((res: any) => {
        this.availableModels = (res?.data || []).map((m: any) => m.id)
      })
      .catch((e: any) => {
        console.error('[GroqService] model list fetch failed (non-fatal):', e?.message || String(e))
        this.availableModels = []
      })
  }

  private async ensureModelsLoaded() {
    if (this.modelFetchPromise) {
      try {
        await this.modelFetchPromise
      } catch (e) {
        // ignore - will handle gracefully later
      }
    }

    // if still empty, try once more
    if (!this.availableModels || this.availableModels.length === 0) {
      try {
        const res = await this.client.models.list()
        this.availableModels = (res?.data || []).map((m: any) => m.id)
      } catch (e) {
        // swallow - we will fallback at runtime
      }
    }
  }

  private resolveModel(preferred: string) {
    if (!this.availableModels || this.availableModels.length === 0) return preferred
    if (this.availableModels.includes(preferred)) return preferred

    // safe fallback preference
    const fallbackPreferred = 'llama-3.1-8b-instant'
    if (this.availableModels.includes(fallbackPreferred)) return fallbackPreferred

    // finally, use whatever is available
    return this.availableModels[0] || preferred
  }

  private classifyError(errMsg: string): ErrorClassification {
    const m = (errMsg || '').toLowerCase()
    if (/401|unauthorized|invalid api key|missing api key|api key/i.test(m)) return 'auth'
    if (/404|not found|model.*not.*found|decommissioned|deprecated/i.test(m)) return 'model'
    if (/quota|limit|rate limit|billing/i.test(m)) return 'quota'
    if (/network|timeout|connection|enotfound|econnrefused/i.test(m)) return 'network'
    return 'unknown'
  }

  private debugStepsForClassification(cls: ErrorClassification, modelName?: string) {
    const base = [
      'Verify environment variables: ensure GROQ_API_KEY is set and valid.',
      'Confirm the application is using the intended API key (do not log the key).',
      `Verify the model name${modelName ? ` '${modelName}'` : ''} is correct and available to your account.`,
      'Run a minimal request (list models or a tiny completion) to reproduce the error.',
      'Inspect account quota, billing, and access permissions.'
    ]
    if (cls === 'auth') base.unshift('AUTH ISSUE: API key may be invalid or revoked.')
    if (cls === 'model') base.unshift('MODEL ISSUE: Requested model may be unavailable or decommissioned.')
    return base
  }

  private addToUserMemory(userId: string, role: 'user' | 'assistant', content: string) {
    try {
      const mem = this.userMemories.get(userId) || []
      mem.push({ role, content, timestamp: Date.now() })
      this.userMemories.set(userId, mem.slice(-20))
    } catch (e) {
      // swallow memory errors
    }
  }

  private getUserMemory(userId: string) {
    const mem = this.userMemories.get(userId) || []
    return mem.slice(-20).map((m) => ({ role: m.role, content: m.content }))
  }

  // Low-level chat call with safe fallback (does not update conversational memory)
  async createChatCompletion(messages: ChatMessage[], options?: { model?: string; mode?: string }) {
    await this.ensureModelsLoaded()

    const mode = (options?.mode || 'standard') as string
    const preferred = options?.model || getModel(mode)
    const primary = this.resolveModel(preferred)

    const groqMessages = messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user', content: m.content }))

    const isResearch = mode === 'research'
    const generationConfig: any = {
      model: primary,
      messages: groqMessages,
      temperature: isResearch ? 0.2 : 0.7,
      max_tokens: isResearch ? 2000 : 1200
    }

    // Attempt primary model
    try {
      const chatCompletion = await this.client.chat.completions.create(generationConfig)
      const text = chatCompletion.choices?.[0]?.message?.content || chatCompletion.choices?.[0]?.text || ''
      return { success: true, raw: chatCompletion, text, modelUsed: primary }
    } catch (err: any) {
      const message = err?.message || String(err)
      console.error('[GroqService] primary model call failed (non-fatal):', message)

      const cls = this.classifyError(message)
      const steps = this.debugStepsForClassification(cls, primary)
      const diagnostic = { classification: cls, message, modelTried: primary, suggestedSteps: steps }

      // Build ordered fallback candidate list (preferred fallback first, then other available models)
      const tried: any[] = []
      const fallbacksTried: any[] = []

      const orderedCandidates: string[] = []
      const fallbackPreferred = 'llama-3.1-8b-instant'
      if (this.availableModels && this.availableModels.length > 0) {
        if (this.availableModels.includes(fallbackPreferred) && fallbackPreferred !== primary) orderedCandidates.push(fallbackPreferred)
        for (const m of this.availableModels) {
          if (m !== primary && !orderedCandidates.includes(m)) orderedCandidates.push(m)
        }
      } else {
        // If we have no model list, still try the standard fallback
        if (fallbackPreferred !== primary) orderedCandidates.push(fallbackPreferred)
      }

      for (const cand of orderedCandidates) {
        try {
          const fallbackConfig: any = { ...generationConfig, model: cand }
          const chatCompletion = await this.client.chat.completions.create(fallbackConfig)
          const text = chatCompletion.choices?.[0]?.message?.content || chatCompletion.choices?.[0]?.text || ''
          return { success: true, raw: chatCompletion, text, modelUsed: cand, fallbackUsed: true, diagnostic }
        } catch (err2: any) {
          const message2 = err2?.message || String(err2)
          console.error('[GroqService] fallback model call failed for', cand, message2)
          const cls2 = this.classifyError(message2)
          const steps2 = this.debugStepsForClassification(cls2, cand)
          const diagnostic2 = { classification: cls2, message: message2, modelTried: cand, suggestedSteps: steps2 }
          fallbacksTried.push(diagnostic2)
        }
      }

      // All fallbacks exhausted
      return { success: false, diagnostic: { primary: diagnostic, fallbacks: fallbacksTried }, availableModels: this.availableModels }
    }
  }

  // Central entrypoint: builds system prompt, injects memory, calls the model,
  // updates in-memory + persisted memory, and returns a stable structured result.
  async askGroq(opts: { userId: string; message: string; mode?: Mode; conversationId?: string }) {
    const { userId, message, mode = 'standard', conversationId } = opts

    // Build system prompt
    const systemPrompt = getSystemPrompt(mode)

    // Load recent memory (prefer persisted conversation if conversationId provided)
    let previous: { role: 'user' | 'assistant'; content: string }[] = []
    try {
      if (conversationId) {
        const dbHistory = await memoryService.getConversationHistory(userId, conversationId, 20)
        if (Array.isArray(dbHistory) && dbHistory.length > 0) {
          previous = dbHistory.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
        } else {
          previous = this.getUserMemory(userId)
        }
      } else {
        previous = this.getUserMemory(userId)
      }
    } catch (e: any) {
      previous = this.getUserMemory(userId)
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previous,
      { role: 'user', content: message }
    ]

    // Call low-level generator with safe retries
    const result = await this.createChatCompletion(messages, { mode })

    // If success, update memory (in-memory + persisted when conversationId present)
    if (result.success) {
      try {
        // store raw texts in memory; do not store secrets
        this.addToUserMemory(userId, 'user', message)
        this.addToUserMemory(userId, 'assistant', result.text || '')

        if (conversationId) {
          // best-effort persistence (non-blocking)
          try {
            await memoryService.addUserMessage(userId, conversationId, message, String(mode))
            await memoryService.addAIResponse(userId, conversationId, result.text || '', String(mode))
          } catch (e) {
            console.error('[GroqService] failed to persist conversation (non-fatal):', (e as any)?.message || String(e))
          }
        }
      } catch (e) {
        // swallow memory errors
      }
    }

    return result
  }
}

export default new GroqService()