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
import { router } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  PrimaryButton,
  SecondaryButton,
} from '@/components'
import {
  advanceTransferTowardDispatch,
  createTransfer,
  createTransferDispatchKey,
  listStockBalances,
  listMasterItems,
  normalizeScan,
  type MasterItemSummary,
  type WarehouseSummary,
} from '@/features/store/api'
import { ScanField } from '@/features/store/ScanField'
import {
  useInvalidateStore,
  useTransferAccess,
  useWarehouses,
} from '@/features/store/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function NewStockTransferScreen() {
  const { invOn, canCreate, canSubmit, canApprove, canDispatch } = useTransferAccess()
  const invalidate = useInvalidateStore()
  const whQ = useWarehouses(canCreate)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [item, setItem] = useState<MasterItemSummary | null>(null)
  const [itemHits, setItemHits] = useState<MasterItemSummary[]>([])
  const [itemSearching, setItemSearching] = useState(false)
  const [onHand, setOnHand] = useState<string | null>(null)
  const [qty, setQty] = useState('1')
  const [batchNumber, setBatchNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [shipOnCreate, setShipOnCreate] = useState(true)
  const dispatchKeyRef = useRef<string | null>(null)

  const warehouses = whQ.data ?? []

  useEffect(() => {
    if (!fromId && warehouses[0]) setFromId(warehouses[0].id)
    if (!toId && warehouses[1]) setToId(warehouses[1].id)
    else if (!toId && warehouses[0] && warehouses.length === 1) setToId('')
  }, [warehouses, fromId, toId])

  const resolveItem = async (raw: string) => {
    const code = normalizeScan(raw)
    if (!code) {
      setItem(null)
      setItemHits([])
      setOnHand(null)
      return
    }
    setItemSearching(true)
    try {
      const hits = await listMasterItems({ search: code, limit: 15 })
      setItemHits(hits)
      const pick = hits.find((h) => (h.code || '').toUpperCase() === code.toUpperCase()) ?? hits[0] ?? null
      setItem(pick)
      if (pick && fromId) {
        const bals = await listStockBalances({ itemId: pick.id, warehouseId: fromId, limit: 5 })
        const first = bals[0]
        setOnHand(first ? String(first.onHandQty ?? first.quantity ?? '0') : '0')
      } else {
        setOnHand(null)
      }
    } catch (e) {
      Alert.alert('Item lookup failed', getUserFriendlyMessage(e))
      setItem(null)
      setItemHits([])
      setOnHand(null)
    } finally {
      setItemSearching(false)
    }
  }

  useEffect(() => {
    if (!item?.id || !fromId) return
    void listStockBalances({ itemId: item.id, warehouseId: fromId, limit: 5 })
      .then((bals) => {
        const first = bals[0]
        setOnHand(first ? String(first.onHandQty ?? first.quantity ?? '0') : '0')
      })
      .catch(() => setOnHand(null))
  }, [fromId, item?.id])

  const pickItem = (row: MasterItemSummary) => {
    setItem(row)
    setItemCode(row.code || row.id)
    setItemHits([row])
  }

  const submit = async () => {
    if (!canCreate) {
      Alert.alert('Not authorised', 'You cannot create stock transfers.')
      return
    }
    if (!fromId || !toId) {
      Alert.alert('Warehouses', 'Select source and destination warehouses.')
      return
    }
    if (fromId === toId) {
      Alert.alert('Warehouses', 'Destination must differ from source.')
      return
    }
    if (!item?.id) {
      Alert.alert('Item', 'Scan or search an item code first.')
      return
    }
    const quantity = Number(qty)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Quantity', 'Enter a positive quantity.')
      return
    }

    setBusy(true)
    try {
      const created = await createTransfer({
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        remarks: remarks.trim() || 'Mobile warehouse transfer',
        lines: [
          {
            itemId: item.id,
            quantity,
            batchNumber: batchNumber.trim() || undefined,
            serialNumber: serialNumber.trim() || undefined,
          },
        ],
      })

      let final = created
      if (shipOnCreate && (canSubmit || canApprove || canDispatch)) {
        if (!dispatchKeyRef.current) {
          dispatchKeyRef.current = createTransferDispatchKey(created.id)
        }
        final = await advanceTransferTowardDispatch(created.id, {
          canSubmit,
          canApprove,
          canDispatch,
          remarks: remarks.trim() || 'Mobile warehouse transfer',
          dispatchIdempotencyKey: dispatchKeyRef.current,
        })
      }

      invalidate()
      dispatchKeyRef.current = null
      Alert.alert(
        'Transfer saved',
        `${final.transferNumber || final.id.slice(0, 8)} · ${String(final.status)}`,
        [
          {
            text: 'Open',
            onPress: () => router.replace(`/(app)/store/transfer/${final.id}` as never),
          },
          {
            text: 'List',
            style: 'cancel',
            onPress: () => router.replace('/(app)/store/transfer' as never),
          },
        ],
      )
    } catch (e) {
      Alert.alert('Transfer failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!invOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="New transfer" showBack />
        <EmptyState
          title="Inventory not enabled"
          description="Your organisation does not have the inventory module turned on."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!canCreate) {
    return (
      <View style={styles.flex}>
        <AppHeader title="New transfer" showBack />
        <EmptyState
          title="No access"
          description="Requires inventory.transfers.create (or inventory.create)."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="New transfer" subtitle="Scan item · from / to warehouse" showBack />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Scan an item barcode with the camera button or a keyboard wedge (Enter submits search),
          pick warehouses, then create. Optional ship advances draft → dispatch when your role allows
          each step.
        </Text>

        {whQ.isLoading ? <Loading /> : null}
        {whQ.error ? <ErrorState error={whQ.error} onRetry={() => void whQ.refetch()} /> : null}

        <Text style={styles.label}>From warehouse</Text>
        <WarehousePicker
          warehouses={warehouses}
          selectedId={fromId}
          excludeId={toId}
          onSelect={setFromId}
        />

        <Text style={styles.label}>To warehouse</Text>
        <WarehousePicker
          warehouses={warehouses}
          selectedId={toId}
          excludeId={fromId}
          onSelect={setToId}
        />

        <ScanField
          value={itemCode}
          onChangeText={setItemCode}
          onSubmitScan={(n) => {
            setItemCode(n)
            void resolveItem(n)
          }}
          placeholder="Item code or scan…"
          label="Item"
          autoFocus
        />
        {itemSearching ? <Loading /> : null}
        {item ? (
          <AppCard style={styles.card}>
            <Text style={styles.title}>{item.code || item.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>{String(item.name || '—')}</Text>
            {onHand != null ? (
              <Text style={styles.meta}>On hand at source: {onHand}</Text>
            ) : null}
          </AppCard>
        ) : null}
        {itemHits.length > 1
          ? itemHits.map((hit) => (
              <Pressable key={hit.id} onPress={() => pickItem(hit)}>
                <Text style={styles.link}>
                  {hit.code || hit.id.slice(0, 8)} — {String(hit.name || '')}
                </Text>
              </Pressable>
            ))
          : null}

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Batch (if required)</Text>
        <ScanField
          value={batchNumber}
          onChangeText={setBatchNumber}
          placeholder="Scan or type batch"
        />

        <Text style={styles.label}>Serial (if required)</Text>
        <ScanField
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="Scan or type serial"
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

        {(canSubmit || canApprove || canDispatch) ? (
          <Pressable
            onPress={() => setShipOnCreate((v) => !v)}
            style={styles.checkRow}
          >
            <View style={[styles.check, shipOnCreate && styles.checkOn]} />
            <Text style={styles.checkLabel}>
              Ship if allowed (submit → approve → dispatch with your permissions)
            </Text>
          </Pressable>
        ) : null}

        <PrimaryButton
          title={busy ? 'Posting…' : shipOnCreate ? 'Create & ship' : 'Create draft'}
          onPress={() => void submit()}
          disabled={busy}
          style={styles.mt}
        />
        <SecondaryButton
          title="Cancel"
          onPress={() => router.back()}
          style={styles.mt}
        />
      </ScrollView>
    </View>
  )
}

function WarehousePicker({
  warehouses,
  selectedId,
  excludeId,
  onSelect,
}: {
  warehouses: WarehouseSummary[]
  selectedId: string
  excludeId?: string
  onSelect: (id: string) => void
}) {
  return (
    <View style={styles.whList}>
      {warehouses.map((w) => {
        const disabled = Boolean(excludeId && w.id === excludeId)
        const on = w.id === selectedId
        return (
          <Pressable
            key={w.id}
            disabled={disabled}
            onPress={() => onSelect(w.id)}
            style={[styles.whChip, on && styles.whChipOn, disabled && styles.whDisabled]}
          >
            <Text style={[styles.whText, on && styles.whTextOn]} numberOfLines={1}>
              {w.name || w.code || w.id.slice(0, 8)}
            </Text>
            {w.code ? <Text style={styles.whCode}>{w.code}</Text> : null}
          </Pressable>
        )
      })}
      {warehouses.length === 0 ? (
        <Text style={styles.meta}>No active warehouses found.</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  hint: { ...typography.caption, marginBottom: spacing.md, color: colors.textSecondary },
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multi: { minHeight: 72, textAlignVertical: 'top' },
  card: { marginBottom: spacing.sm },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, marginTop: 4 },
  link: { ...typography.caption, color: colors.primary, marginBottom: spacing.xs },
  mt: { marginTop: spacing.md },
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
  whList: { gap: spacing.sm, marginBottom: spacing.sm },
  whChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  whChipOn: { borderColor: colors.primary },
  whDisabled: { opacity: 0.35 },
  whText: { ...typography.body },
  whTextOn: { color: colors.primary, fontWeight: '600' },
  whCode: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
})
