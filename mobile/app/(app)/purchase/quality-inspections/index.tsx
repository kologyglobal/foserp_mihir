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
import { isModuleEnabled } from '@/auth/modules'
import {
  canViewPurchaseQi,
  qiDisplayStatusLabel,
  type QualityInspectionSummary,
} from '@/features/purchase/api'
import { useQiRegister } from '@/features/purchase/hooks'
import { formatDate, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, radius, spacing, typography } from '@/theme'

const FILTERS: Array<{ id: string; label: string; status?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending', status: 'PENDING' },
  { id: 'in_progress', label: 'In progress', status: 'IN_PROGRESS' },
  { id: 'accepted', label: 'Passed', status: 'ACCEPTED' },
  { id: 'rejected', label: 'Rejected', status: 'REJECTED' },
]

export default function PurchaseQiHandoffScreen() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const purchaseOn = isModuleEnabled('purchase', profile?.modules)
  const qualityOn = isModuleEnabled('quality', profile?.modules)
  const canView =
    perms != null && purchaseOn && canViewPurchaseQi(perms)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filterId, setFilterId] = useState('all')
  const [page, setPage] = useState(1)
  const [accum, setAccum] = useState<QualityInspectionSummary[]>([])

  const statusParam = FILTERS.find((f) => f.id === filterId)?.status

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
    setAccum([])
  }, [debounced, filterId])

  const q = useQiRegister(debounced, statusParam || '', page, canView)

  useEffect(() => {
    if (!q.data?.items) return
    setAccum((prev) => (page === 1 ? q.data!.items : [...prev, ...q.data!.items]))
  }, [q.data, page])

  const meta = q.data?.meta
  const canLoadMore = meta ? page < meta.totalPages : false

  if (!purchaseOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase QC" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase QC" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You need purchase.qi.view (or quality.view) to open Purchase QC handoff."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  const forbidden =
    q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)

  const openQi = (row: QualityInspectionSummary) => {
    router.push(`/(app)/purchase/quality-inspections/${row.id}` as never)
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Purchase QC handoff"
        subtitle="View + decide (purchase.qi)"
        onBack={() => router.back()}
      />
      <View style={styles.pad}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search inspection / GRN…"
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
            onPress={() => setFilterId(f.id)}
            style={[styles.chip, filterId === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, filterId === f.id && styles.chipTextOn]}>{f.label}</Text>
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
        <Text style={styles.hint}>
          Purchase QI decisions use purchase.qi.complete. Photos/kiosk workflows remain available in
          Quality when the quality module is enabled.
        </Text>
        {q.isLoading && page === 1 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}
        {q.error ? (
          <ErrorState
            title={forbidden ? 'Not authorised' : 'Could not load inspections'}
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
            title="No quality inspections"
            description="Inspections appear after GRNs that require QC."
            icon="flask-outline"
          />
        ) : null}
        {accum.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => openQi(row)}
          >
            <AppCard style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBadge}>
                  <Ionicons name="flask-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.code}>
                    {row.inspectionNumber || row.id.slice(0, 8)}
                  </Text>
                  <Text style={styles.vendor} numberOfLines={1}>
                    {[row.goodsReceiptNumber, row.purchaseOrderNumber, row.vendorName]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Text>
                  <Text style={styles.meta}>
                    {[row.itemCode, row.itemName].filter(Boolean).join(' · ') ||
                      formatDate(row.createdAt || row.inspectedAt || undefined) ||
                      '—'}
                  </Text>
                </View>
                <StatusChip
                  label={qiDisplayStatusLabel(row.status)}
                  tone={statusTone(row.status)}
                  compact
                />
              </View>
              <Text style={styles.actHint}>
                Tap to review{qualityOn ? ' · decide in Purchase or Quality' : ' · decide in Purchase QC'}
              </Text>
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
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
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
  actHint: { ...typography.micro, marginTop: spacing.sm, color: colors.primary },
  moreBtn: { padding: spacing.md, alignItems: 'center' },
  moreText: { ...typography.bodyStrong, color: colors.primary },
})
