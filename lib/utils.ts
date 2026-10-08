export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    paid: 'text-success bg-green-100',
    pending: 'text-warning bg-yellow-100',
    overdue: 'text-error bg-red-100',
    converted: 'text-success bg-green-100',
    new: 'text-primary bg-secondary',
    contacted: 'text-primary bg-blue-100',
    demo_booked: 'text-warning bg-yellow-100',
    demo_done: 'text-warning bg-yellow-100',
    lost: 'text-error bg-red-100',
  }
  return map[status] ?? 'text-textDark bg-gray-100'
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * "YYYY-MM" for a date. A paused student stores the month they're sitting out, so the pause
 * expires on its own when the calendar rolls over — no cron or cleanup pass has to end it.
 */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** True while the student is paused for the month that `date` falls in. */
export function isStudentPaused(
  student: { pausedMonth?: string },
  date: Date = new Date()
): boolean {
  return !!student.pausedMonth && student.pausedMonth === monthKey(date)
}
