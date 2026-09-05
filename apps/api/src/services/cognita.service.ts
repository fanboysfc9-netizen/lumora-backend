import registry from 'core/services/registry'
let aiService: any = null
try {
  aiService = registry.getGroqService() || require('./groq.service').default
} catch (e) {
  try { aiService = require('./groq.service').default } catch (err) { aiService = null }
}
import routerService from './router.service'
import { formatResponse } from 'core/cognita/responseFormatter'
import { Mode } from 'core/cognita/systemPrompt'
import memoryService from 'core/memory/memory.service'
import * as lumoraCore from '../models/lumora-core'
import { LumoraCoreInput } from '../models/lumora-core/types'
import { getOrCreateProfile } from 'core/cortex-adapt/learningProfile'
import { estimateCognitiveState } from 'core/cortex-adapt/cognitiveEngine'
import { decideAdaptation } from 'core/cortex-adapt/adaptationEngine'
import { toSystemInstruction } from 'core/cortex-adapt/promptAdapter'
import { processInteractionOutcome } from 'core/cortex-adapt/feedbackLoop'
import { analyzeConversation } from 'core/cortex-adapt/behaviorAnalyzer'
import { predictBeforeResponse, adjustDecisionWithPrediction, simulateUserReaction, decideMidResponseAction } from 'core/cortex-adapt/predictiveEngine'
import globalEngine from 'core/cortex-adapt/globalEngine'
import { adjustDecisionWithGlobalTrends } from 'core/cortex-adapt/ruleEvolution'
import knowledgeRouter from 'core/cortex-adapt/knowledgeRouter'
import { isLowIntentConversational } from 'core/cortex-adapt/conversationalGuard'
import { LUMORA_SYSTEM_PROMPT } from '../prompts/lumora.system.prompt'

class CognitaService {
  ai = aiService
  router = routerService
  memory = memoryService

  // AI logic centralized in groq.service (askGroq handles prompts & memory)

  async handleMessage(options: { userId?: string; message: string; conversationId?: string; mode?: string }) {
    const { userId, message, conversationId, mode: providedMode } = options

    // Map frontend mode to internal Mode
    const mapMode = (m?: string): Mode => {
      if (!m) return 'standard'
      const s = String(m).toLowerCase()
      if (s === 'standard' || s === 'coding' || s === 'creative' || s === 'research') return s as Mode
      if (s === 'nira') return 'standard'
      if (s === 'elara') return 'research'
      if (s === 'solara') return 'creative'
      // Legacy mappings
      if (s === 'tutor') return 'standard'
      if (s === 'chat') return 'standard'
      if (s === 'coach') return 'standard'
      return 'standard'
    }

    const mode = mapMode(providedMode)
    const lowIntentConversational = isLowIntentConversational(message)

    // Delegate AI request and memory handling to groq.service
    // --- Lumora Core pre-processing ---
    const coreInput: LumoraCoreInput = { question: message, userLevel: 'average', maxLines: undefined, strictness: 'moderate' }
    const corePrompt = lumoraCore.buildPrompt(coreInput)
    if (lowIntentConversational) {
      corePrompt.prompt = `${LUMORA_SYSTEM_PROMPT}\n\nFor this conversational message, respond naturally and concisely. Do not use numbered steps, formal sections, or teaching scaffolding unless the user asks for it.`
    }

    console.log('USER INPUT:', message)
    console.log('CORE PROMPT (base):', corePrompt.prompt)

    // Attempt to fetch the user's learning profile quickly (non-blocking with timeout)
    let profile: any = null
    let approxState: any = null
    let approxDecision: any = null
    let approxPrediction: any = null
      let gstats: any = null
    try {
      const PROFILE_READ_TIMEOUT_MS = 60
      const pPromise = getOrCreateProfile(userId!)
      // race profile read against timeout to avoid slowing responses
      profile = (await Promise.race([pPromise, new Promise(res => setTimeout(() => res(null), PROFILE_READ_TIMEOUT_MS))])) as any
      if (profile && !lowIntentConversational) {
        // build a lightweight approximate cognitive state from profile + current message length
        approxState = estimateCognitiveState(profile, { repeatedConfusionCount: 0, recentFollowUps: 0, recentQuestionRatio: 0, avgMessageLength: (message || '').length, confusionDelta: 0, engagementDelta: 0, boredomSignal: 0, quickUnderstandingSignal: 0 })
        approxDecision = decideAdaptation(profile, approxState, { requestMode: 'default' })

        // Attempt to analyze recent conversation for a more informed decision (non-blocking)
        try {
          const CONV_READ_TIMEOUT_MS = 120
          const convPromise = analyzeConversation(userId!, conversationId, 8)
          const convBehavior: any = await Promise.race([convPromise, new Promise(res => setTimeout(() => res(null), CONV_READ_TIMEOUT_MS))])
          if (convBehavior) {
            const convState = estimateCognitiveState(profile, convBehavior)
            const convDecision = decideAdaptation(profile, convState, { requestMode: 'default' })
            approxState = convState
            approxDecision = convDecision
          }
          // Run predictive pre-response heuristics to bias adaptation decisions
          try {
            approxPrediction = await predictBeforeResponse(message, profile, convBehavior || undefined)
            if (approxPrediction) {
              approxDecision = adjustDecisionWithPrediction(approxDecision, approxPrediction)
              console.log('[CognitaService] predictive pre-response:', approxPrediction)
            }
          } catch (pe) {
            console.warn('[CognitaService] predictiveEngine failed (non-fatal):', (pe as any)?.message || pe)
          }
          // Consult global intelligence trends and nudge decision if needed
          try {
              gstats = await globalEngine.getGlobalLearningStats()
            approxDecision = adjustDecisionWithGlobalTrends(approxDecision, gstats)
            console.log('[CognitaService] global trends applied')
          } catch (ge) {
            console.warn('[CognitaService] globalEngine failed (non-fatal):', (ge as any)?.message || ge)
          }
        } catch (e) {
          // if conversation analysis fails, continue with approxDecision
          console.warn('[CognitaService] conversation analysis failed (non-fatal):', (e as any)?.message || e)
        }

          // Decide whether to fetch external knowledge via SerpAPI
          let serpSummaryObj: any = null
          try {
            const kdec = await knowledgeRouter.routeQuery(message)
            let serpUsed = false
            if (kdec) {
              // Attempt when decision is MUST-use, or optionally attempt when in optional range
              const score = (kdec.webConfidenceScore ?? kdec.webScore ?? 0)
              const inOptionalRange = score >= 0.4 && score <= 0.75
              const shouldTry = kdec.useSerpAPI || inOptionalRange

              if (shouldTry) {
                try {
                  const SERP_TIMEOUT_MS = 3500
                  // race against timeout so SerpAPI won't delay Groq beyond threshold
                  const s: any = await Promise.race([
                    knowledgeRouter.fetchAndSummarize(message),
                    new Promise(res => setTimeout(() => res(null), SERP_TIMEOUT_MS))
                  ])
                  if (s && s.summaryText) {
                    serpSummaryObj = s
                    serpUsed = true
                  } else {
                    serpSummaryObj = null
                    serpUsed = false
                  }
                } catch (se) {
                  console.warn('[CognitaService] SerpAPI fetch failed (non-fatal):', (se as any)?.message || se)
                  serpSummaryObj = null
                }
              }
            }
            try { console.debug('SERPAPI_USED:', !!serpSummaryObj) } catch (e) {}
          } catch (ke) {
            console.warn('[CognitaService] knowledgeRouter failed (non-fatal):', (ke as any)?.message || ke)
          }

          const adaptationInstruction = toSystemInstruction(approxDecision, profile, approxPrediction, gstats)
        // Prepend subtle adaptation instruction and optional external knowledge to the system prompt (keeps it silent and compact)
        const externalBlock = knowledgeRouter.buildExternalKnowledgeSection(serpSummaryObj)
        corePrompt.prompt = `${adaptationInstruction}\n\n${externalBlock}${corePrompt.prompt}`
        console.log('CORTEX ADAPT INSTRUCTION PREPENDED')
      }
    } catch (e) {
      console.warn('[CognitaService] Cortex profile read/adapt failed (non-fatal):', (e as any)?.message || e)
    }

    // Build messages for Groq: system gets the processed core prompt, user gets the user's message
    const messages = [
      { role: 'system', content: corePrompt.prompt },
      { role: 'user', content: message }
    ]

    // Decide whether to use iterative (stepwise) generation to enable mid-response adaptation
    const needIterative = !!approxDecision && (
      approxDecision.teachingMode === 'guided_breakdown' ||
      approxDecision.simplificationIntensity > 0.5 ||
      approxDecision.exampleDensity > 0.6 ||
      (approxPrediction && (approxPrediction.confusionRisk > 0.45 || approxPrediction.overloadRisk > 0.45))
    )

    let aiResult: any = null

    if (needIterative) {
      // Iterative generation: request step 1, simulate reaction, optionally revise, then continue to next steps
      const maxSteps = 4
      const partials: string[] = []

      const generateStep = async (stepNum: number, lastAssistant?: string) => {
        const systemMsg = corePrompt.prompt
        const userMsg = message
        const instruction = stepNum === 1
          ? `Please answer the user's question in up to ${maxSteps} numbered steps. Provide only Step 1 now, labeled 'Step 1:'. Keep it concise (1-3 short paragraphs). Do not include meta commentary or diagnostics.`
          : `Continue with Step ${stepNum} only. Keep it concise and directly related to the question. If the user seems likely to be confused based on previous steps, keep this step simpler and include a short example.`

        const callMessages: any[] = [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ]
        if (lastAssistant) callMessages.push({ role: 'assistant', content: lastAssistant })
        callMessages.push({ role: 'user', content: instruction })

        const res = await this.ai.createChatCompletion(callMessages as any, { mode })
        return res
      }

      try {
        let lastAssistant: string | null = null
        for (let step = 1; step <= maxSteps; step++) {
          const res = await generateStep(step, lastAssistant || undefined)
          if (!res || !res.success) {
            // fallback to single-shot if iterative step fails
            console.warn('[CognitaService] iterative step failed, falling back to single-shot')
            aiResult = await this.ai.createChatCompletion(messages as any, { mode })
            break
          }

          // Extract step text (attempt to parse 'Step <n>:' markers)
          let text = (res.text || '').trim()
          const stepRegex = new RegExp(`(?:Step\\s*${step}[:\\.-]\\s*)([\\s\\S]*?)(?=(?:Step\\s*${step+1}[:\\.-]|$))`, 'i')
          const match = text.match(stepRegex)
          let stepText = match ? match[1].trim() : (text.split(/\n\n+/).filter(Boolean)[0] || text)

          // Simulate user reaction to this step and decide mid-response action
          try {
            const sim = await simulateUserReaction(stepText, profile)
            const mid = decideMidResponseAction(stepText, sim, profile)
            if (mid && mid.action) {
              const reviseInstruction = mid.action === 'simplify'
                ? 'Please simplify the previous step: shorten sentences and break into smaller sub-steps if helpful. Keep it concise.'
                : 'Please insert a concise, concrete example illustrating the previous step.'

              const reviseMessages: any[] = [
                { role: 'system', content: corePrompt.prompt },
                { role: 'user', content: message },
                { role: 'assistant', content: stepText },
                { role: 'user', content: reviseInstruction }
              ]

              const rev = await this.ai.createChatCompletion(reviseMessages as any, { mode })
              if (rev && rev.success) {
                stepText = (rev.text || '').trim()
              }
            }
          } catch (simErr) {
            console.warn('[CognitaService] simulateUserReaction failed (non-fatal):', (simErr as any)?.message || simErr)
          }

          partials.push(stepText)
          lastAssistant = stepText

          // Heuristic: break early if step indicates finality
          if (/conclude|in summary|final step|that's all/i.test(stepText)) {
            break
          }

          // small delay not required; continue to next step
        }

        if (!aiResult) {
          const finalText = partials.map((s, i) => `Step ${i + 1}: ${s}`).join('\n\n')
          aiResult = { success: true, text: finalText, raw: null, partials }
        }
      } catch (iterErr) {
        console.error('[CognitaService] iterative generation error (non-fatal):', (iterErr as any)?.message || iterErr)
        // fallback to single-shot
        aiResult = await this.ai.createChatCompletion(messages as any, { mode })
      }
    } else {
      // Single-shot generation when iterative not required
      aiResult = await this.ai.createChatCompletion(messages as any, { mode })
    }

    console.log('GROQ RESPONSE:', aiResult?.raw || aiResult?.text || aiResult)

    if (!aiResult.success) {
      const diag: any = aiResult.diagnostic || {}
      const primaryDiag = diag.primary || diag
      const classification = primaryDiag?.classification || 'unknown'
      const suggestedSteps = (primaryDiag?.suggestedSteps || diag.suggestedSteps || []).slice(0, 5)
      const debugSummary = {
        provider: primaryDiag?.provider || 'groq',
        classification,
        modelTried: primaryDiag?.modelTried || primaryDiag?.context?.resolvedModel || null,
        requestedModel: primaryDiag?.context?.requestedModel || null,
        availableModels: primaryDiag?.context?.availableModels || [],
        envHasGroqKey: Boolean(primaryDiag?.context?.env?.hasGroqKey),
        message: primaryDiag?.message || 'No provider response returned.'
      }
      console.error('[CognitaService] provider failure', JSON.stringify(debugSummary))

      const msg = `Lumora could not generate a response because the AI provider failed. ${classification ? `Classification: ${classification}. ` : ''}${suggestedSteps.length ? `Next step: ${suggestedSteps[0]}` : 'Please try again in a moment.'}`
      const formatted = formatResponse(msg, mode)
      return { mode, raw: aiResult.raw || null, text: '', formatted, diagnostic: debugSummary }
    }

    // --- Lumora Core post-processing (light review) ---
    let post = lumoraCore.postProcess(aiResult.text || '')
    let finalText = lumoraCore.formatResponseAsText(post)

    console.log('FINAL OUTPUT:', finalText)

    // If language mismatch detected by Core, attempt one regeneration with explicit English enforcement
    try {
      const meta = (post as any)?._meta
      if (meta && meta.languageMismatch) {
        console.warn('[CognitaService] language mismatch detected, attempting one regeneration in English')
        const regenMessages = [
          { role: 'system', content: corePrompt.prompt },
          { role: 'user', content: message },
          { role: 'user', content: 'Please respond in English only and maintain the same calm, tutor tone. Do not include other languages.' }
        ]

        const regenResult = await this.ai.createChatCompletion(regenMessages as any, { mode })
        if (regenResult.success) {
          post = lumoraCore.postProcess(regenResult.text || '')
          finalText = lumoraCore.formatResponseAsText(post)
          // replace aiResult raw/text for downstream logging and persistence
          aiResult.raw = regenResult.raw
          aiResult.text = regenResult.text
          console.log('[CognitaService] regeneration successful — using English response')
        } else {
          console.warn('[CognitaService] regeneration failed; keeping original response')
        }
      }
    } catch (e) {
      console.error('[CognitaService] error during regeneration attempt', (e as any)?.message || String(e))
    }

    // Persist authenticated conversation messages only.
    if (userId) {
      try {
        await memoryService.addUserMessage(userId, conversationId, message, String(mode))
        await memoryService.addAIResponse(userId, conversationId, finalText, String(mode))
      } catch (e) {
        console.error('[CognitaService] failed to persist conversation (non-fatal):', (e as any)?.message || String(e))
      }
    }

    const formatted = formatResponse(finalText || '', mode)

    // Fire-and-forget: run the Cortex feedback loop asynchronously so it never blocks the response
    if (userId) {
      ;(async () => {
        try {
          await processInteractionOutcome(userId, conversationId, {
            userMessage: message,
            aiResponse: finalText,
            prevState: approxState,
            prevDecision: approxDecision,
            modeUsed: mode,
            timestamp: Date.now()
          })
          console.log('[Cortex] feedback loop processed (async)')
        } catch (e) {
          console.error('[Cortex] feedback loop error (non-fatal):', (e as any)?.message || String(e))
        }
      })()
    }

    return { mode, raw: aiResult.raw, text: finalText, formatted }
  }
}

export default new CognitaService()
