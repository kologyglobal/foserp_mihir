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
  PrimaryButton,
  SearchBar,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { ApiError } from '@/api/errors'
import {
  grnPostingStatusLabel,
  grnQcStatusLabel,
  type GrnListFilter,
  type GrnSummary,
} from '@/features/purchase/api'
import { useGrnAccess, useGrnsList } from '@/features/purchase/hooks'
import { formatDate, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'

const FILTERS: Array<{ id: GrnListFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SUBMITTED', label: 'Submitted' },
  { id: 'QC_PENDING', label: 'QC pending' },
  { id: 'PENDING_TOLERANCE_APPROVAL', label: 'Tolerance' },
  { id: 'INVENTORY_POSTED', label: 'Posted' },
]

export default function GrnListScreen() {
  const router = useRouter()
  const { moduleOn, canView, canCreate } = useGrnAccess()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<GrnListFilter>('all')
  const [page, setPage] = useState(1)
  const [accum, setAccum] = useState<GrnSummary[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
    setAccum([])
  }, [debounced, filter])

  const q = useGrnsList(debounced, filter, page, canView)

  useEffect(() => {
    if (!q.data?.items) return
    setAccum((prev) => (page === 1 ? q.data!.items : [...prev, ...q.data!.items]))
  }, [q.data, page])

  const meta = q.data?.meta
  const canLoadMore = meta ? page < meta.totalPages : false

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Goods receipts" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Goods receipts" onBack={() => router.back()} />
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
        title="Goods receipts"
        subtitle={q.isLoading && page === 1 ? 'Loading…' : `${accum.length} shown`}
        onBack={() => router.back()}
      />
      <View style={styles.pad}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search GRN, PO, vendor…"
        />
      </View>
      {canCreate ? (
        <View style={styles.pad}>
          <PrimaryButton
            title="Receive goods"
            onPress={() => router.push('/(app)/purchase/grn/receive' as never)}
          />
        </View>
      ) : null}
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
          </>
        ) : null}
        {q.error ? (
          <ErrorState
            title={forbidden ? 'Not authorised' : 'Could not load GRNs'}
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
            title="No goods receipts"
            description={canCreate ? 'Receive against an open PO to create a GRN.' : undefined}
            icon="cube-outline"
            actionLabel={canCreate ? 'Receive goods' : undefined}
            onAction={
              canCreate ? () => router.push('/(app)/purchase/grn/receive' as never) : undefined
            }
          />
        ) : null}
        {accum.map((grn) => (
          <Pressable
            key={grn.id}
            onPress={() => router.push(`/(app)/purchase/grn/${grn.id}` as never)}
          >
            <AppCard style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBadge}>
                  <Ionicons name="cube-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.code}>{grn.grnNumber || grn.id.slice(0, 8)}</Text>
                  <Text style={styles.meta}>
                    PO {grn.purchaseOrderNumber || '—'} · {grn.vendorName || '—'}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDate(grn.receiptDate || undefined) || '—'}
                    {grn.warehouseName ? ` · ${grn.warehouseName}` : ''}
                  </Text>
                </View>
                <StatusChip
                  label={titleCaseLabel(grn.status) || '—'}
                  tone={statusTone(grn.status)}
                  compact
                />
              </View>
              <View style={styles.footer}>
                <Text style={styles.qty}>Qty {Number(grn.totalReceivedQty ?? 0)}</Text>
                <Text style={styles.sub}>
                  {grnQcStatusLabel(grn)} · {grnPostingStatusLabel(grn)}
                </Text>
              </View>
            </AppCard>
          </Pressable>
        ))}
        {canLoadMore && !q.isLoading ? (
          <Pressable onPress={() => setPage((p) => p + 1)} style={styles.moreBtn}>
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
  meta: { ...typography.caption, marginTop: 3, color: colors.textSecondary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  qty: { ...typography.bodyStrong, color: colors.primary },
  sub: { ...typography.caption, color: colors.textMuted, flex: 1, textAlign: 'right' },
  moreBtn: { padding: spacing.md, alignItems: 'center' },
  moreText: { ...typography.bodyStrong, color: colors.primary },
})
