export type Mode = 'standard' | 'coding' | 'creative' | 'research'

export function classifyMode(text: string): Mode {
  // Placeholder: classify text to determine mode
  // This should be replaced with actual implementation from the original monorepo
  const lower = text.toLowerCase()
  
  if (lower.includes('code') || lower.includes('program') || lower.includes('debug')) {
    return 'coding'
  }
  if (lower.includes('story') || lower.includes('write') || lower.includes('create')) {
    return 'creative'
  }
  if (lower.includes('research') || lower.includes('study') || lower.includes('analyze')) {
    return 'research'
  }
  
  return 'standard'
}

