import { useMemo, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppHeader,
  EmptyState,
  ErrorState,
  IconButton,
  Loading,
  PrimaryButton,
} from '@/components'
import { useFollowUps, useInvalidateCrm } from '@/features/crm/hooks'
import { completeFollowUp, rescheduleFollowUp } from '@/api/crmApi'
import { titleCaseLabel } from '@/features/crm/utils'
import {
  FollowUpTaskCard,
  type FollowUpBucket,
} from '@/features/crm/components/FollowUpTaskCard'
import { SwipeableRow } from '@/features/crm/components/SwipeableRow'
import { ContextualActionsSheet } from '@/features/crm/components/ContextualActionsSheet'
import { colors, layout, motion, radius, shadows, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import { showToast } from '@/store/toastStore'
import type { CrmFollowUp } from '@/types/crm'

type BucketConfig = {
  key: FollowUpBucket
  view: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  /** Active border / badge / selected text */
  accent: string
  muteBg: string
  muteFg: string
}

const BUCKETS: BucketConfig[] = [
  {
    key: 'today',
    view: 'today',
    label: 'Today',
    icon: 'sunny-outline',
    accent: colors.primary,
    muteBg: colors.primaryMuted,
    muteFg: colors.primary,
  },
  {
    key: 'overdue',
    view: 'overdue',
    label: 'Overdue',
    icon: 'alert-circle-outline',
    accent: colors.danger,
    muteBg: colors.dangerMuted,
    muteFg: colors.danger,
  },
  {
    key: 'upcoming',
    view: 'upcoming',
    label: 'Upcoming',
    icon: 'calendar-outline',
    accent: colors.orange,
    muteBg: colors.orangeMuted,
    muteFg: colors.orange,
  },
  {
    key: 'completed',
    view: 'completed',
    label: 'Done',
    icon: 'checkmark-circle-outline',
    accent: colors.success,
    muteBg: colors.successMuted,
    muteFg: colors.success,
  },
]

function followUpHref(f: CrmFollowUp): string | null {
  if (f.leadId) return `/(app)/crm/leads/${f.leadId}`
  const companyId = f.customerId || str(f.companyId)
  if (companyId) return `/(app)/crm/companies/${companyId}`
  return null
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

export default function FollowUpsScreen() {
  const [view, setView] = useState<FollowUpBucket>('today')
  const todayQ = useFollowUps('today')
  const overdueQ = useFollowUps('overdue')
  const upcomingQ = useFollowUps('upcoming')
  const completedQ = useFollowUps('completed')

  const active =
    view === 'today'
      ? todayQ
      : view === 'overdue'
        ? overdueQ
        : view === 'upcoming'
          ? upcomingQ
          : completedQ

  const { data, isLoading, error, refetch, isFetching } = active
  const [activeId, setActiveId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [sheetFu, setSheetFu] = useState<CrmFollowUp | null>(null)
  const invalidate = useInvalidateCrm()
  const router = useRouter()

  const counts = useMemo(
    () => ({
      today: todayQ.data?.length ?? 0,
      overdue: overdueQ.data?.length ?? 0,
      upcoming: upcomingQ.data?.length ?? 0,
      completed: completedQ.data?.length ?? 0,
    }),
    [todayQ.data, overdueQ.data, upcomingQ.data, completedQ.data],
  )

  const sectionTitle = useMemo(() => {
    const cfg = BUCKETS.find((b) => b.key === view)!
    const n = counts[view]
    return `${cfg.label} · ${n}`
  }, [view, counts])

  const complete = async (id: string) => {
    if (!outcome.trim()) {
      showToast('Add an outcome before completing', 'warning')
      return
    }
    try {
      await completeFollowUp(id, { outcome: outcome.trim() })
      setOutcome('')
      setActiveId(null)
      invalidate()
      showToast('Follow-up completed', 'success')
    } catch (e) {
      showToast(getUserFriendlyMessage(e), 'danger')
    }
  }

  const reschedule = async (id: string) => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    try {
      await rescheduleFollowUp(id, { dueDate: d.toISOString().slice(0, 10) })
      invalidate()
      showToast('Follow-up rescheduled', 'success')
    } catch (e) {
      showToast(getUserFriendlyMessage(e), 'danger')
    }
  }

  const openFollowUp = (f: CrmFollowUp) => {
    const href = followUpHref(f)
    if (href) {
      router.push(href as never)
      return
    }
    setSheetFu(f)
  }

  const onRefresh = () => {
    void todayQ.refetch()
    void overdueQ.refetch()
    void upcomingQ.refetch()
    void completedQ.refetch()
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Follow-ups"
        subtitle="Stay on every touchpoint"
        right={
          <View style={styles.headerRight}>
            <IconButton
              name="search-outline"
              accessibilityLabel="Search CRM"
              onPress={() => router.push('/(app)/crm/search')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New follow-up"
              onPress={() => router.push('/(app)/crm/follow-ups/create')}
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            >
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={styles.addLabel}>Add</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(isFetching && !isLoading)}
            onRefresh={onRefresh}
          />
        }
      >
        <View style={styles.statsRow}>
          {BUCKETS.map((b) => {
            const selected = view === b.key
            return (
              <Pressable
                key={`stat-${b.key}`}
                onPress={() => setView(b.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${b.label}, ${counts[b.key]}`}
                style={({ pressed }) => [
                  styles.statCard,
                  selected && {
                    borderColor: b.accent,
                    backgroundColor: b.muteBg,
                  },
                  pressed && styles.statPressed,
                ]}
              >
                <Text style={[styles.statValue, { color: b.accent }]}>{counts[b.key]}</Text>
                <Text style={[styles.statLabel, selected && { color: b.accent }]}>{b.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          {view === 'completed' ? (
            <Pressable onPress={() => setView('today')} hitSlop={10}>
              <Text style={styles.sectionAction}>See all</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionHint}>Sort: Due time</Text>
          )}
        </View>

        {isLoading ? <Loading label="Loading follow-ups…" /> : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {(data ?? []).map((f) => (
          <View key={f.id}>
            <SwipeableRow
              rightActions={
                view === 'completed'
                  ? []
                  : [
                      {
                        key: 'done',
                        label: 'Complete',
                        onPress: () => setActiveId(f.id),
                      },
                      {
                        key: 'resched',
                        label: 'Reschedule',
                        tone: 'neutral',
                        onPress: () => void reschedule(f.id),
                      },
                    ]
              }
            >
              <FollowUpTaskCard
                followUp={f}
                bucket={view}
                onPress={() => openFollowUp(f)}
                onMenuPress={() => setSheetFu(f)}
              />
            </SwipeableRow>
            {activeId === f.id ? (
              <View style={styles.outcomeBox}>
                <Text style={styles.outcomeTitle}>Complete follow-up</Text>
                <TextInput
                  style={styles.input}
                  placeholder="What was the outcome?"
                  placeholderTextColor={colors.textMuted}
                  value={outcome}
                  onChangeText={setOutcome}
                  multiline
                />
                <View style={styles.outcomeActions}>
                  <Pressable
                    onPress={() => {
                      setActiveId(null)
                      setOutcome('')
                    }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelLabel}>Cancel</Text>
                  </Pressable>
                  <PrimaryButton title="Mark complete" onPress={() => void complete(f.id)} />
                </View>
              </View>
            ) : null}
          </View>
        ))}

        {!isLoading && (data ?? []).length === 0 ? (
          <EmptyState
            title={
              view === 'overdue'
                ? 'Nothing overdue'
                : view === 'completed'
                  ? 'No completed follow-ups'
                  : view === 'upcoming'
                    ? 'No upcoming follow-ups'
                    : 'No follow-ups today'
            }
            description="Schedule your next customer touch to stay on every deal."
            icon="alarm-outline"
            actionLabel="New follow-up"
            onAction={() => router.push('/(app)/crm/follow-ups/create')}
          />
        ) : null}
      </ScrollView>

      <ContextualActionsSheet
        visible={Boolean(sheetFu)}
        onClose={() => setSheetFu(null)}
        title="Follow-up actions"
        actions={[
          {
            key: 'complete',
            label: 'Complete',
            onPress: () => {
              if (sheetFu) setActiveId(sheetFu.id)
            },
          },
          {
            key: 'resched',
            label: 'Reschedule +1 day',
            onPress: () => sheetFu && void reschedule(sheetFu.id),
          },
          {
            key: 'open',
            label: followUpHref(sheetFu ?? ({} as CrmFollowUp))
              ? 'Open related'
              : `Status · ${titleCaseLabel(sheetFu?.status, 'Pending')}`,
            onPress: () => {
              if (!sheetFu) return
              const href = followUpHref(sheetFu)
              if (href) router.push(href as never)
            },
          },
          {
            key: 'note',
            label: 'Add outcome note',
            onPress: () => setActiveId(sheetFu?.id ?? null),
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md + 2,
    height: 40,
    borderRadius: radius.md,
    ...shadows.soft,
  },
  addBtnPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: motion.pressScale }],
  },
  addLabel: {
    ...typography.captionStrong,
    color: colors.textInverse,
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.hero,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  sectionAction: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  statPressed: { opacity: 0.9 },
  statValue: {
    ...typography.subtitle,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  statLabel: {
    ...typography.micro,
    marginTop: 2,
    color: colors.textMuted,
  },
  outcomeBox: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.soft,
  },
  outcomeTitle: { ...typography.bodyStrong, fontSize: 15 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 88,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceMuted,
    fontSize: 16,
    color: colors.text,
  },
  outcomeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelLabel: { ...typography.captionStrong, color: colors.textSecondary },
})
