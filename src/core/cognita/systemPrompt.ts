export type Mode = 'standard' | 'coding' | 'creative' | 'research'

export default function getSystemPrompt(mode: Mode): string {
  // Placeholder: return system prompt based on mode
  // This should be replaced with actual implementation from the original monorepo
  switch (mode) {
    case 'coding':
      return 'You are a helpful coding assistant.'
    case 'creative':
      return 'You are a creative writing assistant.'
    case 'research':
      return 'You are a research assistant.'
    case 'standard':
    default:
      return 'You are a helpful assistant.'
  }
}

