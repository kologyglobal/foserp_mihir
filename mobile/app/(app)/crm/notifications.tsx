import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppHeader,
  Avatar,
  EmptyState,
  Loading,
  SectionHeader,
} from '@/components'
import { useCrmDashboard, useFollowUps } from '@/features/crm/hooks'
import {
  followUpStory,
  followUpTypeIcon,
  formatWhen,
} from '@/features/crm/utils'
import { colors, layout, motion, radius, shadows, spacing, typography } from '@/theme'

type FeedTone = 'primary' | 'warning' | 'danger' | 'success' | 'default'

type FeedItem = {
  id: string
  category: string
  title: string
  body: string
  partyName: string
  timeLabel: string
  icon: keyof typeof Ionicons.glyphMap
  tone: FeedTone
  /** Sort key — later = newer when possible */
  sortKey: number
  href: string
  ctaLabel: string
}

const TONE: Record<FeedTone, { bg: string; fg: string; pillBg: string }> = {
  primary: { bg: colors.primaryMuted, fg: colors.primary, pillBg: colors.primarySoft },
  warning: { bg: colors.warningMuted, fg: colors.warning, pillBg: '#FEF3C7' },
  danger: { bg: colors.dangerMuted, fg: colors.danger, pillBg: '#FEE2E2' },
  success: { bg: colors.successMuted, fg: colors.success, pillBg: '#D1FAE5' },
  default: { bg: colors.draftMuted, fg: colors.draft, pillBg: colors.surfaceMuted },
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function parseSortTs(date?: string | null, time?: string | null): number {
  if (!date) return 0
  const d = String(date).trim()
  const t = time ? String(time).trim() : '00:00'
  const isoish = d.includes('T')
    ? d
    : `${d.slice(0, 10)}T${t.length === 5 ? `${t}:00` : t}`
  const ms = Date.parse(isoish)
  return Number.isNaN(ms) ? 0 : ms
}

function resolveFollowUpHref(row: Record<string, unknown>): string {
  const leadId = str(row.leadId)
  if (leadId) return `/(app)/crm/leads/${leadId}`
  const customerId = str(row.customerId) || str(row.companyId)
  if (customerId) return `/(app)/crm/companies/${customerId}`
  return '/(app)/crm/follow-ups'
}

function resolveQuoteHref(row: Record<string, unknown>): string {
  const qid = str(row.quotationId) || str(row.id)
  if (qid) return `/(app)/crm/quotations/${qid}`
  return '/(app)/crm/quotations'
}

/**
 * CRM live activity feed (follow-ups + approval queues).
 * Tap opens the related record when an id is available.
 */
export default function CrmNotificationsScreen() {
  const dash = useCrmDashboard()
  const fus = useFollowUps('today')
  const router = useRouter()

  const items = useMemo(() => {
    const out: FeedItem[] = []
    const seenFu = new Set<string>()

    const pushFollowUp = (row: Record<string, unknown>, source: string) => {
      const rawId = str(row.id) || `${source}-${str(row.dueDate)}-${str(row.followUpType)}`
      if (seenFu.has(rawId)) return
      seenFu.add(rawId)

      const party =
        str(row.customerName) ||
        str(row.companyName) ||
        str(row.leadName) ||
        str(row.contactName) ||
        'Contact'
      const story = followUpStory({
        followUpType: str(row.followUpType) || null,
        customerName: str(row.customerName) || null,
        leadName: str(row.leadName) || null,
        dueDate: str(row.dueDate) || null,
        dueTime: str(row.dueTime) || null,
      })
      const href = resolveFollowUpHref(row)
      const cta =
        str(row.leadId)
          ? 'Open lead'
          : str(row.customerId) || str(row.companyId)
            ? 'Open customer'
            : 'Open follow-ups'

      out.push({
        id: `fu-${rawId}`,
        category: 'Follow-up',
        title: story.title,
        body: story.subtitle,
        partyName: party,
        timeLabel: formatWhen(str(row.dueDate) || null, str(row.dueTime) || null),
        icon: followUpTypeIcon(str(row.followUpType)),
        tone: 'warning',
        sortKey: parseSortTs(str(row.dueDate), str(row.dueTime)) || Date.now() - 1,
        href,
        ctaLabel: cta,
      })
    }

    for (const f of dash.data?.panels?.todaysFollowUps ?? []) {
      pushFollowUp(f as Record<string, unknown>, 'panel')
    }
    for (const f of fus.data ?? []) {
      pushFollowUp(f as unknown as Record<string, unknown>, 'list')
    }

    for (const q of dash.data?.panels?.pendingApprovalQuotations ?? []) {
      const row = q as Record<string, unknown>
      const code = str(row.quotationCode) || str(row.quotationNo) || 'Quotation'
      const customer = str(row.customerName) || str(row.companyName) || 'Customer'
      const qid = str(row.quotationId) || str(row.id)
      const submitted = str(row.submittedAt) || str(row.updatedAt) || str(row.createdAt)

      out.push({
        id: `qa-${qid || code}`,
        category: 'Approval',
        title: `Review ${code}`,
        body: `Quote for ${customer} is waiting for your approval.`,
        partyName: customer,
        timeLabel: submitted ? formatWhen(submitted, null) : 'Pending',
        icon: 'document-text-outline',
        tone: 'danger',
        sortKey: parseSortTs(submitted, null) || Date.now(),
        href: resolveQuoteHref(row),
        ctaLabel: 'Open quotation',
      })
    }

    const pendingCount = dash.data?.panels?.pendingApprovalCount ?? 0
    if (pendingCount > 0 && !(dash.data?.panels?.pendingApprovalQuotations?.length ?? 0)) {
      out.push({
        id: 'approvals-queue',
        category: 'Approval',
        title:
          pendingCount === 1
            ? '1 item needs approval'
            : `${pendingCount} items need approval`,
        body: 'Open the approvals queue to review commercial documents.',
        partyName: 'Approvals',
        timeLabel: 'Now',
        icon: 'shield-checkmark-outline',
        tone: 'danger',
        sortKey: Date.now(),
        href: '/(app)/(tabs)/approvals',
        ctaLabel: 'Open approvals',
      })
    }

    out.sort((a, b) => b.sortKey - a.sortKey)
    return out
  }, [dash.data, fus.data])

  const loading = dash.isLoading || fus.isLoading

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Notifications"
        subtitle="Live CRM activity"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live feed</Text>
          <Text style={styles.liveMeta}>
            {items.length === 0
              ? 'No activity'
              : items.length === 1
                ? '1 update'
                : `${items.length} updates`}
          </Text>
        </View>

        {loading && items.length === 0 ? <Loading label="Loading feed…" /> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="Follow-up reminders and approval events appear here as a live feed."
            icon="notifications-outline"
            actionLabel="Go to follow-ups"
            onAction={() => router.push('/(app)/crm/follow-ups')}
          />
        ) : null}

        {items.length > 0 ? (
          <>
            <SectionHeader title="Today" variant="label" />
            <View style={styles.feed}>
              {items.map((item, index) => {
                const tone = TONE[item.tone]
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.category}. ${item.title}. ${item.ctaLabel}`}
                    onPress={() => router.push(item.href as never)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.rail}>
                      <View style={[styles.iconBubble, { backgroundColor: tone.bg }]}>
                        <Ionicons name={item.icon} size={18} color={tone.fg} />
                      </View>
                      {index < items.length - 1 ? <View style={styles.railLine} /> : null}
                    </View>

                    <View style={styles.card}>
                      <View style={styles.cardTop}>
                        <Avatar name={item.partyName} size={40} pastel />
                        <View style={styles.cardHead}>
                          <View style={styles.categoryRow}>
                            <View style={[styles.categoryPill, { backgroundColor: tone.pillBg }]}>
                              <Text style={[styles.categoryText, { color: tone.fg }]}>
                                {item.category}
                              </Text>
                            </View>
                            <Text style={styles.time}>{item.timeLabel}</Text>
                          </View>
                          <Text style={styles.title} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.body} numberOfLines={2}>
                            {item.body}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardFoot}>
                        <Text style={styles.partyHint} numberOfLines={1}>
                          {item.partyName}
                        </Text>
                        <View style={styles.cta}>
                          <Text style={styles.ctaText}>{item.ctaLabel}</Text>
                          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.hero,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignSelf: 'flex-start',
    ...shadows.soft,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    ...typography.captionStrong,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  liveMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  feed: { gap: 0 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: motion.pressScaleSoft }],
  },
  rail: {
    width: 40,
    alignItems: 'center',
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
    backgroundColor: colors.divider,
    marginTop: 4,
    borderRadius: 1,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
    minHeight: 112,
  },
  cardTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  cardHead: { flex: 1, minWidth: 0 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  categoryPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  categoryText: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
  },
  title: {
    ...typography.bodyStrong,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  body: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  partyHint: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ctaText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
})
