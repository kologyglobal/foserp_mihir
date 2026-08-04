import { Linking, Platform } from 'react-native'

export function displayName(first?: string | null, last?: string | null, fallback = '—'): string {
  const n = [first, last].filter(Boolean).join(' ').trim()
  return n || fallback
}

export function companyLabel(c: { customerName?: string | null; name?: string | null } | null | undefined): string {
  return c?.customerName || c?.name || '—'
}

export function formatMoney(value: number | null | undefined, currency = '₹'): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  try {
    return `${currency}${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  } catch {
    return `${currency}${Math.round(Number(value))}`
  }
}

function parseDatePart(value: string): Date | null {
  const raw = value.trim()
  if (!raw) return null
  // Prefer date-only YYYY-MM-DD to avoid timezone shifting the calendar day.
  const ymd = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Human calendar label — never raw ISO. */
export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = parseDatePart(String(value))
  if (!d) return String(value).slice(0, 10)

  const today = startOfDay(new Date())
  const target = startOfDay(d)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' as const }),
  })
}

/** 09:30 / 14:05:00 → 9:30 AM */
export function formatTime(value?: string | null): string {
  if (!value) return ''
  const raw = String(value).trim()
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (!match) {
    // ISO datetime tail
    const iso = raw.match(/T(\d{2}):(\d{2})/)
    if (!iso) return raw
    return formatClock(Number(iso[1]), Number(iso[2]))
  }
  return formatClock(Number(match[1]), Number(match[2]))
}

function formatClock(h: number, m: number): string {
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

/** "Today · 3:00 PM" or "Tomorrow" — for list/meta rows. */
export function formatWhen(date?: string | null, time?: string | null): string {
  const day = formatDate(date)
  const t = formatTime(time)
  if (day === '—' && !t) return 'Scheduled'
  if (day === '—' && t) return t
  if (t) return `${day} · ${t}`
  return day
}

/** User-friendly title case for stages/status (e.g. qualified → Qualified). */
export function titleCaseLabel(value?: string | null, fallback = '—'): string {
  if (value == null || !String(value).trim()) return fallback
  return String(value)
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function todayYmd(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function greetingForNow(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export type FollowUpIcon =
  | 'call-outline'
  | 'mail-outline'
  | 'people-outline'
  | 'chatbubble-ellipses-outline'
  | 'videocam-outline'
  | 'alarm-outline'

export function followUpTypeIcon(type?: string | null): FollowUpIcon {
  const t = (type ?? '').toLowerCase()
  if (t.includes('call') || t.includes('phone')) return 'call-outline'
  if (t.includes('email') || t.includes('mail')) return 'mail-outline'
  if (t.includes('video') || t.includes('zoom') || t.includes('teams')) return 'videocam-outline'
  if (t.includes('meet') || t.includes('visit') || t.includes('site')) return 'people-outline'
  if (t.includes('whatsapp') || t.includes('chat') || t.includes('sms') || t.includes('message')) {
    return 'chatbubble-ellipses-outline'
  }
  return 'alarm-outline'
}

export type FollowUpStoryInput = {
  followUpType?: string | null
  customerName?: string | null
  leadName?: string | null
  dueDate?: string | null
  dueTime?: string | null
}

/**
 * Story-style recommendation copy for dashboard / task rows.
 * Prefers customer/lead name; uses follow-up type as the action verb.
 */
export function followUpStory(f: FollowUpStoryInput): {
  title: string
  subtitle: string
  icon: FollowUpIcon
} {
  const party = String(f.customerName || f.leadName || '').trim()
  const typeRaw = String(f.followUpType || '').trim()
  const typeKey = typeRaw.toLowerCase().replace(/[_-]+/g, ' ')
  const when = formatWhen(f.dueDate, f.dueTime)
  const icon = followUpTypeIcon(typeRaw)

  let action: string
  let reason: string

  if (typeKey.includes('call') || typeKey.includes('phone')) {
    action = party ? `Call ${party}` : 'Make a call'
    reason = 'to keep the conversation going'
  } else if (typeKey.includes('email') || typeKey.includes('mail')) {
    action = party ? `Send email to ${party}` : 'Send an email'
    reason = 'to keep the deal moving'
  } else if (typeKey.includes('visit') || typeKey.includes('site')) {
    action = party ? `Visit ${party}` : 'Plan a site visit'
    reason = 'to strengthen the relationship'
  } else if (typeKey.includes('meet')) {
    action = party ? `Meet with ${party}` : 'Hold a meeting'
    reason = 'to move things forward'
  } else if (
    typeKey.includes('whatsapp') ||
    typeKey.includes('message') ||
    typeKey.includes('sms') ||
    typeKey.includes('chat')
  ) {
    action = party ? `Message ${party}` : 'Send a message'
    reason = 'to stay top of mind'
  } else if (typeKey.includes('video') || typeKey.includes('zoom') || typeKey.includes('teams')) {
    action = party ? `Video call with ${party}` : 'Join a video call'
    reason = 'to keep the deal moving'
  } else if (typeRaw) {
    const verb = titleCaseLabel(typeRaw)
    action = party ? `${verb} with ${party}` : verb
    reason = 'as recommended for today'
  } else {
    action = party ? `Follow up with ${party}` : 'Complete a follow-up'
    reason = 'as recommended for today'
  }

  const duePhrase = (() => {
    if (when === 'Scheduled') return 'due soon'
    // "due today · 10:00 AM" reads better than "due Today · 10:00 AM"
    const lower = when
      .replace(/^Today/, 'today')
      .replace(/^Tomorrow/, 'tomorrow')
      .replace(/^Yesterday/, 'yesterday')
    if (lower === when) return `due on ${when}`
    return `due ${lower}`
  })()

  return {
    title: `${action} — ${duePhrase}`,
    subtitle: reason,
    icon,
  }
}

/** Alias used by call sites that want date+time together. */
export const formatDueWhen = formatWhen


export function statusTone(
  status?: string | null,
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  const s = (status ?? '').toLowerCase()
  if (['won', 'approved', 'completed', 'open', 'confirmed', 'active'].some((x) => s.includes(x))) {
    return 'success'
  }
  if (['pending', 'submitted', 'negotiation', 'qualified'].some((x) => s.includes(x))) {
    return 'warning'
  }
  if (['lost', 'rejected', 'cancelled', 'overdue', 'blocked'].some((x) => s.includes(x))) {
    return 'danger'
  }
  return 'info'
}

export async function openTel(phone?: string | null): Promise<void> {
  if (!phone) return
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (!cleaned) return
  await Linking.openURL(`tel:${cleaned}`)
}

export async function openWhatsApp(phone?: string | null, text?: string): Promise<void> {
  if (!phone) return
  const digits = phone.replace(/\D/g, '')
  if (!digits) return
  const msg = text ? `?text=${encodeURIComponent(text)}` : ''
  await Linking.openURL(`https://wa.me/${digits}${msg}`)
}

export async function openMail(email?: string | null, subject?: string): Promise<void> {
  if (!email) return
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  await Linking.openURL(`mailto:${email}${q}`)
}

export async function openMaps(query: string): Promise<void> {
  const q = encodeURIComponent(query)
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`
  await Linking.openURL(url)
}

export function mapQueryFromCompany(c: {
  customerName?: string | null
  name?: string | null
  city?: string | null
  addressLine1?: string | null
  state?: string | null
  pincode?: string | null
}): string {
  return [companyLabel(c), c.addressLine1, c.city, c.state, c.pincode].filter(Boolean).join(', ')
}
