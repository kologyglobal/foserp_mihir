import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
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
  createReturnIdempotencyKey,
  extractWorkOrderScan,
  materialLabel,
  materialName,
  netIssued,
  normalizeScan,
  returnWorkOrderMaterial,
  type WorkOrderMaterialLine,
  type WorkOrderSummary,
} from '@/features/store/api'
import { ScanField } from '@/features/store/ScanField'
import {
  useInvalidateStore,
  useMaterialIssueAccess,
  useWorkOrderMaterials,
  useWorkOrderSearch,
} from '@/features/store/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, radius, spacing, typography } from '@/theme'

type Stage = 'find-wo' | 'pick-line' | 'confirm'

function lineMatchesScan(line: WorkOrderMaterialLine, scan: string): boolean {
  if (!scan) return true
  const t = scan.toUpperCase()
  const code = materialLabel(line).toUpperCase()
  const name = materialName(line).toUpperCase()
  return code.includes(t) || name.includes(t) || line.itemId === scan
}

export default function MaterialReturnScreen() {
  const { canReturn, canLoadWo, canLoadMats, mfgOn } = useMaterialIssueAccess()
  const invalidate = useInvalidateStore()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [autoPickWo, setAutoPickWo] = useState(false)
  const [lineFilter, setLineFilter] = useState('')
  const [wo, setWo] = useState<WorkOrderSummary | null>(null)
  const [line, setLine] = useState<WorkOrderMaterialLine | null>(null)
  const [qty, setQty] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<Stage>('find-wo')
  const idempotencyRef = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const woQuery = useWorkOrderSearch(debounced, canLoadWo && stage === 'find-wo')
  const matsQuery = useWorkOrderMaterials(wo?.id ?? null, canLoadMats && Boolean(wo?.id))

  const returnable = (matsQuery.data ?? []).filter((m) => netIssued(m) > 0)
  const visibleLines = returnable.filter((m) => lineMatchesScan(m, normalizeScan(lineFilter)))
  const maxReturn = line ? netIssued(line) : 0
  const batchTracked = Boolean(line?.item?.batchTracked)

  const resetAttempt = () => {
    idempotencyRef.current = null
  }

  const selectWo = (row: WorkOrderSummary) => {
    setWo(row)
    setLine(null)
    setLineFilter('')
    setQty('')
    setBatchNumber('')
    resetAttempt()
    setAutoPickWo(false)
    setStage('pick-line')
  }

  useEffect(() => {
    if (!autoPickWo || stage !== 'find-wo' || woQuery.isFetching) return
    const rows = woQuery.data ?? []
    if (rows.length === 1) selectWo(rows[0]!)
    else setAutoPickWo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPickWo, stage, woQuery.isFetching, woQuery.data])

  const selectLine = (m: WorkOrderMaterialLine) => {
    setLine(m)
    const net = netIssued(m)
    setQty(net > 0 ? String(net) : '')
    setBatchNumber('')
    resetAttempt()
    setStage('confirm')
  }

  const onWoScan = (raw: string) => {
    const token = extractWorkOrderScan(raw)
    setSearch(token)
    setDebounced(token)
    setAutoPickWo(true)
  }

  const onLineScan = (raw: string) => {
    const token = normalizeScan(raw)
    setLineFilter(token)
    const match = returnable.filter((m) => lineMatchesScan(m, token))
    if (match.length === 1) selectLine(match[0]!)
  }

  const submit = async () => {
    if (!canReturn) {
      Alert.alert('Not authorised', 'You are not authorised to perform this action.')
      return
    }
    if (!wo?.id || !line?.id) {
      Alert.alert('Incomplete', 'Select a work order and material line.')
      return
    }
    const quantity = Number(qty)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Invalid quantity', 'Enter a positive quantity to return.')
      return
    }
    if (quantity > maxReturn) {
      Alert.alert('Too much', `Only ${maxReturn} net issued can be returned on this line.`)
      return
    }
    if (batchTracked && !batchNumber.trim()) {
      Alert.alert('Batch required', 'Enter a batch number for this item.')
      return
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = createReturnIdempotencyKey(wo.id, line.id)
    }

    setBusy(true)
    try {
      await returnWorkOrderMaterial(wo.id, {
        materialId: line.id,
        quantity,
        idempotencyKey: idempotencyRef.current,
        remarks: remarks.trim() || 'Mobile material return',
        batchNumber: batchTracked ? batchNumber.trim() : undefined,
      })
      invalidate()
      resetAttempt()
      Alert.alert('Returned', `${materialLabel(line)} · qty ${quantity}`, [
        {
          text: 'Return more',
          onPress: () => {
            setLine(null)
            setQty('')
            setBatchNumber('')
            setStage('pick-line')
            void matsQuery.refetch()
          },
        },
        {
          text: 'Done',
          style: 'cancel',
          onPress: () => {
            setWo(null)
            setLine(null)
            setSearch('')
            setStage('find-wo')
          },
        },
      ])
    } catch (e) {
      Alert.alert('Return failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!mfgOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Material return" showBack />
        <EmptyState
          title="Manufacturing not enabled"
          description="Your organisation does not have the manufacturing module turned on."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!canReturn && !canLoadMats) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Material return" showBack />
        <EmptyState
          title="No access"
          description="Requires manufacturing.materials.return (and work order / materials view)."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Material return"
        subtitle={
          stage === 'find-wo'
            ? 'Scan or find work order'
            : stage === 'pick-line'
              ? wo?.orderNumber || 'Select material'
              : materialLabel(line!)
        }
        showBack
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {stage === 'find-wo' ? (
          <>
            <Text style={styles.hint}>
              Return unused material to stock against a work order. Only lines with net issued
              quantity are shown. Use a scanner or type the WO number.
            </Text>
            <ScanField
              value={search}
              onChangeText={setSearch}
              onSubmitScan={onWoScan}
              placeholder="WO number or scan…"
              label="Work order"
              autoFocus
            />
            {woQuery.isFetching ? <Loading /> : null}
            {woQuery.error ? (
              <ErrorState error={woQuery.error} onRetry={() => void woQuery.refetch()} />
            ) : null}
            {(woQuery.data ?? []).map((row) => (
              <Pressable key={row.id} onPress={() => selectWo(row)}>
                <AppCard style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.title}>{row.orderNumber || row.id.slice(0, 8)}</Text>
                    <StatusChip label={String(row.status || '—')} compact />
                  </View>
                  <Text style={styles.meta}>{String(row.productName || row.itemName || '—')}</Text>
                </AppCard>
              </Pressable>
            ))}
            {debounced.length >= 1 && !woQuery.isFetching && (woQuery.data?.length ?? 0) === 0 ? (
              <EmptyState title="No work orders" description="Try another number." icon="search-outline" />
            ) : null}
            {debounced.length < 1 ? (
              <EmptyState
                title="Search a work order"
                description="Returns reverse issued quantities back to inventory."
                icon="return-down-back-outline"
              />
            ) : null}
          </>
        ) : null}

        {stage === 'pick-line' && wo ? (
          <>
            <AppCard style={styles.card}>
              <Text style={styles.title}>{wo.orderNumber || wo.id}</Text>
              <Text style={styles.meta}>{String(wo.status || '—')}</Text>
              <SecondaryButton
                title="Change work order"
                onPress={() => {
                  setWo(null)
                  setStage('find-wo')
                }}
                style={styles.mt}
              />
            </AppCard>
            <ScanField
              value={lineFilter}
              onChangeText={setLineFilter}
              onSubmitScan={onLineScan}
              placeholder="Scan item code…"
              label="Issued material"
            />
            {matsQuery.isLoading ? <Loading /> : null}
            {matsQuery.error ? (
              <ErrorState error={matsQuery.error} onRetry={() => void matsQuery.refetch()} />
            ) : null}
            {visibleLines.map((m) => {
              const net = netIssued(m)
              return (
                <Pressable key={m.id} onPress={() => selectLine(m)}>
                  <AppCard style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.title}>{materialLabel(m)}</Text>
                      <StatusChip label={`net ${net}`} compact />
                    </View>
                    <Text style={styles.meta}>{materialName(m)}</Text>
                    <Text style={styles.meta}>
                      issued {String(m.issuedQty ?? '0')} · returned {String(m.returnedQty ?? '0')}
                    </Text>
                  </AppCard>
                </Pressable>
              )
            })}
            {!matsQuery.isLoading && returnable.length === 0 ? (
              <EmptyState
                title="Nothing to return"
                description="No material lines have net issued quantity on this work order."
                icon="checkmark-circle-outline"
              />
            ) : null}
            {!matsQuery.isLoading && returnable.length > 0 && visibleLines.length === 0 ? (
              <EmptyState
                title="No matching lines"
                description="Clear the filter or scan another item code."
                icon="barcode-outline"
              />
            ) : null}
          </>
        ) : null}

        {stage === 'confirm' && wo && line ? (
          <>
            <AppCard style={styles.card}>
              <Text style={styles.title}>{materialLabel(line)}</Text>
              <Text style={styles.meta}>{materialName(line)}</Text>
              <Text style={styles.meta}>
                WO {wo.orderNumber} · max return {maxReturn}
              </Text>
              <SecondaryButton
                title="Back to lines"
                onPress={() => {
                  setLine(null)
                  resetAttempt()
                  setStage('pick-line')
                }}
                style={styles.mt}
              />
            </AppCard>

            <Text style={styles.label}>Quantity to return</Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={(t) => {
                setQty(t)
                resetAttempt()
              }}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
            />

            {batchTracked ? (
              <>
                <Text style={styles.label}>Batch number</Text>
                <ScanField
                  value={batchNumber}
                  onChangeText={(t) => {
                    setBatchNumber(t)
                    resetAttempt()
                  }}
                  placeholder="Scan or type batch"
                />
              </>
            ) : null}

            <Text style={styles.label}>Remarks</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={remarks}
              onChangeText={setRemarks}
              multiline
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />

            {!canReturn ? (
              <Text style={styles.warn}>You can view materials but cannot post returns.</Text>
            ) : (
              <PrimaryButton
                title={busy ? 'Posting…' : 'Post return'}
                onPress={() => void submit()}
                disabled={busy}
                style={styles.mt}
              />
            )}
            <Text style={styles.foot}>
              Idempotency key is kept for retries of this attempt only.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  hint: { ...typography.caption, marginBottom: spacing.md, color: colors.textSecondary },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multi: { minHeight: 72, textAlignVertical: 'top' },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs },
  mt: { marginTop: spacing.md },
  warn: { ...typography.caption, color: colors.warning, marginTop: spacing.sm },
  foot: { ...typography.micro, color: colors.textMuted, marginTop: spacing.md },
})
