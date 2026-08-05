import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  StatusChip,
} from '@/components'
import { ScanField } from '@/features/store/ScanField'
import { normalizeScan, type StockBalanceRow } from '@/features/store/api'
import { useStockAccess, useStockSearch } from '@/features/store/hooks'
import { colors, layout, spacing, typography } from '@/theme'

function qtyLabel(row: StockBalanceRow, key: keyof StockBalanceRow): string {
  const v = row[key]
  if (v == null) return '—'
  return String(v)
}

export default function StockInquiryScreen() {
  const { canView, invOn } = useStockAccess()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(normalizeScan(search)), 300)
    return () => clearTimeout(t)
  }, [search])

  const q = useStockSearch(debounced, canView)

  if (!invOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock inquiry" showBack />
        <EmptyState
          title="Inventory not enabled"
          description="Your organisation does not have the inventory module turned on."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock inquiry" showBack />
        <EmptyState
          title="No access"
          description="Requires inventory.stock.view or inventory.view."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  const balances = q.data?.balances ?? []
  const items = q.data?.items ?? []
  const primary = items[0]

  return (
    <View style={styles.flex}>
      <AppHeader title="Stock inquiry" subtitle="On-hand by item / warehouse" showBack />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Scan or type an item code. Results load live balances from inventory (not demo data).
        </Text>
        <ScanField
          value={search}
          onChangeText={setSearch}
          onSubmitScan={(n) => {
            setSearch(n)
            setDebounced(n)
          }}
          placeholder="Item code or scan…"
          label="Item"
          autoFocus
        />

        {q.isFetching ? <Loading /> : null}
        {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}

        {primary ? (
          <AppCard style={styles.card}>
            <Text style={styles.title}>{primary.code || primary.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>{String(primary.name || '—')}</Text>
            {items.length > 1 ? (
              <Text style={styles.meta}>
                Showing balances for first of {items.length} item matches. Refine the code if needed.
              </Text>
            ) : null}
          </AppCard>
        ) : null}

        {balances.map((row, idx) => (
          <AppCard key={String(row.id || `${row.itemId}-${row.warehouseId}-${idx}`)} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>
                {row.warehouse?.name || row.warehouseName || row.warehouse?.code || 'Warehouse'}
              </Text>
              <StatusChip label={qtyLabel(row, 'onHandQty')} compact />
            </View>
            <Text style={styles.meta}>
              On hand {qtyLabel(row, 'onHandQty')} · reserved {qtyLabel(row, 'reservedQty')} · free{' '}
              {qtyLabel(row, 'availableQty') !== '—'
                ? qtyLabel(row, 'availableQty')
                : qtyLabel(row, 'unrestrictedQty' as keyof StockBalanceRow)}
            </Text>
            <Text style={styles.meta}>
              {row.item?.code || row.itemCode || primary?.code || '—'} ·{' '}
              {row.item?.name || row.itemName || primary?.name || ''}
            </Text>
          </AppCard>
        ))}

        {debounced.length >= 1 && !q.isFetching && balances.length === 0 && !q.error ? (
          <EmptyState
            title={items.length === 0 ? 'Item not found' : 'No balances'}
            description={
              items.length === 0
                ? 'No master item matched that code.'
                : 'Item exists but has no stock balance rows yet.'
            }
            icon="search-outline"
          />
        ) : null}

        {debounced.length < 1 ? (
          <EmptyState
            title="Scan an item"
            description="Warehouse stock inquiry by item code or barcode."
            icon="barcode-outline"
          />
        ) : null}

        {/* Alternate: quick switch among multi-matches */}
        {items.length > 1
          ? items.slice(0, 8).map((it) => (
              <Pressable
                key={it.id}
                onPress={() => {
                  const code = it.code || it.id
                  setSearch(code)
                  setDebounced(code)
                }}
              >
                <Text style={styles.link}>
                  Also matched: {it.code || it.id.slice(0, 8)} — {String(it.name || '')}
                </Text>
              </Pressable>
            ))
          : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  hint: { ...typography.caption, marginBottom: spacing.md, color: colors.textSecondary },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
  link: { ...typography.caption, color: colors.primary, marginBottom: spacing.sm },
})
