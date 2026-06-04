import memoryService from '../memory/memory.service'
import { AdaptationEvent } from './types'

export async function recordAdaptationEvent(userId: string, event: AdaptationEvent) {
  const existing = (await memoryService.getUserProfile(userId)) || {}
  const history: AdaptationEvent[] = (existing.adaptationHistory as AdaptationEvent[]) || []
  history.push(event)
  await memoryService.updateUserProfile(userId, { adaptationHistory: history })
}

export async function getAdaptationHistory(userId: string) {
  const p: any = await memoryService.getUserProfile(userId)
  return (p && p.adaptationHistory) || []
}
