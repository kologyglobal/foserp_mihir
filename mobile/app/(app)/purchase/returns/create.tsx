import { useEffect, useState } from 'react'
import {
  Alert,
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
import { purchaseFriendlyError } from '@/features/purchase/api'
import {
  createPurchaseReturn,
  getReturnPrefillFromQi,
  type CreateReturnInput,
} from '@/features/purchase/phaseCApi'
import { useInvalidatePurchase, useReturnAccess } from '@/features/purchase/hooks'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function PurchaseReturnCreateScreen() {
  const { qiId } = useLocalSearchParams<{ qiId?: string }>()
  const inspectionId = String(qiId || '')
  const router = useRouter()
  const { moduleOn, canCreate } = useReturnAccess()
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(Boolean(inspectionId))
  const [reason, setReason] = useState('')
  const [payload, setPayload] = useState<CreateReturnInput | null>(null)
  const [prefillError, setPrefillError] = useState('')

  useEffect(() => {
    if (!inspectionId || !canCreate) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await getReturnPrefillFromQi(inspectionId)
        if (cancelled) return
        const linesRaw = (data.lines as Array<Record<string, unknown>>) || []
        const lines = linesRaw
          .map((l) => ({
            goodsReceiptLineId: (l.goodsReceiptLineId as string) || null,
            purchaseOrderLineId: (l.purchaseOrderLineId as string) || null,
            itemId: (l.itemId as string) || null,
            itemCode: String(l.itemCode || l.itemCodeSnapshot || ''),
            itemName: String(l.itemName || l.itemNameSnapshot || ''),
            returnQuantity: Number(l.returnQuantity ?? l.rejectedQuantity ?? 0),
            rate: Number(l.rate ?? 0),
          }))
          .filter((l) => l.returnQuantity > 0)
        if (!data.vendorId || lines.length === 0) {
          setPrefillError('Prefill has no vendor or returnable qty. Use desktop for complex returns.')
          setLoading(false)
          return
        }
        setPayload({
          vendorId: String(data.vendorId),
          purchaseOrderId: (data.purchaseOrderId as string) || null,
          goodsReceiptId: (data.goodsReceiptId as string) || null,
          qualityInspectionId: inspectionId,
          warehouseId: (data.warehouseId as string) || null,
          returnType: 'CREDIT',
          reason: String(data.reason || 'Rejected quantity from QI'),
          lines,
        })
        setReason(String(data.reason || 'Rejected quantity from QI'))
      } catch (e) {
        setPrefillError(purchaseFriendlyError(e, 'Could not prefill return from inspection'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inspectionId, canCreate])

  if (!moduleOn || !canCreate) {
    return (
      <View style={styles.flex}>
        <AppHeader title="New return" onBack={() => router.back()} />
        <EmptyState
          title={!moduleOn ? 'Purchase module disabled' : 'Not authorised'}
          description="Need purchase.return.create."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!inspectionId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="New return" onBack={() => router.back()} />
        <EmptyState
          title="Open from QI"
          description="Start a mobile return from a purchase quality inspection detail (Create return)."
          icon="return-down-back-outline"
        />
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="New return" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (prefillError || !payload) {
    return (
      <View style={styles.flex}>
        <AppHeader title="New return" onBack={() => router.back()} />
        <EmptyState title="Cannot prefill" description={prefillError || 'Missing data'} />
      </View>
    )
  }

  const create = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Enter a return reason.')
      return
    }
    setBusy(true)
    try {
      const created = await createPurchaseReturn({ ...payload, reason: reason.trim() })
      invalidate()
      Alert.alert('Created', created.returnNumber || 'Return draft saved.', [
        {
          text: 'Open',
          onPress: () => router.replace(`/(app)/purchase/returns/${created.id}` as never),
        },
      ])
    } catch (e) {
      Alert.alert('Create failed', purchaseFriendlyError(e, 'Could not create return'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="New return" subtitle="Prefill from QI" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Qty and items come from the quality inspection. Adjust reason, then create a DRAFT return.
        </Text>
        <Text style={styles.label}>Reason</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />
        {(payload.lines ?? []).map((l, i) => (
          <AppCard key={String(i)} style={styles.card}>
            <Text style={styles.lineCode}>{l.itemCode || '—'}</Text>
            <Text style={styles.meta}>
              {l.itemName || '—'} · return {l.returnQuantity}
            </Text>
          </AppCard>
        ))}
        <PrimaryButton
          title={busy ? 'Creating…' : 'Create draft return'}
          onPress={() => void create()}
          disabled={busy}
          style={styles.cta}
        />
        <SecondaryButton title="Cancel" onPress={() => router.back()} style={styles.cta} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 90,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  card: { marginBottom: spacing.sm },
  lineCode: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  cta: { marginTop: spacing.md },
})
