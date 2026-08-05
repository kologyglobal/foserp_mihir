import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
import {
  useInvalidateStore,
  useTransferAccess,
  useTransfersList,
} from '@/features/store/hooks'
import { colors, layout, spacing, typography } from '@/theme'

export default function StockTransferListScreen() {
  const { invOn, canView, canCreate } = useTransferAccess()
  const listQ = useTransfersList(canView)
  const invalidate = useInvalidateStore()
  const [filter, setFilter] = useState<'all' | 'open' | 'receive'>('all')

  const rows = (listQ.data ?? []).filter((doc) => {
    const st = String(doc.status || '')
    if (filter === 'receive') return ['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(st)
    if (filter === 'open') {
      return !['RECEIVED', 'CANCELLED', 'REVERSED'].includes(st)
    }
    return true
  })

  if (!invOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock transfer" showBack />
        <EmptyState
          title="Inventory not enabled"
          description="Your organisation does not have the inventory module turned on."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!canView && !canCreate) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock transfer" showBack />
        <EmptyState
          title="No access"
          description="Requires inventory.transfers.view / create (or inventory.view)."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Stock transfer" subtitle="Warehouse to warehouse" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Create a transfer, advance to dispatch when permitted, or receive in-transit stock. Use
          the camera button or a keyboard-wedge scanner on the new form.
        </Text>

        {canCreate ? (
          <PrimaryButton
            title="New transfer"
            onPress={() => router.push('/(app)/store/transfer/new' as never)}
            style={styles.mb}
          />
        ) : null}

        <View style={styles.filters}>
          {([
            ['all', 'All'],
            ['open', 'Open'],
            ['receive', 'To receive'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              style={[styles.chip, filter === id && styles.chipOn]}
            >
              <Text style={[styles.chipText, filter === id && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {listQ.isLoading ? <Loading /> : null}
        {listQ.error ? (
          <ErrorState
            error={listQ.error}
            onRetry={() => {
              invalidate()
              void listQ.refetch()
            }}
          />
        ) : null}

        {rows.map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => router.push(`/(app)/store/transfer/${doc.id}` as never)}
          >
            <AppCard style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{doc.transferNumber || doc.id.slice(0, 8)}</Text>
                <StatusChip label={String(doc.status || '—')} compact />
              </View>
              <Text style={styles.meta}>
                {doc.fromWarehouse?.name || doc.fromWarehouse?.code || '—'}
                {' → '}
                {doc.toWarehouse?.name || doc.toWarehouse?.code || '—'}
              </Text>
              <Text style={styles.meta}>
                {(doc.lines?.length ?? 0) > 0
                  ? `${doc.lines!.length} line(s)`
                  : '—'}
              </Text>
            </AppCard>
          </Pressable>
        ))}

        {!listQ.isLoading && rows.length === 0 ? (
          <EmptyState
            title={filter === 'receive' ? 'Nothing to receive' : 'No transfers'}
            description={
              canCreate
                ? 'Create a warehouse transfer and ship when ready.'
                : 'No documents match this filter.'
            }
            icon="swap-horizontal-outline"
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
  mb: { marginBottom: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted ?? colors.surface },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
})
