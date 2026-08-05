import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  FormSection,
  Loading,
  PrimaryButton,
  ReviewRow,
  StatusChip,
} from '@/components'
import { ApiError } from '@/api/errors'
import {
  isPoReceivable,
  lineReceiptStatusLabel,
  poPendingQuantity,
  poReceiptProgress,
  poReceiptStatusLabel,
} from '@/features/purchase/api'
import {
  usePurchaseOrderDetail,
  usePurchaseOrdersAccess,
  useGrnsForPurchaseOrder,
} from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, spacing, typography } from '@/theme'

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const poId = String(id || '')
  const router = useRouter()
  const { moduleOn, canView, canReceive } = usePurchaseOrdersAccess()
  const q = usePurchaseOrderDetail(poId, canView && Boolean(poId))
  const grnsQ = useGrnsForPurchaseOrder(poId, canView && Boolean(poId))

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase order" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase order" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You are not authorised to perform this Purchase action."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!poId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase order" onBack={() => router.back()} />
        <EmptyState title="Missing PO" description="No purchase order id in the route." />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase order" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !q.data) {
    const forbidden =
      q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)
    const notFound =
      q.error instanceof ApiError && (q.error.kind === 'not_found' || q.error.status === 404)
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase order" onBack={() => router.back()} />
        <ErrorState
          title={
            forbidden
              ? 'Not authorised'
              : notFound
                ? 'Not found'
                : 'Could not load purchase order'
          }
          error={
            new Error(
              forbidden
                ? 'You are not authorised to perform this Purchase action.'
                : notFound
                  ? 'This Purchase document could not be found.'
                  : q.error?.message || 'Unknown error',
            )
          }
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const po = q.data
  const pending = poPendingQuantity(po)
  const progress = poReceiptProgress(po)
  const progressPct = Math.round(progress * 100)
  const showReceive = canReceive && isPoReceivable(po)
  const relatedGrns = grnsQ.data?.items ?? []

  return (
    <View style={styles.flex}>
      <AppHeader
        title={po.orderNumber || 'Purchase order'}
        subtitle={po.vendorName || undefined}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          <StatusChip label={titleCaseLabel(po.status) || '—'} tone={statusTone(po.status)} />
          <StatusChip label={poReceiptStatusLabel(po)} compact />
        </View>

        <AppCard style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.progressTitle}>Receipt progress</Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressMeta}>
            {pending > 0 ? `${pending} qty still open` : 'Fully received on lines'}
          </Text>
        </AppCard>

        <FormSection title="Summary">
          <AppCard style={styles.card}>
            <ReviewRow label="Vendor" value={po.vendorName || po.vendorCode || '—'} />
            <ReviewRow label="Vendor code" value={po.vendorCode || '—'} />
            <ReviewRow
              label="Warehouse"
              value={po.deliveryWarehouseName || po.deliveryWarehouseCode || '—'}
            />
            <ReviewRow label="Plant" value={po.deliveryWarehousePlantId || '—'} />
            <ReviewRow label="PO date" value={formatDate(po.orderDate || undefined) || '—'} />
            <ReviewRow
              label="Expected delivery"
              value={formatDate(po.expectedDeliveryDate || undefined) || '—'}
            />
            <ReviewRow label="Currency" value={po.currencyCode || 'INR'} />
            <ReviewRow label="Total" value={formatMoney(Number(po.totalAmount ?? 0))} />
            <ReviewRow label="Payment terms" value={po.paymentTerms || '—'} />
            <ReviewRow label="Delivery terms" value={po.deliveryTerms || '—'} />
            <ReviewRow label="Pending qty" value={String(pending)} />
            <ReviewRow label="Received %" value={`${progressPct}%`} />
            {po.remarks ? <ReviewRow label="Remarks" value={String(po.remarks)} /> : null}
          </AppCard>
        </FormSection>

        <FormSection title="Lines">
          {(po.lines ?? []).length === 0 ? (
            <Text style={styles.muted}>No lines on this PO.</Text>
          ) : (
            (po.lines ?? []).map((line) => {
              const ordered = Number(line.quantity ?? line.uomQuantity ?? 0)
              const received = Number(line.receivedQuantity ?? 0)
              const open = Number(line.openQuantity ?? Math.max(0, ordered - received))
              return (
                <AppCard key={line.id} style={styles.card}>
                  <View style={styles.lineHead}>
                    <Text style={styles.lineCode}>{line.itemCode || '—'}</Text>
                    <StatusChip label={lineReceiptStatusLabel(line)} compact />
                  </View>
                  <Text style={styles.lineName}>{line.itemName || line.description || '—'}</Text>
                  <Text style={styles.meta}>
                    Ordered {ordered} · received {received} · pending {open}
                    {line.uomCode ? ` · ${line.uomCode}` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    Rate {formatMoney(Number(line.rate ?? 0))} · amount{' '}
                    {formatMoney(Number(line.amount ?? 0))}
                  </Text>
                </AppCard>
              )
            })
          )}
        </FormSection>

        <FormSection title="Related GRNs">
          {relatedGrns.length === 0 ? (
            <Text style={styles.muted}>No goods receipts linked yet.</Text>
          ) : (
            relatedGrns.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => router.push(`/(app)/purchase/grn/${g.id}` as never)}
              >
                <AppCard style={styles.card}>
                  <Text style={styles.lineCode}>{g.grnNumber || g.id.slice(0, 8)}</Text>
                  <Text style={styles.meta}>
                    {titleCaseLabel(g.status)} · {formatDate(g.receiptDate || undefined) || '—'}
                  </Text>
                </AppCard>
              </Pressable>
            ))
          )}
        </FormSection>

        {showReceive ? (
          <PrimaryButton
            title="Receive goods"
            onPress={() =>
              router.push(`/(app)/purchase/grn/receive?poId=${encodeURIComponent(poId)}` as never)
            }
            style={styles.cta}
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  progressCard: { marginBottom: spacing.md },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: { ...typography.bodyStrong },
  progressPct: { ...typography.bodyStrong, color: colors.primary },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  progressMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  card: { marginBottom: spacing.sm },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineCode: { ...typography.bodyStrong, flex: 1 },
  lineName: { ...typography.caption, marginTop: 4, color: colors.textSecondary },
  meta: { ...typography.micro, marginTop: 4, color: colors.textMuted },
  muted: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  cta: { marginTop: spacing.lg },
})
