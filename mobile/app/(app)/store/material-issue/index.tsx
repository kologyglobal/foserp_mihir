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
  createIssueIdempotencyKey,
  extractWorkOrderScan,
  issueWorkOrderMaterial,
  materialLabel,
  materialName,
  normalizeScan,
  remainingToIssue,
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
import { can } from '@/auth/permissions'
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

export default function MaterialIssueScreen() {
  const { canIssue, canLoadWo, canLoadMats, mfgOn, perms } = useMaterialIssueAccess()
  const invalidate = useInvalidateStore()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [autoPickWo, setAutoPickWo] = useState(false)
  const [lineFilter, setLineFilter] = useState('')
  const [wo, setWo] = useState<WorkOrderSummary | null>(null)
  const [line, setLine] = useState<WorkOrderMaterialLine | null>(null)
  const [qty, setQty] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [additional, setAdditional] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<Stage>('find-wo')
  /** Preserve across network retries of the same submit attempt. */
  const idempotencyRef = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const woQuery = useWorkOrderSearch(debounced, canLoadWo && stage === 'find-wo')
  const matsQuery = useWorkOrderMaterials(wo?.id ?? null, canLoadMats && Boolean(wo?.id))

  const canAdditional = can('manufacturing.material.additional_issue', perms ?? [])
  const remaining = line ? remainingToIssue(line) : 0
  const batchTracked = Boolean(line?.item?.batchTracked)
  const serialTracked = Boolean(line?.item?.serialTracked)

  const visibleLines = (matsQuery.data ?? []).filter((m) =>
    lineMatchesScan(m, normalizeScan(lineFilter)),
  )

  const resetAttempt = () => {
    idempotencyRef.current = null
  }

  const selectWo = (row: WorkOrderSummary) => {
    setWo(row)
    setLine(null)
    setLineFilter('')
    setQty('')
    setBatchNumber('')
    setSerialNumber('')
    resetAttempt()
    setAutoPickWo(false)
    setStage('pick-line')
  }

  useEffect(() => {
    if (!autoPickWo || stage !== 'find-wo' || woQuery.isFetching) return
    const rows = woQuery.data ?? []
    if (rows.length === 1) {
      selectWo(rows[0]!)
    } else {
      setAutoPickWo(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when search results settle
  }, [autoPickWo, stage, woQuery.isFetching, woQuery.data])

  const selectLine = (m: WorkOrderMaterialLine) => {
    setLine(m)
    const rem = remainingToIssue(m)
    setQty(rem > 0 ? String(rem) : '1')
    setBatchNumber('')
    setSerialNumber('')
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
    const match = (matsQuery.data ?? []).filter((m) => lineMatchesScan(m, token))
    if (match.length === 1) selectLine(match[0]!)
  }

  const submit = async () => {
    if (!canIssue) {
      Alert.alert('Not authorised', 'You are not authorised to perform this action.')
      return
    }
    if (!wo?.id || !line?.id) {
      Alert.alert('Incomplete', 'Select a work order and material line.')
      return
    }
    const quantity = Number(qty)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Invalid quantity', 'Enter a positive quantity to issue.')
      return
    }
    if (serialTracked && quantity !== 1) {
      Alert.alert('Serial item', 'Serial-tracked items must be issued one unit at a time.')
      return
    }
    if (batchTracked && !batchNumber.trim()) {
      Alert.alert('Batch required', 'Enter a batch number for this item.')
      return
    }
    if (serialTracked && !serialNumber.trim()) {
      Alert.alert('Serial required', 'Enter a serial number for this item.')
      return
    }
    if (quantity > remaining && !canAdditional && !additional) {
      Alert.alert(
        'Over requirement',
        `Remaining to issue is ${remaining}. Turn on Additional issue or reduce quantity.`,
      )
      return
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = createIssueIdempotencyKey(wo.id, line.id)
    }

    setBusy(true)
    try {
      await issueWorkOrderMaterial(wo.id, {
        materialId: line.id,
        quantity,
        idempotencyKey: idempotencyRef.current,
        remarks: remarks.trim() || 'Mobile material issue',
        warehouseId: line.warehouseId || undefined,
        additional: quantity > remaining ? true : undefined,
        batchNumber: batchTracked ? batchNumber.trim() : undefined,
        serialNumber: serialTracked ? serialNumber.trim() : undefined,
      })
      invalidate()
      resetAttempt()
      Alert.alert('Issued', `${materialLabel(line)} · qty ${quantity}`, [
        {
          text: 'Issue more',
          onPress: () => {
            setLine(null)
            setQty('')
            setBatchNumber('')
            setSerialNumber('')
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
      Alert.alert('Issue failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!mfgOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Material issue" showBack />
        <EmptyState
          title="Manufacturing not enabled"
          description="Your organisation does not have the manufacturing module turned on."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!canIssue && !canLoadMats) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Material issue" showBack />
        <EmptyState
          title="No access"
          description="Requires manufacturing.materials.issue (and work order / materials view to find work orders)."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Material issue"
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
              Scan a WO barcode/QR with the camera button, a wedge scanner (Enter), or type the
              work order number. Issues use an idempotency key so double taps do not double-post.
            </Text>
            <ScanField
              value={search}
              onChangeText={setSearch}
              onSubmitScan={onWoScan}
              placeholder="WO number or scan…"
              label="Work order"
              autoFocus
            />
            {!canLoadWo ? (
              <Text style={styles.meta}>
                Need manufacturing.work_orders.view (or materials issue) to search.
              </Text>
            ) : null}
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
                  <Text style={styles.meta}>
                    {String(row.productName || row.itemName || '—')}
                  </Text>
                </AppCard>
              </Pressable>
            ))}
            {debounced.length >= 1 && !woQuery.isFetching && (woQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No work orders"
                description="Try another number or confirm the WO is released."
                icon="search-outline"
              />
            ) : null}
            {debounced.length < 1 ? (
              <EmptyState
                title="Search a work order"
                description="Warehouse issues materials against released / open work orders."
                icon="cube-outline"
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
              placeholder="Scan item code to filter…"
              label="Material line"
            />
            {matsQuery.isLoading ? <Loading /> : null}
            {matsQuery.error ? (
              <ErrorState error={matsQuery.error} onRetry={() => void matsQuery.refetch()} />
            ) : null}
            {visibleLines.map((m) => {
              const rem = remainingToIssue(m)
              return (
                <Pressable key={m.id} onPress={() => selectLine(m)}>
                  <AppCard style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.title}>{materialLabel(m)}</Text>
                      <StatusChip label={m.status || '—'} compact />
                    </View>
                    <Text style={styles.meta}>{materialName(m)}</Text>
                    <Text style={styles.meta}>
                      Req {String(m.requiredQty ?? '—')} · issued {String(m.issuedQty ?? '0')} · remain{' '}
                      {rem}
                      {m.warehouse?.name ? ` · ${m.warehouse.name}` : ''}
                    </Text>
                    {m.hasShortage || Number(m.shortageQty) > 0 ? (
                      <Text style={styles.warn}>Shortage on requirement</Text>
                    ) : null}
                  </AppCard>
                </Pressable>
              )
            })}
            {!matsQuery.isLoading && (matsQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No material lines"
                description="Sync requirements on the work order from desktop if the BOM is missing."
                icon="list-outline"
              />
            ) : null}
            {!matsQuery.isLoading &&
            (matsQuery.data?.length ?? 0) > 0 &&
            visibleLines.length === 0 ? (
              <EmptyState
                title="No matching lines"
                description="Clear the scan filter or try another item code."
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
                WO {wo.orderNumber} · warehouse {line.warehouse?.name || line.warehouseId || '—'}
              </Text>
              <Text style={styles.meta}>
                Required {String(line.requiredQty ?? '—')} · issued {String(line.issuedQty ?? '0')} ·
                remaining {remaining}
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

            <Text style={styles.label}>Quantity to issue</Text>
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

            {serialTracked ? (
              <>
                <Text style={styles.label}>Serial number</Text>
                <ScanField
                  value={serialNumber}
                  onChangeText={(t) => {
                    setSerialNumber(t)
                    resetAttempt()
                  }}
                  placeholder="Scan or type serial"
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

            {(canAdditional || Number(qty) > remaining) && remaining >= 0 ? (
              <Pressable
                onPress={() => {
                  setAdditional((v) => !v)
                  resetAttempt()
                }}
                style={styles.checkRow}
              >
                <View style={[styles.check, additional && styles.checkOn]} />
                <Text style={styles.checkLabel}>
                  Additional issue (beyond remaining requirement)
                </Text>
              </Pressable>
            ) : null}

            {!canIssue ? (
              <Text style={styles.warn}>You can view materials but cannot post issues.</Text>
            ) : (
              <PrimaryButton
                title={busy ? 'Posting…' : 'Post issue'}
                onPress={() => void submit()}
                disabled={busy}
                style={styles.mt}
              />
            )}
            <Text style={styles.foot}>
              Idempotency key is kept for retries of this attempt only. Changing quantity or line
              starts a new attempt.
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { ...typography.caption, flex: 1 },
})
