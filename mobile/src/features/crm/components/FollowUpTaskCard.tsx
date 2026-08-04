import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusChip } from '@/components'
import {
  followUpTypeIcon,
  formatDate,
  formatTime,
  formatWhen,
  titleCaseLabel,
} from '@/features/crm/utils'
import { colors, motion, radius, shadows, spacing, typography } from '@/theme'
import type { CrmFollowUp } from '@/types/crm'

export type FollowUpBucket = 'today' | 'overdue' | 'upcoming' | 'completed'

type Props = {
  followUp: CrmFollowUp
  bucket: FollowUpBucket
  onPress: () => void
  onMenuPress?: () => void
}

const BUCKET_TINT: Record<
  FollowUpBucket,
  {
    iconBg: string
    iconFg: string
    /** Left edge accent — only Today per design */
    stripe: string | null
    timeIcon: keyof typeof Ionicons.glyphMap
  }
> = {
  today: {
    iconBg: colors.primaryMuted,
    iconFg: colors.primary,
    stripe: colors.primary,
    timeIcon: 'time-outline',
  },
  overdue: {
    iconBg: colors.dangerMuted,
    iconFg: colors.danger,
    stripe: null,
    timeIcon: 'time-outline',
  },
  upcoming: {
    iconBg: colors.orangeMuted,
    iconFg: colors.orange,
    stripe: null,
    timeIcon: 'calendar-outline',
  },
  completed: {
    iconBg: colors.successMuted,
    iconFg: colors.success,
    stripe: null,
    timeIcon: 'checkmark-circle-outline',
  },
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function pickCompany(f: CrmFollowUp): string {
  return (
    str(f.customerName) ||
    str(f.companyName) ||
    str(f.prospectCompany) ||
    str(f.leadName) ||
    'Follow-up'
  )
}

function pickContactLine(f: CrmFollowUp, company: string): string {
  const contact =
    str(f.contactName) ||
    str(f.contactPerson) ||
    str(f.fullName) ||
    (() => {
      const lead = str(f.leadName)
      return lead && lead !== company ? lead : ''
    })() ||
    str(f.assignedToName)

  const role =
    str(f.designation) ||
    str(f.role) ||
    str(f.contactRole) ||
    (f.isDecisionMaker === true ? 'Decision Maker' : '')

  if (contact && role) return `${contact} · ${role}`
  if (contact) return contact
  if (role) return role
  return 'Scheduled follow-up'
}

function priorityTone(priority?: string | null): 'danger' | 'warning' | 'default' | 'success' {
  const p = (priority ?? '').toLowerCase()
  if (p.includes('high') || p.includes('urgent') || p.includes('critical')) return 'danger'
  if (p.includes('low') || p.includes('soft')) return 'default'
  // Pending / Medium → warm orange
  return 'warning'
}

/** Compact day for overdue copy: "1 Aug" */
function formatShortDay(dueDate?: string | null): string {
  if (!dueDate) return '—'
  const raw = String(dueDate).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatDate(dueDate)
  const [ys, ms, ds] = raw.split('-')
  const d = new Date(Number(ys), Number(ms) - 1, Number(ds))
  if (Number.isNaN(d.getTime())) return formatDate(dueDate)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function daysOverdue(dueDate?: string | null): number {
  if (!dueDate) return 0
  const raw = String(dueDate).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 0
  const [ys, ms, ds] = raw.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  if (!y || !m || !d) return 0
  const target = new Date(y, m - 1, d)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((startToday.getTime() - target.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

/** Time row copy tailored to bucket (e.g. overdue lag). */
export function formatFollowUpTimeLabel(
  dueDate?: string | null,
  dueTime?: string | null,
  bucket?: FollowUpBucket,
): string {
  const t = formatTime(dueTime)
  if (bucket === 'overdue') {
    const n = daysOverdue(dueDate)
    const dayPart = formatShortDay(dueDate)
    const clock = t ? `, ${t}` : ''
    if (n <= 0) return t ? `Overdue · ${dayPart}, ${t}` : `Overdue · ${dayPart}`
    if (n === 1) return `Overdue by 1 day · ${dayPart}${clock}`
    return `Overdue by ${n} days · ${dayPart}${clock}`
  }
  const when = formatWhen(dueDate, dueTime)
  // Prefer comma form: "Today, 10:00 AM"
  return when.replace(' · ', ', ')
}

/**
 * Short action title only — not story sentences with company names.
 * e.g. "Make a call", "Follow up call", "Send an email"
 */
export function followUpActionTitle(f: CrmFollowUp): string {
  const typeRaw = str(f.followUpType)
  if (!typeRaw) return 'Follow-up'

  const typeKey = typeRaw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

  // Prefer clean labels when the raw type already reads as a short action
  const titled = titleCaseLabel(typeRaw)
  const wordCount = titled.split(/\s+/).filter(Boolean).length

  if (typeKey.includes('call') || typeKey.includes('phone')) {
    if (typeKey.includes('follow')) {
      return wordCount <= 4 ? titled : 'Follow up call'
    }
    if (typeKey === 'call' || typeKey === 'phone' || typeKey === 'phone call') {
      return 'Make a call'
    }
    return wordCount <= 4 ? titled : 'Make a call'
  }
  if (typeKey.includes('email') || typeKey.includes('mail')) {
    return wordCount <= 4 ? titled : 'Send an email'
  }
  if (typeKey.includes('visit') || typeKey.includes('site')) {
    return wordCount <= 4 ? titled : 'Site visit'
  }
  if (typeKey.includes('meet')) {
    return wordCount <= 4 ? titled : 'Hold a meeting'
  }
  if (
    typeKey.includes('whatsapp') ||
    typeKey.includes('message') ||
    typeKey.includes('sms') ||
    typeKey.includes('chat')
  ) {
    return wordCount <= 4 ? titled : 'Send a message'
  }
  if (typeKey.includes('video') || typeKey.includes('zoom') || typeKey.includes('teams')) {
    return wordCount <= 4 ? titled : 'Video call'
  }

  // Keep short humanized type; never append company/party
  return wordCount <= 5 ? titled : 'Follow-up'
}

function statusPill(
  followUp: CrmFollowUp,
  bucket: FollowUpBucket,
): { label: string; tone: 'danger' | 'warning' | 'default' | 'success' } {
  if (bucket === 'completed') {
    return {
      label: titleCaseLabel(followUp.status, 'Done'),
      tone: 'success',
    }
  }

  const priority = str(followUp.priority)
  const p = priority.toLowerCase()
  if (p.includes('high') || p.includes('urgent') || p.includes('critical')) {
    return { label: 'High', tone: 'danger' }
  }
  if (p.includes('low') || p.includes('soft')) {
    return { label: 'Low', tone: 'default' }
  }
  if (p.includes('medium') || p.includes('normal')) {
    return { label: 'Medium', tone: 'warning' }
  }

  // No explicit priority → status / Pending orange
  const status = str(followUp.status).toLowerCase()
  if (status.includes('pending') || status.includes('open') || !status) {
    return { label: 'Pending', tone: 'warning' }
  }
  if (priority) {
    return { label: titleCaseLabel(priority, 'Medium'), tone: priorityTone(priority) }
  }
  return { label: titleCaseLabel(followUp.status, 'Pending'), tone: 'warning' }
}

/**
 * Premium follow-up task card — type icon, short action, company, contact, time, priority.
 */
export function FollowUpTaskCard({ followUp, bucket, onPress, onMenuPress }: Props) {
  const tint = BUCKET_TINT[bucket]
  const company = pickCompany(followUp)
  const contactLine = pickContactLine(followUp, company)
  const actionTitle = followUpActionTitle(followUp)
  const timeLabel = formatFollowUpTimeLabel(followUp.dueDate, followUp.dueTime, bucket)
  const icon = followUpTypeIcon(followUp.followUpType)
  const pill = statusPill(followUp, bucket)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${actionTitle}. ${company}. ${contactLine}. ${timeLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {tint.stripe ? <View style={[styles.stripe, { backgroundColor: tint.stripe }]} /> : null}

      <View style={[styles.iconWrap, { backgroundColor: tint.iconBg }]}>
        <Ionicons name={icon} size={20} color={tint.iconFg} />
      </View>

      <View style={styles.body}>
        <Text style={styles.action} numberOfLines={1}>
          {actionTitle}
        </Text>
        <Text style={styles.company} numberOfLines={1}>
          {company}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={13} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {contactLine}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name={tint.timeIcon} size={13} color={tint.iconFg} />
          <Text style={[styles.timeText, { color: tint.iconFg }]} numberOfLines={1}>
            {timeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.trailing}>
        {onMenuPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More actions"
            onPress={() => onMenuPress()}
            hitSlop={10}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.menuPressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.menuPlaceholder} />
        )}
        <StatusChip label={pill.label} tone={pill.tone} compact />
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg, // ~16
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingLeft: spacing.lg + 2,
    gap: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: motion.pressScaleSoft }],
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 1,
  },
  action: {
    ...typography.bodyStrong,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.text,
    lineHeight: 20,
  },
  company: {
    ...typography.captionStrong,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  metaText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  timeText: {
    ...typography.captionStrong,
    fontSize: 12,
    flex: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 1,
    minWidth: 64,
    gap: spacing.sm,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -4,
  },
  menuPressed: { opacity: 0.7, backgroundColor: colors.surfaceMuted },
  menuPlaceholder: { width: 28, height: 28 },
})
