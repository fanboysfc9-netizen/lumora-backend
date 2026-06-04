/** Expected structure of the AI response (to be returned by later layers). */
export interface LumoraCoreAIResponse {
  explanation: string
  intuition?: string
  steps?: string[]
  example?: string
  recap?: string
  raw?: string
}

export function isValidAIResponse(obj: any): obj is LumoraCoreAIResponse {
  if (!obj || typeof obj !== 'object') return false
  if (!obj.explanation || typeof obj.explanation !== 'string') return false
  if (obj.steps !== undefined) {
    if (!Array.isArray(obj.steps)) return false
    if (obj.steps.some((s: any) => typeof s !== 'string')) return false
  }
  if (obj.example !== undefined && typeof obj.example !== 'string') return false
  if (obj.recap !== undefined && typeof obj.recap !== 'string') return false
  if (obj.intuition !== undefined && typeof obj.intuition !== 'string') return false
  return true
}

export default { isValidAIResponse }
