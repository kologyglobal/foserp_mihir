import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, StatusChip } from '@/components'
import {
  followUpTypeIcon,
  formatWhen,
  titleCaseLabel,
} from '@/features/crm/utils'
import { colors, motion, spacing, typography } from '@/theme'

export type PriorityFollowUpRowData = Record<string, unknown>

type Props = {
  row: PriorityFollowUpRowData
  onPress: () => void
  /** Draw hairline under the row (except last). */
  showDivider?: boolean
}

function str(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

function pickCompany(row: PriorityFollowUpRowData): string {
  return (
    str(row.customerName) ||
    str(row.companyName) ||
    str(row.prospectCompany) ||
    str(row.leadName) ||
    'Follow-up'
  )
}

function pickContactLine(row: PriorityFollowUpRowData, company: string): string {
  const contact =
    str(row.contactName) ||
    str(row.contactPerson) ||
    str(row.fullName) ||
    (() => {
      const lead = str(row.leadName)
      return lead && lead !== company ? lead : ''
    })() ||
    str(row.assignedToName)

  const roleExplicit =
    str(row.designation) ||
    str(row.role) ||
    str(row.contactRole) ||
    (row.isDecisionMaker === true ? 'Decision Maker' : '')

  const typeHint = titleCaseLabel(str(row.followUpType) || null, '')

  if (contact && roleExplicit) return `${contact} · ${roleExplicit}`
  if (contact && typeHint) return `${contact} · ${typeHint}`
  if (contact) return contact
  if (roleExplicit) return roleExplicit
  return 'Scheduled follow-up'
}

function priorityTone(priority?: string | null): 'danger' | 'warning' | 'default' {
  const p = (priority ?? '').toLowerCase()
  if (p.includes('high') || p.includes('urgent') || p.includes('critical')) return 'danger'
  if (p.includes('low') || p.includes('soft')) return 'default'
  return 'warning'
}

function priorityLabel(priority?: string | null): string {
  const p = (priority ?? '').toLowerCase()
  if (p.includes('high') || p.includes('urgent') || p.includes('critical')) return 'High'
  if (p.includes('low') || p.includes('soft')) return 'Low'
  if (!priority || !String(priority).trim()) return 'Medium'
  return titleCaseLabel(priority, 'Medium')
}

/**
 * Dense CRM follow-up list row — avatar, company, contact, action story, priority chip.
 * Accepts loose dashboard / list payloads (panel rows or CrmFollowUp).
 */
export function PriorityFollowUpRow({ row, onPress, showDivider }: Props) {
  const company = pickCompany(row)
  const contactLine = pickContactLine(row, company)
  const typeRaw = str(row.followUpType)
  const typeLabel = typeRaw
    ? `${titleCaseLabel(typeRaw)}${/\bfollow[- ]?up\b/i.test(typeRaw) ? '' : ' Follow-up'}`
    : 'Follow-up'
  const when = formatWhen(
    str(row.dueDate) || null,
    str(row.dueTime) || null,
  )
  const icon = followUpTypeIcon(typeRaw)
  const priority = str(row.priority) || null

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${company}. ${contactLine}. ${typeLabel}, ${when}. Priority ${priorityLabel(priority)}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Avatar name={company} size={44} pastel />
        <View style={styles.copy}>
          <Text style={styles.company} numberOfLines={1}>
            {company}
          </Text>
          <Text style={styles.contact} numberOfLines={1}>
            {contactLine}
          </Text>
          <View style={styles.storyRow}>
            <Ionicons name={icon} size={13} color={colors.primary} style={styles.storyIcon} />
            <Text style={styles.storyType} numberOfLines={1}>
              {typeLabel}
            </Text>
            <Text style={styles.storySep}> · </Text>
            <Text style={styles.storyWhen} numberOfLines={1}>
              {when}
            </Text>
          </View>
        </View>
        <StatusChip label={priorityLabel(priority)} tone={priorityTone(priority)} compact />
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      {showDivider ? <View style={styles.div} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 76,
  },
  pressed: { opacity: 0.9, backgroundColor: colors.surfaceMuted, transform: [{ scale: motion.pressScaleSoft }] },
  copy: { flex: 1, minWidth: 0 },
  company: {
    ...typography.bodyStrong,
    fontSize: 15,
    letterSpacing: -0.15,
    color: colors.text,
  },
  contact: {
    ...typography.caption,
    marginTop: 2,
    color: colors.textMuted,
  },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    minWidth: 0,
  },
  storyIcon: { marginRight: 4 },
  storyType: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  storySep: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  storyWhen: {
    ...typography.captionStrong,
    fontSize: 12,
    color: colors.primary,
    flexShrink: 1,
  },
  div: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: spacing.lg + 44 + spacing.md,
  },
})
