import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  StatusChip,
} from '@/components'
import { ApiError } from '@/api/errors'
import { isModuleEnabled } from '@/auth/modules'
import { useQcQueue, useQualityAccess } from '@/features/quality/hooks'
import type { QcKioskQueueItem } from '@/features/quality/api'
import { statusTone, titleCaseLabel } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, radius, spacing, typography } from '@/theme'

function QueueCard({ row, onOpen }: { row: QcKioskQueueItem; onOpen: () => void }) {
  const title =
    row.itemName ||
    row.itemCode ||
    row.productionOrderNumber ||
    row.inspectionNumber ||
    'Inspection'
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <AppCard style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.iconBadge}>
            <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.type}>{titleCaseLabel(row.category || 'QC')}</Text>
            <Text style={styles.title}>{row.inspectionNumber || '—'}</Text>
            <Text style={styles.meta}>
              {[row.itemCode, row.stageName, row.planCode].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
          <StatusChip
            label={titleCaseLabel(row.status || 'Pending')}
            tone={statusTone(row.status || 'pending')}
            compact
          />
        </View>
        {row.inspectedQty ? (
          <Text style={styles.qty}>Qty {row.inspectedQty}</Text>
        ) : null}
        <Text style={styles.actHint}>Tap to inspect and attach photos</Text>
      </AppCard>
    </Pressable>
  )
}

export default function QcQueueScreen() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const qualityModuleOn = isModuleEnabled('quality', profile?.modules)
  const { enabled } = useQualityAccess()
  const q = useQcQueue()

  if (!qualityModuleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="QC queue" onBack={() => router.back()} />
        <EmptyState
          title="Quality module disabled"
          description="This organisation does not have the quality module enabled."
          icon="ban-outline"
        />
      </View>
    )
  }

  if (!enabled) {
    return (
      <View style={styles.flex}>
        <AppHeader title="QC queue" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You are not authorised to view the QC queue."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="QC queue" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error) {
    const forbidden =
      q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)
    return (
      <View style={styles.flex}>
        <AppHeader title="QC queue" onBack={() => router.back()} />
        <ErrorState
          title={forbidden ? 'Not authorised' : 'Could not load queue'}
          error={q.error}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const items = q.data?.items ?? []
  const summary = q.data?.summary

  return (
    <View style={styles.flex}>
      <AppHeader title="QC queue" onBack={() => router.back()} />
      {summary ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {summary.openCount} open · {summary.pendingCount} pending · {summary.reworkCount} rework
          </Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
      >
        {items.length === 0 ? (
          <EmptyState
            title="Queue empty"
            description="No pending or rework inspections right now."
            icon="checkmark-circle-outline"
          />
        ) : (
          items.map((row) => (
            <QueueCard
              key={row.id}
              row={row}
              onOpen={() => router.push(`/(app)/quality/inspection/${row.id}` as never)}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  summaryRow: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },
  summaryText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, gap: 2 },
  type: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.subtitle, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  qty: { ...typography.caption, color: colors.textSecondary },
  actHint: { ...typography.caption, color: colors.primary },
})
