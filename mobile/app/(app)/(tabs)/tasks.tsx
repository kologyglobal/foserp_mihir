import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  IconButton,
  Loading,
  PrimaryButton,
  SectionHeader,
  StatusChip,
} from '@/components'
import { useActivities, useFollowUps, useInvalidateCrm } from '@/features/crm/hooks'
import { completeFollowUp, rescheduleFollowUp } from '@/api/crmApi'
import {
  followUpStory,
  formatDate,
  titleCaseLabel,
  todayYmd,
} from '@/features/crm/utils'
import { SwipeableRow } from '@/features/crm/components/SwipeableRow'
import { colors, layout, motion, radius, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import { Ionicons } from '@expo/vector-icons'

type Bucket = 'today' | 'upcoming' | 'overdue' | 'completed'

const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  completed: 'Done',
}

export default function TasksScreen() {
  const [bucket, setBucket] = useState<Bucket>('today')
  const [outcome, setOutcome] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const view =
    bucket === 'today'
      ? 'today'
      : bucket === 'overdue'
        ? 'overdue'
        : bucket === 'completed'
          ? 'completed'
          : 'upcoming'
  const fus = useFollowUps(view)
  const activities = useActivities({ status: bucket === 'completed' ? 'completed' : undefined })
  const invalidate = useInvalidateCrm()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const tasks = useMemo(() => {
    const follow = fus.data ?? []
    const acts = (activities.data ?? []).filter((a) =>
      ['task', 'meeting', 'call'].includes((a.type || '').toLowerCase()),
    )
    return { follow, acts }
  }, [fus.data, activities.data])

  const onComplete = async (id: string) => {
    if (!outcome.trim()) {
      Alert.alert('Outcome required', 'Enter a completion outcome.')
      return
    }
    setBusy(true)
    try {
      await completeFollowUp(id, { outcome: outcome.trim() })
      setOutcome('')
      setActiveId(null)
      invalidate()
    } catch (e) {
      Alert.alert('Could not complete', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onReschedule = async (id: string) => {
    setBusy(true)
    try {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const ymd = d.toISOString().slice(0, 10)
      await rescheduleFollowUp(id, { dueDate: ymd })
      invalidate()
      Alert.alert('Rescheduled', `Moved to ${formatDate(ymd)}`)
    } catch (e) {
      Alert.alert('Reschedule failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Tasks"
        subtitle={`Follow-ups · ${formatDate(todayYmd())}`}
        right={
          <IconButton
            name="alarm-outline"
            accessibilityLabel="All follow-ups"
            onPress={() => router.push('/(app)/crm/follow-ups')}
          />
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buckets}>
        {(['today', 'upcoming', 'overdue', 'completed'] as Bucket[]).map((b) => (
          <Pressable
            key={b}
            onPress={() => setBucket(b)}
            style={({ pressed }) => [
              styles.bucket,
              bucket === b && styles.bucketActive,
              pressed && styles.bucketPressed,
            ]}
          >
            <Text style={[styles.bucketLabel, bucket === b && styles.bucketLabelActive]}>
              {BUCKET_LABEL[b]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {fus.isLoading ? <Loading /> : null}
        {fus.error ? <ErrorState error={fus.error} onRetry={() => void fus.refetch()} /> : null}

        <SectionHeader title="Follow-ups" actionLabel="+ New" onAction={() => router.push('/(app)/crm/follow-ups/create')} />
        {tasks.follow.map((f) => {
          const story = followUpStory({
            followUpType: f.followUpType,
            customerName: f.customerName,
            leadName: f.leadName,
            dueDate: f.dueDate,
            dueTime: f.dueTime,
          })
          return (
            <SwipeableRow
              key={f.id}
              rightActions={
                bucket === 'completed'
                  ? [
                      {
                        key: 'open',
                        label: 'Open',
                        tone: 'neutral',
                        onPress: () => router.push('/(app)/crm/follow-ups'),
                      },
                    ]
                  : [
                      {
                        key: 'complete',
                        label: 'Complete',
                        onPress: () => setActiveId(f.id),
                      },
                      {
                        key: 'resched',
                        label: 'Reschedule',
                        tone: 'neutral',
                        onPress: () => void onReschedule(f.id),
                      },
                    ]
              }
            >
              <AppCard style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.typeIcon}>
                    <Ionicons name={story.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.title} numberOfLines={2}>
                      {story.title}
                    </Text>
                    <Text style={styles.meta}>{story.subtitle}</Text>
                    <Text style={styles.metaMuted}>
                      Priority · {titleCaseLabel(f.priority, 'Medium')}
                    </Text>
                  </View>
                  <StatusChip
                    label={f.status || 'pending'}
                    tone={bucket === 'overdue' ? 'danger' : bucket === 'completed' ? 'success' : 'warning'}
                    compact
                  />
                </View>
                {activeId === f.id ? (
                  <View style={styles.completeBox}>
                    <TextInput
                      style={styles.input}
                      placeholder="What was the outcome?"
                      placeholderTextColor={colors.textMuted}
                      value={outcome}
                      onChangeText={setOutcome}
                      multiline
                    />
                    <PrimaryButton
                      title="Mark complete"
                      disabled={busy}
                      onPress={() => void onComplete(f.id)}
                      fullWidth
                    />
                  </View>
                ) : null}
              </AppCard>
            </SwipeableRow>
          )
        })}
        {!fus.isLoading && tasks.follow.length === 0 ? (
          <EmptyState
            title={bucket === 'completed' ? 'No completed tasks' : 'Nothing here yet'}
            description={
              bucket === 'overdue'
                ? 'Nice work — no overdue follow-ups.'
                : `No follow-ups in “${BUCKET_LABEL[bucket]}”.`
            }
            icon="checkbox-outline"
            success={bucket === 'overdue' || bucket === 'completed'}
            actionLabel="Schedule follow-up"
            onAction={() => router.push('/(app)/crm/follow-ups/create')}
          />
        ) : null}

        <SectionHeader title="Activities" />
        {tasks.acts.slice(0, 20).map((a) => (
          <SwipeableRow
            key={a.id}
            rightActions={[
              {
                key: 'open',
                label: 'Open',
                tone: 'neutral',
                onPress: () => router.push('/(app)/crm/meetings/create'),
              },
            ]}
          >
            <AppCard style={styles.actCard}>
              <Text style={styles.title}>{a.subject}</Text>
              <Text style={styles.meta}>
                {titleCaseLabel(a.type)} · {titleCaseLabel(a.status, 'Open')} · {formatDate(a.activityDate)}
              </Text>
            </AppCard>
          </SwipeableRow>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  buckets: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  bucket: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    minHeight: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  bucketActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bucketPressed: { opacity: 0.9, transform: [{ scale: motion.pressScale }] },
  bucketLabel: { ...typography.captionStrong, color: colors.textSecondary },
  bucketLabelActive: { color: colors.textInverse },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  card: { marginBottom: spacing.md },
  actCard: { marginBottom: spacing.md, gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 3 },
  metaMuted: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  completeBox: { marginTop: spacing.lg, gap: spacing.md },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 88,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceMuted,
    fontSize: 16,
    color: colors.text,
  },
})
