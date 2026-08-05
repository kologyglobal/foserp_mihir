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
import { usePermissions } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import {
  shouldShowApproveAction,
  type PurchaseApprovalQueueRow,
} from '@/features/purchase/api'
import { usePurchaseApprovals, usePurchaseApprovalsAccess } from '@/features/purchase/hooks'
import { formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, radius, spacing, typography } from '@/theme'

function docIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'purchase_order') return 'receipt-outline'
  if (type === 'goods_receipt_note') return 'cube-outline'
  return 'document-text-outline'
}

function ApprovalRowCard({
  row,
  onOpen,
}: {
  row: PurchaseApprovalQueueRow
  onOpen: () => void
}) {
  const { permissions } = usePermissions()
  const canActUi = shouldShowApproveAction(row, permissions)
  const pendingDays = row.pendingSinceDays ?? 0
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <AppCard style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.iconBadge}>
            <Ionicons name={docIcon(row.documentType)} size={20} color={colors.primary} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.type}>{row.documentTypeLabel || titleCaseLabel(row.documentType)}</Text>
            <Text style={styles.title}>{row.documentNumber || '—'}</Text>
            <Text style={styles.meta}>
              {row.requestedBy || '—'}
              {row.approvalLevelLabel ? ` · ${row.approvalLevelLabel}` : ''}
            </Text>
          </View>
          <StatusChip
            label={row.statusLabel || titleCaseLabel(row.status) || 'Pending'}
            tone={statusTone(row.status)}
            compact
          />
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.amount}>{formatMoney(row.amount)}</Text>
          <Text style={styles.pending}>
            {pendingDays <= 0
              ? 'Submitted today'
              : pendingDays === 1
                ? '1 day pending'
                : `${pendingDays} days pending`}
          </Text>
        </View>
        {canActUi ? (
          <Text style={styles.actHint}>Tap to review and decide</Text>
        ) : (
          <Text style={styles.viewHint}>View only</Text>
        )}
      </AppCard>
    </Pressable>
  )
}

export default function PurchaseApprovalsListScreen() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const modules = profile?.modules
  const purchaseModuleOn = isModuleEnabled('purchase', modules)
  const { enabled } = usePurchaseApprovalsAccess()
  const q = usePurchaseApprovals('pending_mine')

  if (!purchaseModuleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase approvals" onBack={() => router.back()} />
        <EmptyState
          title="Purchase module disabled"
          description="This organisation does not have the purchase module enabled."
          icon="ban-outline"
        />
      </View>
    )
  }

  if (!enabled) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase approvals" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You need purchase approval or view permission (PR/PO) to open this queue."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  const forbidden =
    q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Purchase approvals"
        subtitle={
          q.isLoading
            ? 'Loading…'
            : q.data
              ? `${q.data.length} pending`
              : 'Pending for you'
        }
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching && !q.isLoading} onRefresh={() => void q.refetch()} />
        }
      >
        {q.isLoading ? <Loading /> : null}
        {q.error ? (
          <ErrorState
            title={forbidden ? 'Not authorised' : 'Could not load approvals'}
            error={
              forbidden
                ? new Error('You are not authorised to view the purchase approval queue.')
                : q.error
            }
            onRetry={() => void q.refetch()}
          />
        ) : null}
        {!q.isLoading && !q.error && (q.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="No purchase documents waiting for your approval."
            icon="checkmark-circle-outline"
            success
          />
        ) : null}
        {!q.isLoading && !q.error
          ? (q.data ?? []).map((row) => (
              <ApprovalRowCard
                key={row.approvalId || `${row.documentType}-${row.documentId}`}
                row={row}
                onOpen={() =>
                  router.push(`/(app)/purchase/approvals/${row.approvalId || row.documentId}` as never)
                }
              />
            ))
          : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  type: { ...typography.micro, color: colors.primary, fontWeight: '700' },
  title: { ...typography.bodyStrong, fontSize: 16 },
  meta: { ...typography.caption, marginTop: 3, color: colors.textSecondary },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
  },
  amount: { ...typography.metric, fontSize: 20, color: colors.primary },
  pending: { ...typography.caption, color: colors.textMuted },
  actHint: { ...typography.caption, color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
  viewHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
})
