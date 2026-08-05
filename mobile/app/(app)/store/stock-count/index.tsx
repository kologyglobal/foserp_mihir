import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  PrimaryButton,
  StatusChip,
} from '@/components'
import { createStockCount } from '@/features/store/api'
import {
  useInvalidateStore,
  useStockAccess,
  useStockCountsList,
  useWarehouses,
} from '@/features/store/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, spacing, typography } from '@/theme'

export default function StockCountListScreen() {
  const { canCounts, canCreate, invOn } = useStockAccess()
  const invalidate = useInvalidateStore()
  const listQ = useStockCountsList(canCounts)
  const whQ = useWarehouses(canCreate)
  const [creating, setCreating] = useState(false)
  const [pickWh, setPickWh] = useState(false)

  const createFor = async (warehouseId: string) => {
    if (!canCreate) {
      Alert.alert('Not authorised', 'You cannot create stock counts.')
      return
    }
    setCreating(true)
    try {
      const doc = await createStockCount({ warehouseId, remarks: 'Mobile stock count' })
      invalidate()
      setPickWh(false)
      router.push(`/(app)/store/stock-count/${doc.id}` as never)
    } catch (e) {
      Alert.alert('Create failed', getUserFriendlyMessage(e))
    } finally {
      setCreating(false)
    }
  }

  if (!invOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock count" showBack />
        <EmptyState
          title="Inventory not enabled"
          description="Your organisation does not have the inventory module turned on."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!canCounts) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock count" showBack />
        <EmptyState
          title="No access"
          description="Requires inventory.stock_count.view or inventory.view."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Stock count" subtitle="Physical inventory" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Open a count to enter quantities after snapshot. Create opens a draft for a warehouse.
        </Text>

        {canCreate ? (
          <PrimaryButton
            title={pickWh ? 'Cancel create' : creating ? 'Creating…' : 'New count'}
            onPress={() => setPickWh((v) => !v)}
            disabled={creating}
            style={styles.mb}
          />
        ) : null}

        {pickWh ? (
          <>
            <Text style={styles.label}>Select warehouse</Text>
            {whQ.isLoading ? <Loading /> : null}
            {whQ.error ? (
              <ErrorState error={whQ.error} onRetry={() => void whQ.refetch()} />
            ) : null}
            {(whQ.data ?? []).map((w) => (
              <Pressable key={w.id} onPress={() => void createFor(w.id)} disabled={creating}>
                <AppCard style={styles.card}>
                  <Text style={styles.title}>{w.name || w.code || w.id.slice(0, 8)}</Text>
                  <Text style={styles.meta}>{w.code || w.id}</Text>
                </AppCard>
              </Pressable>
            ))}
            {!whQ.isLoading && (whQ.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No warehouses"
                description="Create warehouses in masters before counting stock."
                icon="business-outline"
              />
            ) : null}
          </>
        ) : null}

        {listQ.isLoading ? <Loading /> : null}
        {listQ.error ? (
          <ErrorState error={listQ.error} onRetry={() => void listQ.refetch()} />
        ) : null}

        {(listQ.data ?? []).map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => router.push(`/(app)/store/stock-count/${doc.id}` as never)}
          >
            <AppCard style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{doc.countNumber || doc.id.slice(0, 8)}</Text>
                <StatusChip label={String(doc.status || '—')} compact />
              </View>
              <Text style={styles.meta}>
                {doc.warehouse?.name || doc.warehouse?.code || '—'}
                {doc.countDate ? ` · ${String(doc.countDate).slice(0, 10)}` : ''}
              </Text>
            </AppCard>
          </Pressable>
        ))}

        {!listQ.isLoading && (listQ.data?.length ?? 0) === 0 && !pickWh ? (
          <EmptyState
            title="No stock counts"
            description={
              canCreate
                ? 'Create a new count for a warehouse, then snapshot and enter qty.'
                : 'No documents yet.'
            }
            icon="clipboard-outline"
          />
        ) : null}
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
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.sm },
  mb: { marginBottom: spacing.md },
})
