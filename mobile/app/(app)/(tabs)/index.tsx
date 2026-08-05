import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  Avatar,
  EmptyState,
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
import { useNavigationAccess } from '@/auth/useNavigationAccess'
import { canAny } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function HomeScreen() {
  const profile = useSessionStore((s) => s.profile)
  const { home } = useNavigationAccess()
  const perms = profile?.permissions ?? []
  const crmOn =
    isModuleEnabled('crm', profile?.modules) &&
    canAny(
      [
        'crm.lead.view',
        'crm.opportunity.view',
        'crm.quotation.view',
        'crm.follow_up.view',
        'crm.company.view',
      ],
      perms,
    )
  const dash = useCrmDashboard()
  const data = crmOn ? dash.data : undefined
  const isLoading = crmOn && dash.isLoading
  const error = crmOn ? dash.error : null
  const refetch = dash.refetch
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const fullName = profile?.user
    ? `${profile.user.firstName} ${profile.user.lastName}`.trim()
    : 'User'
  const displayName =
    profile?.user?.firstName?.trim() || fullName.split(/\s+/).filter(Boolean)[0] || 'User'
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
  const notificationBadge = pendingApprovals + fuToday

  const operationalTiles = home.filter((e) => e.group !== 'crm' && e.id !== 'crm-home-tile')

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
                {greetingForNow()}, {displayName}
              </Text>
              <Text style={styles.tagline} numberOfLines={1}>
                {operationalTiles.length > 0
                  ? 'Your operational workspace'
                  : crmOn
                    ? "Let's close more deals today."
                    : 'No operational modules assigned'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.metaText}>{dayLabel}</Text>
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
            {crmOn ? (
              <IconButton
                name="search-outline"
                accessibilityLabel="Search"
                onPress={() => router.push('/(app)/crm/search')}
              />
            ) : null}
            <IconButton
              name="notifications-outline"
              accessibilityLabel="Notifications"
              badgeCount={notificationBadge}
              onPress={() =>
                router.push(crmOn ? '/(app)/crm/notifications' : '/(app)/(tabs)/approvals')
              }
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

        {operationalTiles.length > 0 ? (
          <>
            <SectionHeader title="Modules" />
            <View style={styles.tileGrid}>
              {operationalTiles.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => router.push(e.href as never)}
                  style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.tileIcon}>
                    <Ionicons
                      name={(e.icon as keyof typeof Ionicons.glyphMap) || 'apps-outline'}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={2}>
                    {e.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {crmOn ? (
          <>
            {isLoading ? <SkeletonMetricRow /> : null}
            {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
            {!isLoading && !error ? (
              <>
                <View style={styles.metrics}>
                  <MetricCard label="Follow-ups" value={String(fuToday)} />
                  <MetricCard label="Meetings" value={String(meetingsToday)} />
                  <MetricCard label="Pipeline" value={formatMoney(pipeline)} />
                </View>
                {/* CRM entry points: QuickActionsBar includes scan → /(app)/crm/business-card */}
                <QuickActionsBar />
                <SectionHeader title="Today's focus" />
                {todaysFollowUps.length === 0 ? (
                  <EmptyState
                    title="No follow-ups due today"
                    description="Stay ready — new tasks will show here."
                    icon="sunny-outline"
                  />
                ) : (
                  todaysFollowUps.slice(0, 5).map((fu, idx) => (
                    <PriorityFollowUpRow
                      key={String((fu as { id?: string }).id ?? idx)}
                      row={fu as Record<string, unknown>}
                      onPress={() => router.push('/(app)/crm/follow-ups')}
                    />
                  ))
                )}
              </>
            ) : null}
          </>
        ) : null}

        {!crmOn && operationalTiles.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            description="Ask your administrator to enable modules and grant permissions for your role."
            icon="lock-closed-outline"
          />
        ) : null}

        {operationalTiles.length > 0 && !crmOn ? (
          <AppCard style={styles.hintCard}>
            <Text style={styles.hintText}>
              Open Work for queues, Approvals for sign-off, and More for the full catalogue.
            </Text>
          </AppCard>
        ) : null}
      </ScrollView>
      {crmOn ? <CrmFab /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.hero,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', flex: 1, gap: spacing.sm, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  greet: { ...typography.title, fontSize: 20 },
  tagline: { ...typography.caption, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaItemFlex: { flex: 1, minWidth: 0 },
  metaText: { ...typography.micro, color: colors.textMuted },
  metaDot: { color: colors.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarBtn: { borderRadius: 21 },
  avatarPressed: { opacity: 0.85 },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 88,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileLabel: { ...typography.bodyStrong, fontSize: 14 },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  hintCard: { marginTop: spacing.md },
  hintText: { ...typography.caption, color: colors.textSecondary },
})
