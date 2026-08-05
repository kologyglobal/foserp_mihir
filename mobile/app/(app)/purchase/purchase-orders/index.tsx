import { useEffect, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  SearchBar,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { ApiError } from '@/api/errors'
import {
  matchPoFilter,
  poPendingQuantity,
  poReceiptStatusLabel,
  type PoListFilter,
  type PurchaseOrderSummary,
} from '@/features/purchase/api'
import { usePurchaseOrdersAccess, usePurchaseOrdersList } from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'

const FILTERS: Array<{ id: PoListFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending_receipt', label: 'Pending receipt' },
  { id: 'partially_received', label: 'Partial' },
  { id: 'closed', label: 'Closed' },
]

export default function PurchaseOrdersListScreen() {
  const router = useRouter()
  const { moduleOn, canView } = usePurchaseOrdersAccess()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<PoListFilter>('open')
  const [page, setPage] = useState(1)
  const [accum, setAccum] = useState<PurchaseOrderSummary[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
    setAccum([])
  }, [debounced, filter])

  const q = usePurchaseOrdersList(debounced, filter, page, canView)

  useEffect(() => {
    if (!q.data?.items) return
    const filtered = q.data.items.filter((po) => matchPoFilter(po, filter))
    setAccum((prev) => (page === 1 ? filtered : [...prev, ...filtered]))
  }, [q.data, page, filter])

  const meta = q.data?.meta
  const canLoadMore = meta ? page < meta.totalPages : false

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase orders" onBack={() => router.back()} />
        <EmptyState
          title="Purchase module disabled"
          description="This organisation does not have the purchase module enabled."
          icon="ban-outline"
        />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase orders" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You are not authorised to perform this Purchase action."
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
        title="Purchase orders"
        subtitle={q.isLoading && page === 1 ? 'Loading…' : `${accum.length} shown`}
        onBack={() => router.back()}
      />
      <View style={styles.pad}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search PO or vendor…"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isLoading}
            onRefresh={() => {
              setPage(1)
              void q.refetch()
            }}
          />
        }
      >
        {q.isLoading && page === 1 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}
        {q.error ? (
          <ErrorState
            title={forbidden ? 'Not authorised' : 'Could not load purchase orders'}
            error={
              forbidden
                ? new Error('You are not authorised to perform this Purchase action.')
                : q.error
            }
            onRetry={() => void q.refetch()}
          />
        ) : null}
        {!q.isLoading && !q.error && accum.length === 0 ? (
          <EmptyState
            title="No purchase orders"
            description="Try another search or filter, or create a PO on desktop."
            icon="document-text-outline"
          />
        ) : null}
        {accum.map((po) => (
          <Pressable
            key={po.id}
            onPress={() => router.push(`/(app)/purchase/purchase-orders/${po.id}` as never)}
          >
            <AppCard style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBadge}>
                  <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.code}>{po.orderNumber || po.id.slice(0, 8)}</Text>
                  <Text style={styles.vendor} numberOfLines={1}>
                    {po.vendorName || po.vendorCode || '—'}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDate(po.orderDate || undefined)}
                    {po.expectedDeliveryDate
                      ? ` · due ${formatDate(po.expectedDeliveryDate)}`
                      : ''}
                  </Text>
                </View>
                <StatusChip
                  label={titleCaseLabel(po.status) || '—'}
                  tone={statusTone(po.status)}
                  compact
                />
              </View>
              <View style={styles.footer}>
                <Text style={styles.amount}>{formatMoney(Number(po.totalAmount ?? 0))}</Text>
                <Text style={styles.receipt}>{poReceiptStatusLabel(po)}</Text>
              </View>
              {poPendingQuantity(po) > 0 ? (
                <Text style={styles.pending}>Pending qty {poPendingQuantity(po)}</Text>
              ) : null}
            </AppCard>
          </Pressable>
        ))}
        {canLoadMore && !q.isLoading ? (
          <Pressable
            onPress={() => setPage((p) => p + 1)}
            style={styles.moreBtn}
          >
            <Text style={styles.moreText}>{q.isFetching ? 'Loading…' : 'Load more'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm },
  filters: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
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
  code: { ...typography.bodyStrong, fontSize: 16 },
  vendor: { ...typography.caption, marginTop: 2, color: colors.textSecondary },
  meta: { ...typography.micro, marginTop: 3, color: colors.textMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md,
  },
  amount: { ...typography.metric, fontSize: 18, color: colors.primary },
  receipt: { ...typography.caption, color: colors.textMuted },
  pending: { ...typography.caption, color: colors.primary, marginTop: spacing.xs, fontWeight: '600' },
  moreBtn: { padding: spacing.md, alignItems: 'center' },
  moreText: { ...typography.bodyStrong, color: colors.primary },
})
