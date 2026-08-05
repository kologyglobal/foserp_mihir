import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  FormSection,
  Loading,
  PrimaryButton,
  ReviewRow,
  SecondaryButton,
  StatusChip,
} from '@/components'
import { purchaseFriendlyError } from '@/features/purchase/api'
import {
  approvePurchaseReturn,
  completePurchaseReturn,
  shipPurchaseReturn,
  submitPurchaseReturn,
} from '@/features/purchase/phaseCApi'
import {
  useInvalidatePurchase,
  useReturnAccess,
  useReturnDetail,
} from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, spacing, typography } from '@/theme'

export default function PurchaseReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const returnId = String(id || '')
  const router = useRouter()
  const { moduleOn, canView, canSubmit, canComplete } = useReturnAccess()
  const q = useReturnDetail(returnId, canView && Boolean(returnId))
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)

  if (!moduleOn || !canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Return" onBack={() => router.back()} />
        <EmptyState title={!moduleOn ? 'Purchase module disabled' : 'Not authorised'} />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Return" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Return" onBack={() => router.back()} />
        <ErrorState
          title="Could not load return"
          error={new Error(purchaseFriendlyError(q.error, 'Load failed'))}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const ret = q.data
  const st = String(ret.status || '').toUpperCase()

  const act = async (kind: 'submit' | 'approve' | 'ship' | 'complete') => {
    setBusy(true)
    try {
      if (kind === 'submit') await submitPurchaseReturn(returnId, 'Mobile')
      if (kind === 'approve') await approvePurchaseReturn(returnId, 'Mobile')
      if (kind === 'ship') await shipPurchaseReturn(returnId, 'Mobile')
      if (kind === 'complete') await completePurchaseReturn(returnId, 'Mobile')
      invalidate()
      await q.refetch()
      Alert.alert('Done', `Return ${kind} succeeded.`)
    } catch (e) {
      Alert.alert('Action failed', purchaseFriendlyError(e, 'Could not update return'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title={ret.returnNumber || 'Return'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.chips}>
          <StatusChip label={titleCaseLabel(ret.status) || '—'} tone={statusTone(ret.status)} />
          <StatusChip label={titleCaseLabel(ret.returnType) || 'Credit'} compact />
        </View>
        <FormSection title="Summary">
          <AppCard style={styles.card}>
            <ReviewRow label="Vendor" value={ret.vendorName || '—'} />
            <ReviewRow label="Date" value={formatDate(ret.returnDate || undefined) || '—'} />
            <ReviewRow label="PO" value={ret.purchaseOrderNumber || '—'} />
            <ReviewRow label="GRN" value={ret.goodsReceiptNumber || '—'} />
            <ReviewRow label="Reason" value={ret.reason || '—'} />
            <ReviewRow label="Total" value={formatMoney(Number(ret.totalAmount ?? 0))} />
          </AppCard>
        </FormSection>
        <FormSection title="Lines">
          {(ret.lines ?? []).map((l, i) => (
            <AppCard key={l.id || String(i)} style={styles.card}>
              <Text style={styles.lineCode}>{l.itemCode || '—'}</Text>
              <Text style={styles.meta}>
                {l.itemName || '—'} · return qty {Number(l.returnQuantity ?? 0)}
              </Text>
            </AppCard>
          ))}
        </FormSection>
        {canSubmit && st === 'DRAFT' ? (
          <PrimaryButton
            title={busy ? 'Working…' : 'Submit return'}
            onPress={() => void act('submit')}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {canComplete && st === 'SUBMITTED' ? (
          <SecondaryButton
            title={busy ? 'Working…' : 'Approve return'}
            onPress={() => void act('approve')}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {canComplete && st === 'APPROVED' ? (
          <SecondaryButton
            title={busy ? 'Working…' : 'Mark shipped'}
            onPress={() => void act('ship')}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {canComplete && (st === 'SHIPPED' || st === 'APPROVED') ? (
          <PrimaryButton
            title={busy ? 'Working…' : 'Complete return'}
            onPress={() => void act('complete')}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  lineCode: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  cta: { marginTop: spacing.md },
})
