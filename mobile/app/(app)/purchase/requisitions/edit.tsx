import { useEffect, useState } from 'react'
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
  Loading,
  PrimaryButton,
  SecondaryButton,
} from '@/components'
import { ScanField } from '@/features/store/ScanField'
import { listMasterItems } from '@/features/store/api'
import {
  canEditPrDocument,
  createPurchaseRequisition,
  updatePurchaseRequisition,
  type PrEditorLine,
} from '@/features/purchase/phaseCApi'
import {
  useInvalidatePurchase,
  usePrAccess,
  usePrDetail,
} from '@/features/purchase/hooks'
import { purchaseFriendlyError } from '@/features/purchase/api'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function PurchaseRequisitionEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const prId = id ? String(id) : ''
  const isEdit = Boolean(prId)
  const router = useRouter()
  const { moduleOn, canCreate, canEdit } = usePrAccess()
  const allowed = isEdit ? canEdit : canCreate
  const q = usePrDetail(prId, isEdit && canEdit)
  const invalidate = useInvalidatePurchase()

  const [purpose, setPurpose] = useState('')
  const [remarks, setRemarks] = useState('')
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [rfqRequired, setRfqRequired] = useState(false)
  const [lines, setLines] = useState<PrEditorLine[]>([])
  const [scan, setScan] = useState('')
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [busy, setBusy] = useState(false)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!q.data || seeded) return
    if (!canEditPrDocument(q.data.status)) return
    setPurpose(String(q.data.purchasePurpose || ''))
    setRemarks(String(q.data.remarks || ''))
    const p = String(q.data.priority || 'NORMAL').toUpperCase()
    setPriority(p === 'HIGH' || p === 'URGENT' ? p : 'NORMAL')
    setRfqRequired(Boolean(q.data.rfqRequired))
    setLines(
      (q.data.lines ?? []).map((l) => ({
        id: l.id,
        itemId: l.itemId,
        itemCode: l.itemCode || '',
        itemName: l.itemName || '',
        requiredQuantity: Number(l.requiredQuantity ?? 0),
        estimatedRate: Number(l.estimatedRate ?? 0),
        remarks: l.remarks,
      })),
    )
    setSeeded(true)
  }, [q.data, seeded])

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Edit requisition" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!allowed) {
    return (
      <View style={styles.flex}>
        <AppHeader title={isEdit ? 'Edit requisition' : 'New requisition'} onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description={
            isEdit
              ? 'Need purchase.pr.edit to change draft lines.'
              : 'Need purchase.pr.create to draft a PR.'
          }
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (isEdit && q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Edit requisition" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (isEdit && q.data && !canEditPrDocument(q.data.status)) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Edit requisition" onBack={() => router.back()} />
        <EmptyState
          title="Not editable"
          description="Only DRAFT requisitions can be edited on mobile."
          icon="ban-outline"
        />
      </View>
    )
  }

  const addLineFromScan = async (code: string) => {
    const token = code.trim()
    if (!token) return
    const qn = Number(qty)
    if (!Number.isFinite(qn) || qn <= 0) {
      Alert.alert('Quantity', 'Enter a positive required quantity.')
      return
    }
    try {
      const items = await listMasterItems({ search: token, limit: 10 })
      const exact =
        items.find((i) => String(i.code || '').toUpperCase() === token.toUpperCase()) || items[0]
      if (!exact) {
        Alert.alert('Item not found', 'No master item matched that code.')
        return
      }
      setLines((prev) => [
        ...prev,
        {
          itemId: exact.id,
          itemCode: exact.code || token,
          itemName: exact.name || exact.code || token,
          requiredQuantity: qn,
          estimatedRate: Number(rate) || 0,
        },
      ])
      setScan('')
    } catch (e) {
      Alert.alert('Lookup failed', purchaseFriendlyError(e, 'Could not search items'))
    }
  }

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const save = async () => {
    if (lines.length === 0) {
      Alert.alert('Lines required', 'Add at least one line before saving.')
      return
    }
    setBusy(true)
    try {
      const body = {
        priority,
        purchasePurpose: purpose.trim() || null,
        rfqRequired,
        remarks: remarks.trim() || null,
        lines: lines.map((l) => ({
          id: l.id,
          itemId: l.itemId,
          itemCode: l.itemCode || '',
          itemName: l.itemName || '',
          requiredQuantity: Number(l.requiredQuantity),
          estimatedRate: Number(l.estimatedRate ?? 0),
          remarks: l.remarks ?? null,
        })),
      }
      if (isEdit) {
        await updatePurchaseRequisition(prId, body)
        invalidate()
        Alert.alert('Saved', 'Requisition lines updated.', [
          { text: 'OK', onPress: () => router.replace(`/(app)/purchase/requisitions/${prId}` as never) },
        ])
      } else {
        const created = await createPurchaseRequisition(body)
        invalidate()
        Alert.alert('Created', created.requisitionNumber || 'Draft PR saved.', [
          {
            text: 'Open',
            onPress: () =>
              router.replace(`/(app)/purchase/requisitions/${created.id}` as never),
          },
        ])
      }
    } catch (e) {
      Alert.alert('Save failed', purchaseFriendlyError(e, 'Could not save requisition'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={isEdit ? 'Edit PR lines' : 'New requisition'}
        subtitle="Draft editor — scan item codes"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Purpose</Text>
        <TextInput
          value={purpose}
          onChangeText={setPurpose}
          placeholder="Purchase purpose"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>Remarks</Text>
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Optional"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.label}>Priority</Text>
        <View style={styles.row}>
          {(['NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              style={[styles.chip, priority === p && styles.chipOn]}
            >
              <Text style={[styles.chipText, priority === p && styles.chipTextOn]}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => setRfqRequired((v) => !v)}
          style={[styles.chip, rfqRequired && styles.chipOn, styles.mt]}
        >
          <Text style={[styles.chipText, rfqRequired && styles.chipTextOn]}>
            RFQ required: {rfqRequired ? 'Yes' : 'No'}
          </Text>
        </Pressable>

        <Text style={[styles.label, styles.mt]}>Add line (scan / search item)</Text>
        <ScanField
          value={scan}
          onChangeText={setScan}
          onSubmitScan={(c) => void addLineFromScan(c)}
          placeholder="Item code"
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.micro}>Qty</Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.micro}>Est. rate</Text>
            <TextInput
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>
        <SecondaryButton title="Add item" onPress={() => void addLineFromScan(scan)} />

        <Text style={[styles.label, styles.mt]}>Lines ({lines.length})</Text>
        {lines.map((line, idx) => (
          <AppCard key={`${line.itemCode}-${idx}`} style={styles.card}>
            <Text style={styles.lineCode}>{line.itemCode || '—'}</Text>
            <Text style={styles.lineName}>{line.itemName || '—'}</Text>
            <Text style={styles.micro}>
              Qty {line.requiredQuantity} · rate {line.estimatedRate ?? 0}
            </Text>
            <SecondaryButton title="Remove" onPress={() => removeLine(idx)} style={styles.mtSm} />
          </AppCard>
        ))}

        <PrimaryButton
          title={busy ? 'Saving…' : isEdit ? 'Save draft' : 'Create draft PR'}
          onPress={() => void save()}
          disabled={busy}
          style={styles.cta}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  micro: { ...typography.micro, color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'flex-start' },
  half: { flex: 1, minWidth: 100 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
  card: { marginBottom: spacing.sm },
  lineCode: { ...typography.bodyStrong },
  lineName: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  mt: { marginTop: spacing.md },
  mtSm: { marginTop: spacing.sm },
  cta: { marginTop: spacing.xl },
})
