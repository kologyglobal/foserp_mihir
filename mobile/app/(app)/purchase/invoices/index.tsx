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
import type { PurchaseInvoiceSummary } from '@/features/purchase/phaseCApi'
import { useInvoiceAccess, useInvoiceList } from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'PENDING_APPROVAL', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'POSTED', label: 'Posted' },
]

export default function PurchaseInvoiceListScreen() {
  const router = useRouter()
  const { moduleOn, canView } = useInvoiceAccess()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [accum, setAccum] = useState<PurchaseInvoiceSummary[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => {
    setPage(1)
    setAccum([])
  }, [debounced, status])

  const q = useInvoiceList(debounced, status, page, canView)
  useEffect(() => {
    if (!q.data?.items) return
    setAccum((prev) => (page === 1 ? q.data!.items : [...prev, ...q.data!.items]))
  }, [q.data, page])

  if (!moduleOn || !canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase invoices" onBack={() => router.back()} />
        <EmptyState
          title={!moduleOn ? 'Purchase module disabled' : 'Not authorised'}
          description="Need purchase.invoice.view."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  const canLoadMore = q.data?.meta ? page < q.data.meta.totalPages : false

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Purchase invoices"
        subtitle="View + lifecycle — create lines on desktop"
        onBack={() => router.back()}
      />
      <View style={styles.pad}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search invoice…"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id || 'all'}
            onPress={() => setStatus(f.id)}
            style={[styles.chip, status === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, status === f.id && styles.chipTextOn]}>{f.label}</Text>
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
          <ErrorState title="Could not load invoices" error={q.error} onRetry={() => void q.refetch()} />
        ) : null}
        {!q.isLoading && !q.error && accum.length === 0 ? (
          <EmptyState title="No invoices" description="Create vendor invoices on desktop." icon="card-outline" />
        ) : null}
        {accum.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => router.push(`/(app)/purchase/invoices/${row.id}` as never)}
          >
            <AppCard style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBadge}>
                  <Ionicons name="card-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.code}>{row.invoiceNumber || row.id.slice(0, 8)}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {row.vendorName || row.vendorInvoiceNumber || '—'}
                  </Text>
                  <Text style={styles.meta}>{formatDate(row.invoiceDate || undefined)}</Text>
                </View>
                <StatusChip
                  label={titleCaseLabel(row.status) || '—'}
                  tone={statusTone(row.status)}
                  compact
                />
              </View>
              <Text style={styles.amount}>{formatMoney(Number(row.totalAmount ?? 0))}</Text>
            </AppCard>
          </Pressable>
        ))}
        {canLoadMore ? (
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
  filters: { paddingHorizontal: layout.screenPadding, paddingVertical: spacing.sm },
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
  cardTop: { flexDirection: 'row', gap: spacing.md },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1 },
  code: { ...typography.bodyStrong, fontSize: 16 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  amount: { ...typography.metric, fontSize: 18, color: colors.primary, marginTop: spacing.sm },
  moreBtn: { padding: spacing.md, alignItems: 'center' },
  moreText: { ...typography.bodyStrong, color: colors.primary },
})
