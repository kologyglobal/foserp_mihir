import { Pressable, StyleSheet, Text, View } from 'react-native'
import { AppCard, Avatar, StatusChip } from '@/components'
import { colors, radius, spacing, typography } from '@/theme'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { QuickContactActions } from '@/features/crm/components/QuickContactActions'
import type { CrmLead } from '@/types/crm'

type Props = {
  lead: CrmLead
  onPress: () => void
  onComplete?: () => void
  onReschedule?: () => void
}

export function LeadCard({ lead, onPress, onComplete, onReschedule }: Props) {
  return (
    <AppCard style={styles.card}>
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.header}>
          <Avatar name={lead.prospectName} size={48} />
          <View style={styles.headCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {lead.prospectName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {lead.companyName || lead.customerName || lead.city || 'Prospect'}
            </Text>
          </View>
          <StatusChip
            label={titleCaseLabel(lead.stage || lead.lifecycleStatus, 'Lead')}
            tone={statusTone(lead.stage)}
            compact
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Owner</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {lead.leadOwnerName || '—'}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Value</Text>
            <Text style={[styles.metaValue, styles.valueAmount]}>{formatMoney(lead.expectedValue)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Next FU</Text>
            <Text style={styles.metaValue}>{formatDate(lead.nextFollowUpDate)}</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <QuickContactActions
          phone={lead.mobile}
          email={lead.email}
          whatsappText={`Hi, following up on ${lead.prospectName}`}
        />
      </View>
      {(onComplete || onReschedule) && (
        <View style={styles.swipeRow}>
          {onComplete ? (
            <Pressable onPress={onComplete} style={styles.secondary}>
              <Text style={styles.secondaryText}>Complete FU</Text>
            </Pressable>
          ) : null}
          {onReschedule ? (
            <Pressable onPress={onReschedule} style={styles.secondary}>
              <Text style={styles.secondaryText}>Reschedule</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </AppCard>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyStrong, fontSize: 17, letterSpacing: -0.15 },
  sub: { ...typography.caption, marginTop: 3 },
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  metaBlock: { flex: 1 },
  metaLabel: { ...typography.micro, marginBottom: 3, textTransform: 'uppercase' },
  metaValue: { ...typography.captionStrong, color: colors.text },
  valueAmount: { color: colors.primary },
  actions: { marginTop: spacing.lg },
  swipeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  secondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: { ...typography.captionStrong, color: colors.primary },
})
