import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
import { ScanField } from '@/features/store/ScanField'
import {
  createGoodsReceipt,
  findPurchaseOrderByNumber,
  getPurchaseOrder,
  isPoReceivable,
  listReceivableLines,
  poPendingQuantity,
  purchaseFriendlyError,
  submitGoodsReceipt,
  validateReceiveLines,
  type CreateGrnInput,
  type PurchaseOrderLine,
  type PurchaseOrderSummary,
} from '@/features/purchase/api'
import {
  enqueueOfflineGrn,
  flushOfflineGrnQueue,
  isNetworkOnline,
  readOfflineGrnQueue,
} from '@/features/purchase/offlineGrnQueue'
import {
  useGrnAccess,
  useInvalidatePurchase,
  usePurchaseOrderDetail,
} from '@/features/purchase/hooks'
import { formatDate, formatMoney, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'

type Stage = 'select' | 'lines' | 'review'

export default function GrnReceiveScreen() {
  const { poId: poIdParam } = useLocalSearchParams<{ poId?: string }>()
  const router = useRouter()
  const { moduleOn, canCreate } = useGrnAccess()
  const invalidate = useInvalidatePurchase()

  const initialPoId = String(poIdParam || '')
  const preload = usePurchaseOrderDetail(initialPoId, Boolean(initialPoId) && canCreate)

  const [stage, setStage] = useState<Stage>(initialPoId ? 'lines' : 'select')
  const [scan, setScan] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [po, setPo] = useState<PurchaseOrderSummary | null>(null)
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({})
  const [batchByLine, setBatchByLine] = useState<Record<string, string>>({})
  const [lineFilter, setLineFilter] = useState('')
  const [challan, setChallan] = useState('')
  const [challanDate, setChallanDate] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [transporter, setTransporter] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [offlinePending, setOfflinePending] = useState(0)

  useEffect(() => {
    void readOfflineGrnQueue().then((q) => setOfflinePending(q.length))
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const online = await isNetworkOnline()
      if (!online || cancelled) return
      const result = await flushOfflineGrnQueue()
      if (cancelled) return
      if (result.posted > 0) {
        invalidate()
        Alert.alert(
          'Offline queue',
          `Posted ${result.posted} queued GRN(s)${result.failed ? ` · ${result.failed} still pending` : ''}.`,
        )
      }
      const left = await readOfflineGrnQueue()
      if (!cancelled) setOfflinePending(left.length)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const seedZeroQty = (order: PurchaseOrderSummary) => {
    const next: Record<string, string> = {}
    for (const line of order.lines ?? []) {
      next[line.id] = '0'
    }
    setQtyByLine(next)
  }

  /** Merge open qty from dedicated receivable-lines endpoint when available. */
  const applyReceivableOpenQty = async (order: PurchaseOrderSummary) => {
    try {
      const recv = await listReceivableLines(order.id)
      if (!recv.length) return order
      const byId = new Map(recv.map((r) => [r.purchaseOrderLineId, r]))
      const lines = (order.lines ?? []).map((line) => {
        const r = byId.get(line.id)
        if (!r) return line
        return {
          ...line,
          openQuantity: Number(r.openQuantity ?? line.openQuantity ?? 0),
          receivedQuantity: Number(
            r.previouslyReceivedQuantity ?? line.receivedQuantity ?? 0,
          ),
          quantity: Number(r.orderedQuantity ?? line.quantity ?? line.uomQuantity ?? 0),
          itemCode: r.itemCode || line.itemCode,
          itemName: r.itemName || line.itemName,
        } as PurchaseOrderLine
      })
      return { ...order, lines }
    } catch {
      return order
    }
  }

  useEffect(() => {
    if (!preload.data) return
    let cancelled = false
    void (async () => {
      const merged = await applyReceivableOpenQty(preload.data!)
      if (cancelled) return
      setPo(merged)
      seedZeroQty(merged)
      setStage('lines')
    })()
    return () => {
      cancelled = true
    }
  }, [preload.data?.id])

  const receivableLines = useMemo(
    () =>
      (po?.lines ?? []).filter((l) => {
        const open = Number(l.openQuantity ?? 0)
        if (open > 0) return true
        const ordered = Number(l.quantity ?? l.uomQuantity ?? 0)
        const received = Number(l.receivedQuantity ?? 0)
        return ordered > received
      }),
    [po?.lines],
  )

  const visibleLines = useMemo(() => {
    const f = lineFilter.trim().toUpperCase()
    if (!f) return receivableLines
    return receivableLines.filter(
      (l) =>
        String(l.itemCode || '')
          .toUpperCase()
          .includes(f) ||
        String(l.itemName || '')
          .toUpperCase()
          .includes(f),
    )
  }, [receivableLines, lineFilter])

  const loadPo = async (token: string) => {
    setSearchBusy(true)
    try {
      const found = await findPurchaseOrderByNumber(token)
      if (!found) {
        Alert.alert('Not found', 'This Purchase document could not be found.')
        return
      }
      const fullRaw = await getPurchaseOrder(found.id)
      const full = await applyReceivableOpenQty(fullRaw)
      if (!isPoReceivable(full)) {
        Alert.alert(
          'Not receivable',
          `PO ${full.orderNumber || ''} is ${titleCaseLabel(full.status)} with pending ${poPendingQuantity(full)}.`,
        )
        setPo(full)
        seedZeroQty(full)
        setStage('lines')
        return
      }
      setPo(full)
      seedZeroQty(full)
      setStage('lines')
    } catch (e) {
      Alert.alert('Lookup failed', purchaseFriendlyError(e, 'Could not load purchase order'))
    } finally {
      setSearchBusy(false)
    }
  }

  const onItemScan = (code: string) => {
    setLineFilter(code)
    const match = receivableLines.filter(
      (l) =>
        String(l.itemCode || '').toUpperCase() === code.toUpperCase() ||
        String(l.itemCode || '')
          .toUpperCase()
          .includes(code.toUpperCase()),
    )
    if (match.length === 1) {
      // focus qty is already default 0 — user must enter
      setLineFilter(match[0]!.itemCode || code)
    }
  }

  const goReview = () => {
    if (!po) return
    const err = validateReceiveLines(po, qtyByLine)
    if (err) {
      Alert.alert('Check quantities', err)
      return
    }
    if (!po.deliveryWarehouseId) {
      Alert.alert('Warehouse required', 'This PO has no delivery warehouse. Set warehouse on desktop before receiving.')
      return
    }
    setStage('review')
  }

  const submitCreate = async (alsoSubmit: boolean) => {
    if (!po || !canCreate) {
      Alert.alert('Not authorised', 'You are not authorised to perform this Purchase action.')
      return
    }
    const err = validateReceiveLines(po, qtyByLine)
    if (err) {
      Alert.alert('Check quantities', err)
      return
    }
    if (!po.deliveryWarehouseId) {
      Alert.alert('Warehouse required', 'Delivery warehouse is required on the PO.')
      return
    }

    const lines = (po.lines ?? [])
      .map((line) => {
        const q = Number(qtyByLine[line.id] ?? 0)
        if (!Number.isFinite(q) || q <= 0) return null
        return {
          purchaseOrderLineId: line.id,
          receivedUomQuantity: q,
          warehouseId: po.deliveryWarehouseId!,
          batchNumber: batchByLine[line.id]?.trim() || null,
          remarks: null,
        }
      })
      .filter(Boolean) as Array<{
      purchaseOrderLineId: string
      receivedUomQuantity: number
      warehouseId: string
      batchNumber: string | null
      remarks: null
    }>

    // Backend requires every line in schema min 1 - only positive lines is OK min 1
    if (lines.length === 0) {
      Alert.alert('Nothing to receive', 'Enter a positive receipt quantity on at least one line')
      return
    }

    setBusy(true)
    const payload: CreateGrnInput = {
      purchaseOrderId: po.id,
      receiptDate: new Date().toISOString().slice(0, 10),
      warehouseId: po.deliveryWarehouseId,
      vendorChallanNumber: challan.trim() || null,
      vendorChallanDate: challanDate.trim() || null,
      vehicleNumber: vehicle.trim() || null,
      transporterName: transporter.trim() || null,
      remarks: remarks.trim() || 'Mobile goods receipt',
      lines,
    }
    try {
      const online = await isNetworkOnline()
      if (!online) {
        const job = await enqueueOfflineGrn({
          payload,
          alsoSubmit,
          label: po.orderNumber || po.id.slice(0, 8),
        })
        setOfflinePending((n) => n + 1)
        Alert.alert(
          'Saved offline',
          `GRN queued (${job.localId}). It will post automatically when you are online.`,
        )
        return
      }
      const created = await createGoodsReceipt(payload)
      let finalDoc = created
      if (alsoSubmit && created.id) {
        try {
          finalDoc = await submitGoodsReceipt(created.id, 'Submitted from mobile receive')
        } catch (subErr) {
          invalidate()
          Alert.alert(
            'GRN saved as draft',
            `${created.grnNumber || created.id}\nSubmit failed: ${purchaseFriendlyError(subErr, 'error')}`,
            [
              {
                text: 'Open draft',
                onPress: () => router.replace(`/(app)/purchase/grn/${created.id}` as never),
              },
            ],
          )
          return
        }
      }
      invalidate()
      Alert.alert(
        'GRN created',
        `${finalDoc.grnNumber || finalDoc.id}\nStatus: ${titleCaseLabel(finalDoc.status)}`,
        [
          {
            text: 'Open GRN',
            onPress: () => router.replace(`/(app)/purchase/grn/${finalDoc.id}` as never),
          },
        ],
      )
    } catch (e) {
      // Network-ish failures → queue for later
      const msg = purchaseFriendlyError(e, 'Could not create GRN')
      const looksOffline =
        /network|timeout|offline|fetch failed|ECONN|ENOTFOUND/i.test(msg) ||
        (e instanceof Error && /network/i.test(e.message))
      if (looksOffline) {
        try {
          await enqueueOfflineGrn({
            payload,
            alsoSubmit,
            label: po.orderNumber || po.id.slice(0, 8),
          })
          setOfflinePending((n) => n + 1)
          Alert.alert('Saved offline', `${msg}\n\nGRN queued for when connection returns.`)
          return
        } catch {
          // fall through
        }
      }
      Alert.alert('Receive failed', msg)
    } finally {
      setBusy(false)
    }
  }

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Receive goods" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!canCreate) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Receive goods" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="Requires purchase.grn.create."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (initialPoId && preload.isLoading && !po) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Receive goods" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (initialPoId && preload.error && !po) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Receive goods" onBack={() => router.back()} />
        <ErrorState
          error={preload.error}
          onRetry={() => void preload.refetch()}
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Receive goods"
        subtitle={
          stage === 'select'
            ? 'Select purchase order'
            : stage === 'lines'
              ? po?.orderNumber || 'Enter quantities'
              : 'Review receipt'
        }
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {offlinePending > 0 ? (
          <Text style={styles.offlineBanner}>
            {offlinePending} GRN(s) waiting offline — will sync when online. Open this screen again to flush.
          </Text>
        ) : null}
        {stage === 'select' ? (
          <>
            <Text style={styles.hint}>
              Scan or type a PO number. Only POs in Sent to vendor / Partially received can receive.
            </Text>
            <ScanField
              value={scan}
              onChangeText={setScan}
              onSubmitScan={(n) => void loadPo(n)}
              label="Purchase order"
              placeholder="PO number or scan…"
              autoFocus
            />
            {searchBusy ? <Loading /> : null}
            <PrimaryButton
              title="Find PO"
              onPress={() => void loadPo(scan)}
              disabled={searchBusy || !scan.trim()}
              style={styles.mt}
            />
          </>
        ) : null}

        {stage === 'lines' && po ? (
          <>
            <AppCard style={styles.card}>
              <Text style={styles.title}>{po.orderNumber}</Text>
              <Text style={styles.meta}>{po.vendorName}</Text>
              <Text style={styles.meta}>
                Status {titleCaseLabel(po.status)} · warehouse{' '}
                {po.deliveryWarehouseName || po.deliveryWarehouseCode || '—'}
              </Text>
              <SecondaryButton
                title="Change PO"
                onPress={() => {
                  setPo(null)
                  setStage('select')
                }}
                style={styles.mt}
              />
            </AppCard>

            <ScanField
              value={lineFilter}
              onChangeText={setLineFilter}
              onSubmitScan={onItemScan}
              label="Filter item"
              placeholder="Scan item code…"
            />

            <Text style={styles.label}>Supplier challan</Text>
            <TextInput
              style={styles.input}
              value={challan}
              onChangeText={setChallan}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Challan date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={challanDate}
              onChangeText={setChallanDate}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Vehicle</Text>
            <TextInput
              style={styles.input}
              value={vehicle}
              onChangeText={setVehicle}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Transporter</Text>
            <TextInput
              style={styles.input}
              value={transporter}
              onChangeText={setTransporter}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Remarks</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={remarks}
              onChangeText={setRemarks}
              multiline
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />

            {visibleLines.map((line) => (
              <LineReceiveCard
                key={line.id}
                line={line}
                qty={qtyByLine[line.id] ?? '0'}
                batch={batchByLine[line.id] ?? ''}
                onQty={(t) => setQtyByLine((m) => ({ ...m, [line.id]: t }))}
                onBatch={(t) => setBatchByLine((m) => ({ ...m, [line.id]: t }))}
              />
            ))}

            {receivableLines.length === 0 ? (
              <EmptyState
                title="Nothing open"
                description="This PO has no open quantity on lines."
                icon="checkmark-circle-outline"
              />
            ) : null}

            <PrimaryButton title="Review" onPress={goReview} style={styles.mt} />
          </>
        ) : null}

        {stage === 'review' && po ? (
          <>
            <AppCard style={styles.card}>
              <Text style={styles.title}>{po.orderNumber}</Text>
              <Text style={styles.meta}>{po.vendorName}</Text>
              <Text style={styles.meta}>
                Date {formatDate(new Date().toISOString())} · WH{' '}
                {po.deliveryWarehouseName || '—'}
              </Text>
              {challan ? <Text style={styles.meta}>Challan {challan}</Text> : null}
            </AppCard>
            {(po.lines ?? [])
              .filter((l) => Number(qtyByLine[l.id] ?? 0) > 0)
              .map((line) => (
                <AppCard key={line.id} style={styles.card}>
                  <Text style={styles.title}>{line.itemCode}</Text>
                  <Text style={styles.meta}>
                    Receiving {qtyByLine[line.id]} of pending{' '}
                    {Number(line.openQuantity ?? 0)}
                    {batchByLine[line.id] ? ` · batch ${batchByLine[line.id]}` : ''}
                  </Text>
                </AppCard>
              ))}
            <PrimaryButton
              title={busy ? 'Saving…' : 'Save GRN draft'}
              onPress={() => void submitCreate(false)}
              disabled={busy}
              style={styles.mt}
            />
            <PrimaryButton
              title={busy ? 'Working…' : 'Save & submit GRN'}
              onPress={() => void submitCreate(true)}
              disabled={busy}
              style={styles.mt}
            />
            <SecondaryButton
              title="Back to lines"
              onPress={() => setStage('lines')}
              disabled={busy}
              style={styles.mt}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function LineReceiveCard({
  line,
  qty,
  batch,
  onQty,
  onBatch,
}: {
  line: PurchaseOrderLine
  qty: string
  batch: string
  onQty: (t: string) => void
  onBatch: (t: string) => void
}) {
  const open = Number(line.openQuantity ?? 0)
  const ordered = Number(line.quantity ?? line.uomQuantity ?? 0)
  const received = Number(line.receivedQuantity ?? 0)
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{line.itemCode || '—'}</Text>
        <StatusChip label={`open ${open}`} compact />
      </View>
      <Text style={styles.meta}>{line.itemName || '—'}</Text>
      <Text style={styles.meta}>
        Ordered {ordered} · already received {received} · UOM {line.uomCode || '—'}
      </Text>
      <Text style={styles.label}>Receive qty</Text>
      <TextInput
        style={styles.input}
        value={qty}
        onChangeText={onQty}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.label}>Batch / lot (if used)</Text>
      <ScanField value={batch} onChangeText={onBatch} placeholder="Optional batch" />
    </AppCard>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  offlineBanner: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  hint: { ...typography.caption, marginBottom: spacing.md, color: colors.textSecondary },
  card: { marginBottom: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4, color: colors.textSecondary },
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  multi: { minHeight: 64, textAlignVertical: 'top' },
  mt: { marginTop: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
})
