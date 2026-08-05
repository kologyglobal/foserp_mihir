import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  PrimaryButton,
  SecondaryButton,
  StatusChip,
} from '@/components'
import {
  enterStockCounts,
  normalizeScan,
  snapshotStockCount,
  submitStockCount,
  type StockCountLine,
} from '@/features/store/api'
import { ScanField } from '@/features/store/ScanField'
import {
  useInvalidateStore,
  useStockAccess,
  useStockCountDetail,
} from '@/features/store/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function StockCountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const countId = Array.isArray(id) ? id[0] : id
  const { canCounts, canCount, canCreate, canSubmit } = useStockAccess()
  const invalidate = useInvalidateStore()
  const detailQ = useStockCountDetail(countId ?? '', canCounts && Boolean(countId))
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)

  const doc = detailQ.data
  const status = String(doc?.status || '')
  const canEnter = ['SNAPSHOTTED', 'COUNTING'].includes(status) && canCount
  const canSnap = status === 'DRAFT' && canCreate
  const canSub = status === 'COUNTING' && canSubmit

  useEffect(() => {
    if (!doc?.lines) return
    const next: Record<string, string> = {}
    for (const line of doc.lines) {
      next[line.id] =
        line.countedQty != null && String(line.countedQty) !== ''
          ? String(line.countedQty)
          : ''
    }
    setQtyMap(next)
  }, [doc?.id, doc?.status, doc?.lines])

  const lines = useMemo(() => {
    const all = doc?.lines ?? []
    const f = normalizeScan(filter).toUpperCase()
    if (!f) return all
    return all.filter((line: StockCountLine) => {
      const code = (line.item?.code || '').toUpperCase()
      const name = (line.item?.name || '').toUpperCase()
      return code.includes(f) || name.includes(f)
    })
  }, [doc?.lines, filter])

  const onSaveCounts = async () => {
    if (!countId || !doc?.lines?.length) return
    const payload = doc.lines
      .map((line) => {
        const raw = qtyMap[line.id]
        if (raw == null || String(raw).trim() === '') return null
        const countedQty = Number(raw)
        if (!Number.isFinite(countedQty) || countedQty < 0) return null
        return { lineId: line.id, countedQty }
      })
      .filter(Boolean) as Array<{ lineId: string; countedQty: number }>

    if (payload.length === 0) {
      Alert.alert('Nothing to save', 'Enter at least one counted quantity.')
      return
    }

    setBusy(true)
    try {
      await enterStockCounts(countId, payload)
      invalidate()
      await detailQ.refetch()
      Alert.alert('Saved', `${payload.length} line(s) recorded.`)
    } catch (e) {
      Alert.alert('Save failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onSnapshot = async () => {
    if (!countId) return
    setBusy(true)
    try {
      await snapshotStockCount(countId)
      invalidate()
      await detailQ.refetch()
      Alert.alert('Snapshot captured', 'You can now enter counted quantities.')
    } catch (e) {
      Alert.alert('Snapshot failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = async () => {
    if (!countId) return
    setBusy(true)
    try {
      await submitStockCount(countId)
      invalidate()
      await detailQ.refetch()
      Alert.alert('Submitted', 'Stock count submitted for review.')
    } catch (e) {
      Alert.alert('Submit failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!countId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Stock count" showBack />
        <EmptyState title="Missing id" description="Open a count from the list." icon="alert-outline" />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={doc?.countNumber || 'Stock count'}
        subtitle={doc?.warehouse?.name || status || 'Detail'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {detailQ.isLoading ? <Loading /> : null}
        {detailQ.error ? (
          <ErrorState error={detailQ.error} onRetry={() => void detailQ.refetch()} />
        ) : null}

        {doc ? (
          <>
            <AppCard style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{doc.countNumber || doc.id.slice(0, 8)}</Text>
                <StatusChip label={status} compact />
              </View>
              <Text style={styles.meta}>
                {doc.warehouse?.name || doc.warehouse?.code || '—'}
                {doc.remarks ? ` · ${doc.remarks}` : ''}
              </Text>
            </AppCard>

            {canSnap ? (
              <PrimaryButton
                title={busy ? 'Working…' : 'Capture snapshot'}
                onPress={() => void onSnapshot()}
                disabled={busy}
                style={styles.mb}
              />
            ) : null}

            {canEnter ? (
              <>
                <ScanField
                  value={filter}
                  onChangeText={setFilter}
                  onSubmitScan={(n) => setFilter(n)}
                  placeholder="Filter / scan item code"
                  label="Lines"
                />
                {lines.map((line) => (
                  <AppCard key={line.id} style={styles.card}>
                    <Text style={styles.title}>
                      {line.item?.code || line.itemId?.slice(0, 8) || 'Item'}
                    </Text>
                    <Text style={styles.meta}>{line.item?.name || '—'}</Text>
                    {line.systemQty != null ? (
                      <Text style={styles.meta}>System qty {String(line.systemQty)}</Text>
                    ) : (
                      <Text style={styles.meta}>System qty hidden (no reveal permission)</Text>
                    )}
                    <Text style={styles.label}>Counted qty</Text>
                    <TextInput
                      style={styles.input}
                      value={qtyMap[line.id] ?? ''}
                      onChangeText={(t) => setQtyMap((m) => ({ ...m, [line.id]: t }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      editable={!busy}
                    />
                  </AppCard>
                ))}
                {lines.length === 0 ? (
                  <EmptyState
                    title="No lines"
                    description={
                      filter
                        ? 'No lines match the filter.'
                        : 'Snapshot first if this count has no lines yet.'
                    }
                    icon="list-outline"
                  />
                ) : null}
                <PrimaryButton
                  title={busy ? 'Saving…' : 'Save counts'}
                  onPress={() => void onSaveCounts()}
                  disabled={busy}
                  style={styles.mb}
                />
              </>
            ) : null}

            {canSub ? (
              <SecondaryButton
                title={busy ? '…' : 'Submit for review'}
                onPress={() => void onSubmit()}
                disabled={busy}
                style={styles.mb}
              />
            ) : null}

            {!canSnap && !canEnter && !canSub ? (
              <Text style={styles.meta}>
                This document is {status}. Further steps may require desktop review / post.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  mb: { marginBottom: spacing.md },
})
