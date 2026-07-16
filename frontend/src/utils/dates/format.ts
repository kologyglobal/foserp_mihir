const DATE_UNAVAILABLE = 'Date not available'

/** True for real calendar timestamps — rejects empty, invalid, and Unix-epoch sentinels. */
export function isValidTimestamp(value: string | number | Date | null | undefined): boolean {
  if (value == null || value === '') return false
  if (typeof value === 'string' && !value.trim()) return false
  const parsed = value instanceof Date ? value : new Date(value)
  const time = parsed.getTime()
  if (Number.isNaN(time)) return false
  // 1970-01-01 (and negative) are technical fallbacks, never show as business dates
  if (time < 24 * 60 * 60 * 1000) return false
  if (typeof value === 'string' && /^1970-01-01\b/.test(value.trim())) return false
  return true
}

export function formatDate(date: string | null | undefined): string {
  if (!isValidTimestamp(date)) return DATE_UNAVAILABLE
  const parsed = new Date(date!)
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!isValidTimestamp(iso)) return DATE_UNAVAILABLE
  const date = new Date(iso!)
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/** Compact timestamp for sidebar recent pages — time only today, date + time otherwise. */
export function formatRecentTime(iso: string | null | undefined): string {
  if (!isValidTimestamp(iso)) return DATE_UNAVAILABLE
  const date = new Date(iso!)
  const now = new Date()
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  if (date.toDateString() === now.toDateString()) return time
  const day = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date)
  return `${day}, ${time}`
}

/** Relative time for live grid footers — e.g. "2 minutes ago" */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!isValidTimestamp(iso)) return DATE_UNAVAILABLE
  const date = new Date(iso!)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
