const DAY = 24 * 60 * 60 * 1000

/** "due today", "due in 5 days", "2 days overdue" — relative to now, so a reminder reads at a glance. */
export function dueLabel(dueAt: string | Date, now: Date = new Date()): string {
  const diff = new Date(dueAt).getTime() - now.getTime()
  if (diff < 0) {
    const days = Math.max(1, Math.floor(-diff / DAY))
    return `${days} ${days === 1 ? 'day' : 'days'} overdue`
  }
  const days = Math.ceil(diff / DAY)
  if (days <= 1) return 'due today'
  return `due in ${days} days`
}
