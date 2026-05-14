import aiService from './groq.service'
import routerService from './router.service'
import { formatResponse } from '../../../../core/cognita/responseFormatter'
import { Mode } from '../../../../core/cognita/systemPrompt'
import memoryService from '../../../../core/memory/memory.service'

class CognitaService {
  ai = aiService
  router = routerService
  memory = memoryService

  // AI logic centralized in groq.service (askGroq handles prompts & memory)

  async handleMessage(options: { userId: string; message: string; conversationId?: string; mode?: string }) {
    const { userId, message, conversationId, mode: providedMode } = options

    // Map frontend mode to internal Mode
    const mapMode = (m?: string): Mode => {
      if (!m) return 'standard'
      const s = String(m).toLowerCase()
      if (s === 'standard' || s === 'coding' || s === 'creative' || s === 'research') return s as Mode
      // Legacy mappings
      if (s === 'tutor') return 'standard'
      if (s === 'chat') return 'standard'
      if (s === 'coach') return 'standard'
      return 'standard'
    }

    const mode = mapMode(providedMode)

    // Delegate AI request and memory handling to groq.service
    const aiResult = await this.ai.askGroq({ userId, message, mode, conversationId })

    if (!aiResult.success) {
      // graceful degraded response with diagnostics (no secrets)
      const diag: any = aiResult.diagnostic || {}
      const msg = `I couldn't generate a response due to a ${diag.primary?.classification || diag.classification || 'model'} issue. Suggested steps: ${((diag.primary && diag.primary.suggestedSteps) || diag.suggestedSteps || []).slice(0,5).join(' | ')}`
      const formatted = formatResponse(msg, mode)
      return { mode, raw: aiResult.raw || null, text: '', formatted }
    }

    const formatted = formatResponse(aiResult.text || '', mode)
    return { mode, raw: aiResult.raw, text: aiResult.text, formatted }
  }
}

export default new CognitaService()
