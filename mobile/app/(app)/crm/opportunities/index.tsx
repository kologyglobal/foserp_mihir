import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  AppHeader,
  BottomSheet,
  EmptyState,
  ErrorState,
  IconButton,
  SearchBar,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { avatarPastelForName } from '@/components/Avatar'
import { TodayFocusDeck } from '@/features/crm/components/TodayFocusDeck'
import {
  getActiveSnoozedOpportunityIds,
  snoozeOpportunityFocus,
} from '@/features/crm/focusSnooze'
import { useOpportunities, usePipelines } from '@/features/crm/hooks'
import {
  buildTodayFocusList,
  companyIdOf,
  companyOf,
  contactOf,
  dueMeta,
  oppAmount,
  opportunityTitleOf,
  ownerOf,
  parseDay,
  productOf,
  stageIdOf,
  stageLabelOf,
  str,
} from '@/features/crm/opportunityDisplay'
import { formatDate, formatMoney, statusTone } from '@/features/crm/utils'
import { showToast } from '@/store/toastStore'
import { colors, layout, motion, radius, shadows, spacing, typography } from '@/theme'
import type { CrmOpportunity, PipelineStage } from '@/types/crm'

const FALLBACK_STAGES: PipelineStage[] = [
  { id: 'new', name: 'New', slug: 'new', probability: 10 },
  { id: 'qualified', name: 'Qualified', slug: 'qualified', probability: 25 },
  { id: 'qualification', name: 'Qualification', slug: 'qualification', probability: 25 },
  { id: 'proposal', name: 'Proposal', slug: 'proposal', probability: 50 },
  { id: 'negotiation', name: 'Negotiation', slug: 'negotiation', probability: 75 },
  { id: 'won', name: 'Won', slug: 'won', probability: 100, isClosedWon: true },
  { id: 'lost', name: 'Lost', slug: 'lost', probability: 0, isClosedLost: true },
]

const STAGE_DOT: Record<string, string> = {
  new: colors.info,
  qualified: colors.primary,
  qualification: colors.primary,
  proposal: colors.purple,
  negotiation: colors.orange,
  won: colors.success,
  lost: colors.danger,
}

type SortKey = 'amount' | 'closeDate' | 'name'

function focusRouteParams(o: CrmOpportunity) {
  return {
    opportunityId: o.id,
    customerId: companyIdOf(o) || undefined,
    companyId: companyIdOf(o) || undefined,
    companyName: companyOf(o),
  }
}

export default function OpportunitiesScreen() {
  const opps = useOpportunities()
  const pipes = usePipelines()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('amount')
  const [filterSheet, setFilterSheet] = useState(false)
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set())
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    void getActiveSnoozedOpportunityIds().then(setSnoozedIds)
  }, [])

  const stages = useMemo(() => {
    const def = (pipes.data ?? []).find((p) => p.isDefault) ?? pipes.data?.[0]
    if (def?.stages?.length) return def.stages
    return FALLBACK_STAGES
  }, [pipes.data])

  const all = opps.data ?? []

  const stageCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stages) map.set(s.id, 0)
    for (const o of all) {
      const id = stageIdOf(o, stages)
      if (id) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [all, stages])

  const focusItems = useMemo(
    () =>
      buildTodayFocusList(all, stages, {
        snoozedIds,
        dismissedIds: sessionDismissed,
      }),
    [all, stages, snoozedIds, sessionDismissed],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = all.filter((o) => {
      if (stageFilter !== 'all') {
        const sid = stageIdOf(o, stages)
        if (sid !== stageFilter) return false
      }
      if (!q) return true
      const hay = [
        companyOf(o),
        opportunityTitleOf(o),
        productOf(o),
        contactOf(o),
        ownerOf(o),
        stageLabelOf(o, stages),
        str(o.opportunityNo),
        str(o.opportunityCode),
        str(o.opportunityName),
        str(o.name),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })

    list = [...list].sort((a, b) => {
      if (sortKey === 'amount') return oppAmount(b) - oppAmount(a)
      if (sortKey === 'name') return companyOf(a).localeCompare(companyOf(b))
      const da = parseDay(a.expectedCloseDate)?.getTime() ?? Number.POSITIVE_INFINITY
      const db = parseDay(b.expectedCloseDate)?.getTime() ?? Number.POSITIVE_INFINITY
      return da - db
    })
    return list
  }, [all, query, stageFilter, sortKey, stages])

  const openOpportunity = (o: CrmOpportunity) => {
    const companyId = companyIdOf(o)
    if (companyId) {
      router.push(`/(app)/crm/companies/${companyId}` as never)
      return
    }
    const product = productOf(o)
    Alert.alert(
      companyOf(o),
      [
        product ? `Product: ${product}` : null,
        `Value: ${formatMoney(oppAmount(o))}`,
        `Stage: ${stageLabelOf(o, stages)}`,
        `Owner: ${ownerOf(o)}`,
        o.expectedCloseDate ? `Close: ${formatDate(o.expectedCloseDate)}` : null,
        'Full opportunity detail is available on web CRM.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  const handleSnooze = useCallback(async (o: CrmOpportunity) => {
    await snoozeOpportunityFocus(o.id, 24)
    setSnoozedIds((prev) => new Set(prev).add(o.id))
    showToast(`Snoozed · ${companyOf(o)}`, 'info')
  }, [])

  const handleSessionDismiss = useCallback((o: CrmOpportunity) => {
    setSessionDismissed((prev) => new Set(prev).add(o.id))
  }, [])

  const handleFollowUp = useCallback(
    (o: CrmOpportunity) => {
      setSessionDismissed((prev) => new Set(prev).add(o.id))
      router.push({
        pathname: '/(app)/crm/follow-ups/create',
        params: focusRouteParams(o),
      } as never)
    },
    [router],
  )

  const handleLogActivity = useCallback(
    (o: CrmOpportunity) => {
      setSessionDismissed((prev) => new Set(prev).add(o.id))
      router.push({
        pathname: '/(app)/crm/meetings/create',
        params: {
          ...focusRouteParams(o),
          subject: `Discussion · ${companyOf(o)}`,
        },
      } as never)
    },
    [router],
  )

  const onCreate = () => {
    Alert.alert(
      'New opportunity',
      'Create opportunities on the web CRM for full pipeline staging, then they appear here.',
    )
  }

  const cycleSort = () => {
    setSortKey((prev) => {
      if (prev === 'amount') return 'closeDate'
      if (prev === 'closeDate') return 'name'
      return 'amount'
    })
  }

  const sortLabel =
    sortKey === 'amount' ? 'Value' : sortKey === 'closeDate' ? 'Close date' : 'Name'

  const loading = opps.isLoading || pipes.isLoading

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Opportunities"
        subtitle="Focus on the right deals."
        onBack={() => router.back()}
        right={
          <View style={styles.headerRight}>
            <IconButton
              name="search-outline"
              accessibilityLabel="Search CRM"
              onPress={() => router.push('/(app)/crm/search')}
            />
            <IconButton
              name="options-outline"
              accessibilityLabel="Filter opportunities"
              onPress={() => setFilterSheet(true)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New opportunity"
              onPress={onCreate}
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            >
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={styles.addLabel}>New</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={Boolean(opps.isFetching && !opps.isLoading)}
            onRefresh={() => {
              void opps.refetch()
              void pipes.refetch()
              void getActiveSnoozedOpportunityIds().then(setSnoozedIds)
            }}
          />
        }
      >
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}

        {opps.error ? (
          <ErrorState error={opps.error} onRetry={() => void opps.refetch()} />
        ) : null}

        {!loading ? (
          <TodayFocusDeck
            items={focusItems}
            stages={stages}
            onOpen={openOpportunity}
            onSnooze={(o) => {
              void handleSnooze(o)
            }}
            onSessionDismiss={handleSessionDismiss}
            onAddFollowUp={handleFollowUp}
            onLogActivity={handleLogActivity}
          />
        ) : null}

        {/* Stage pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          <Pressable
            onPress={() => setStageFilter('all')}
            accessibilityRole="button"
            accessibilityState={{ selected: stageFilter === 'all' }}
            style={({ pressed }) => [
              styles.pill,
              stageFilter === 'all' ? styles.pillActive : styles.pillIdle,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.pillText, stageFilter === 'all' && styles.pillTextActive]}>
              All
            </Text>
            <View style={[styles.pillCount, stageFilter === 'all' && styles.pillCountActive]}>
              <Text
                style={[
                  styles.pillCountText,
                  stageFilter === 'all' && styles.pillCountTextActive,
                ]}
              >
                {all.length}
              </Text>
            </View>
          </Pressable>

          {stages.map((stage) => {
            const selected = stageFilter === stage.id
            const count = stageCounts.get(stage.id) ?? 0
            const dot =
              STAGE_DOT[stage.slug.toLowerCase()] ||
              STAGE_DOT[stage.name.toLowerCase()] ||
              colors.textMuted
            return (
              <Pressable
                key={stage.id}
                onPress={() => setStageFilter(stage.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${stage.name}, ${count}`}
                style={({ pressed }) => [
                  styles.pill,
                  selected ? styles.pillActive : styles.pillIdle,
                  pressed && styles.pillPressed,
                ]}
              >
                {!selected ? <View style={[styles.stageDot, { backgroundColor: dot }]} /> : null}
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                  {stage.name}
                </Text>
                <View style={[styles.pillCount, selected && styles.pillCountActive]}>
                  <Text
                    style={[styles.pillCountText, selected && styles.pillCountTextActive]}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Search + sort */}
        <View style={styles.searchRow}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search opportunities..."
            style={styles.searchBar}
          />
          <Pressable
            onPress={cycleSort}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sortLabel}`}
            style={({ pressed }) => [styles.sortBtn, pressed && styles.pillPressed]}
          >
            <Ionicons name="swap-vertical-outline" size={18} color={colors.primary} />
            <Text style={styles.sortLabel}>{sortLabel}</Text>
          </Pressable>
        </View>

        {/* List */}
        {filtered.map((o) => {
          const company = companyOf(o)
          const product = productOf(o)
          const owner = ownerOf(o)
          const contact = contactOf(o)
          const stageLabel = stageLabelOf(o, stages)
          const due = dueMeta(o.expectedCloseDate)
          const pastel = avatarPastelForName(company)
          const personLine = owner !== 'Unassigned' ? owner : contact || owner
          return (
            <Pressable
              key={o.id}
              onPress={() => openOpportunity(o)}
              accessibilityRole="button"
              accessibilityLabel={`${company}${product ? `, ${product}` : ''}, ${formatMoney(oppAmount(o))}`}
              style={({ pressed }) => [styles.listCard, pressed && styles.cardPressed]}
            >
              <View style={[styles.listIcon, { backgroundColor: pastel.bg }]}>
                <Ionicons name="business-outline" size={20} color={pastel.fg} />
              </View>

              <View style={styles.listBody}>
                <Text style={styles.listCompany} numberOfLines={1}>
                  {company}
                </Text>
                {product && product.toLowerCase() !== company.toLowerCase() ? (
                  <Text style={styles.listProduct} numberOfLines={1}>
                    {product}
                  </Text>
                ) : null}
                <View style={styles.listLine}>
                  <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.listMeta} numberOfLines={1}>
                    {personLine}
                  </Text>
                </View>
                <View style={styles.listLine}>
                  <Ionicons name="calendar-outline" size={13} color={due.color} />
                  <Text style={[styles.listMeta, { color: due.color }]} numberOfLines={1}>
                    {due.label}
                  </Text>
                </View>
              </View>

              <View style={styles.listRight}>
                <StatusChip label={stageLabel} tone={statusTone(stageLabel)} compact />
                <Text style={styles.listAmount}>{formatMoney(oppAmount(o))}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          )
        })}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? 'No opportunities' : 'No matches'}
            description={
              all.length === 0
                ? 'Convert a qualified lead on web to start your pipeline.'
                : 'Try another stage filter or search term.'
            }
            icon="funnel-outline"
          />
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        title="Filter & sort"
      >
        <Text style={styles.sheetHint}>Stage</Text>
        <View style={styles.sheetChips}>
          <Pressable
            onPress={() => {
              setStageFilter('all')
              setFilterSheet(false)
            }}
            style={[styles.sheetChip, stageFilter === 'all' && styles.sheetChipOn]}
          >
            <Text style={[styles.sheetChipText, stageFilter === 'all' && styles.sheetChipTextOn]}>
              All ({all.length})
            </Text>
          </Pressable>
          {stages.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                setStageFilter(s.id)
                setFilterSheet(false)
              }}
              style={[styles.sheetChip, stageFilter === s.id && styles.sheetChipOn]}
            >
              <Text
                style={[
                  styles.sheetChipText,
                  stageFilter === s.id && styles.sheetChipTextOn,
                ]}
              >
                {s.name} ({stageCounts.get(s.id) ?? 0})
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sheetHint, { marginTop: spacing.xl }]}>Sort by</Text>
        {(
          [
            ['amount', 'Deal value'],
            ['closeDate', 'Close date'],
            ['name', 'Company name'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => {
              setSortKey(key)
              setFilterSheet(false)
            }}
            style={styles.sheetRow}
          >
            <Text style={styles.sheetRowText}>{label}</Text>
            {sortKey === key ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            ) : (
              <View style={styles.sheetRadio} />
            )}
          </Pressable>
        ))}
      </BottomSheet>
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
    borderRadius: radius.full,
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
    paddingBottom: spacing.hero,
  },
  pills: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingRight: spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md + 2,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pillPressed: { opacity: 0.9, transform: [{ scale: motion.pressScaleSoft }] },
  pillText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    fontSize: 13,
  },
  pillTextActive: { color: colors.textInverse },
  pillCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  pillCountText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontSize: 11,
  },
  pillCountTextActive: { color: colors.textInverse },
  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchBar: { flex: 1 },
  sortBtn: {
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...shadows.soft,
  },
  sortLabel: {
    ...typography.micro,
    color: colors.primary,
    fontSize: 10,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.soft,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: motion.pressScaleSoft }],
  },
  listIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBody: { flex: 1, minWidth: 0, gap: 4 },
  listCompany: {
    ...typography.bodyStrong,
    fontSize: 16,
    letterSpacing: -0.15,
  },
  listProduct: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  listLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  listMeta: {
    ...typography.caption,
    flex: 1,
    color: colors.textSecondary,
  },
  listRight: {
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: 120,
  },
  listAmount: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  sheetHint: {
    ...typography.micro,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sheetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sheetChipOn: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  sheetChipText: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  sheetChipTextOn: { color: colors.primary },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  sheetRowText: { ...typography.body },
  sheetRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
})
