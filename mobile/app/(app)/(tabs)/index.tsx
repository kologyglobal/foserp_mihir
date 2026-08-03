import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  Avatar,
  ErrorState,
  IconButton,
  MetricCard,
  SectionHeader,
  SkeletonMetricRow,
} from '@/components'
import { CrmFab } from '@/features/crm/components/CrmFab'
import { PriorityFollowUpRow } from '@/features/crm/components/PriorityFollowUpRow'
import { QuickActionsBar } from '@/features/crm/components/QuickActionsBar'
import { useCrmDashboard } from '@/features/crm/hooks'
import { formatMoney, greetingForNow } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, motion, radius, spacing, typography } from '@/theme'
import { useModules } from '@/auth/modules'

export default function CrmHomeScreen() {
  const profile = useSessionStore((s) => s.profile)
  const { data, isLoading, error, refetch } = useCrmDashboard()
  const { isEnabled } = useModules()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const fullName = profile?.user
    ? `${profile.user.firstName} ${profile.user.lastName}`.trim()
    : 'User'
  const displayName =
    profile?.user?.firstName?.trim() ||
    fullName.split(/\s+/).filter(Boolean)[0] ||
    'User'
  const dayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const orgName = profile?.tenant?.name ?? 'FOS'

  const todaysFollowUps = data?.panels?.todaysFollowUps ?? []
  const fuToday = data?.followUps?.dueToday ?? todaysFollowUps.length ?? 0
  const meetingsToday = data?.activities?.today ?? 0
  const pendingApprovals = data?.panels?.pendingApprovalCount ?? 0
  const pipeline = data?.opportunities?.pipelineValue ?? 0
  const pendingQuotes = data?.panels?.pendingApprovalQuotations?.length ?? 0
  const notificationBadge = pendingApprovals + fuToday

  void isEnabled

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, spacing.sm) + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              name="menu-outline"
              accessibilityLabel="Open menu"
              shape="square"
              onPress={() => router.push('/(app)/(tabs)/more')}
            />
            <View style={styles.headerText}>
              <Text style={styles.greet} numberOfLines={1}>
                {greetingForNow()}, {displayName} 👋
              </Text>
              <Text style={styles.tagline} numberOfLines={1}>
                Let's close more deals today.
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {dayLabel}
                  </Text>
                </View>
                <Text style={styles.metaDot}>·</Text>
                <View style={[styles.metaItem, styles.metaItemFlex]}>
                  <Ionicons name="business-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {orgName}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              name="search-outline"
              accessibilityLabel="Search"
              onPress={() => router.push('/(app)/crm/search')}
            />
            <IconButton
              name="notifications-outline"
              accessibilityLabel="Notifications"
              badgeCount={notificationBadge}
              onPress={() => router.push('/(app)/crm/notifications')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/(app)/profile')}
              style={({ pressed }) => [styles.avatarBtn, pressed && styles.avatarPressed]}
            >
              <Avatar name={fullName} size={42} pastel={false} statusDot />
            </Pressable>
          </View>
        </View>

        {isLoading ? <SkeletonMetricRow /> : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {!isLoading && !error ? (
          <>
            <View style={styles.metrics}>
              <MetricCard
                label="Follow-ups"
                value={fuToday}
                hint="Due today"
                icon="alarm-outline"
                tone="warning"
                trendLabel={fuToday > 0 ? 'Act now' : 'Clear'}
                onPress={() => router.push('/(app)/crm/follow-ups')}
              />
              <MetricCard
                label="Meetings"
                value={meetingsToday}
                hint="Activities today"
                icon="calendar-outline"
                tone="info"
              />
            </View>
            <View style={styles.metrics}>
              <MetricCard
                label="Quotes"
                value={pendingQuotes}
                hint="Awaiting approval"
                icon="document-text-outline"
                tone={pendingQuotes > 0 ? 'warning' : 'default'}
                onPress={() => router.push('/(app)/crm/quotations')}
              />
              <MetricCard
                label="Approvals"
                value={pendingApprovals}
                hint="Needs your review"
                icon="checkmark-done-outline"
                tone={pendingApprovals > 0 ? 'danger' : 'success'}
                onPress={() => router.push('/(app)/(tabs)/approvals')}
              />
            </View>
            <View style={styles.metrics}>
              <MetricCard
                label="Pipeline"
                value={formatMoney(pipeline)}
                hint="Open opportunity value"
                icon="trending-up-outline"
                tone="success"
                onPress={() => router.push('/(app)/crm/opportunities')}
              />
              <MetricCard
                label="Collection"
                value="Open"
                hint="Customer outstanding"
                icon="wallet-outline"
                tone="info"
                onPress={() => router.push('/(app)/crm/collection')}
              />
            </View>
          </>
        ) : null}

        <QuickActionsBar />

        <SectionHeader
          title="Today's plan"
          variant="label"
          actionLabel="See all"
          onAction={() => router.push('/(app)/crm/follow-ups')}
        />
        <AppCard padded={false} style={styles.listCard}>
          {todaysFollowUps.slice(0, 5).map((f, idx, arr) => {
            const row = f as Record<string, unknown>
            return (
              <PriorityFollowUpRow
                key={String(row.id ?? idx)}
                row={row}
                showDivider={idx < arr.length - 1}
                onPress={() => router.push('/(app)/crm/follow-ups')}
              />
            )
          })}
          {todaysFollowUps.length === 0 ? (
            <View style={styles.emptyPad}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sunny-outline" size={22} color={colors.success} />
              </View>
              <Text style={styles.emptyTitle}>You're clear for today</Text>
              <Text style={styles.emptyBody}>
                Schedule a follow-up or pull leads into your day plan.
              </Text>
            </View>
          ) : null}
        </AppCard>
      </ScrollView>
      <CrmFab />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 128,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.section,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minWidth: 0,
  },
  headerText: { flex: 1, minWidth: 0, paddingTop: 2 },
  greet: {
    ...typography.subtitle,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: -0.25,
  },
  tagline: {
    ...typography.caption,
    marginTop: 2,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
    minWidth: 0,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemFlex: { flexShrink: 1, minWidth: 0 },
  metaText: {
    ...typography.micro,
    fontWeight: '500',
    color: colors.textMuted,
  },
  metaDot: {
    ...typography.micro,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 0,
  },
  avatarBtn: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  avatarPressed: { opacity: 0.88, transform: [{ scale: motion.pressScale }] },
  metrics: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  listCard: { marginBottom: spacing.xxl, overflow: 'hidden' },
  emptyPad: {
    padding: spacing.xxl,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.bodyStrong, fontSize: 16 },
  emptyBody: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: colors.textMuted,
    lineHeight: 19,
  },
})
