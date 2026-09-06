export function getTimeGreeting(date: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hours = date.getHours()

  if (hours >= 0 && hours < 12) return 'Good morning'
  if (hours >= 12 && hours < 18) return 'Good afternoon'
  return 'Good evening'
}
