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
  approvePurchaseInvoice,
  submitPurchaseInvoice,
} from '@/features/purchase/phaseCApi'
import {
  useInvalidatePurchase,
  useInvoiceAccess,
  useInvoiceDetail,
} from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, spacing, typography } from '@/theme'

export default function PurchaseInvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const invoiceId = String(id || '')
  const router = useRouter()
  const { moduleOn, canView, canSubmit, canApprove } = useInvoiceAccess()
  const q = useInvoiceDetail(invoiceId, canView && Boolean(invoiceId))
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)

  if (!moduleOn || !canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Invoice" onBack={() => router.back()} />
        <EmptyState title={!moduleOn ? 'Purchase module disabled' : 'Not authorised'} />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Invoice" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Invoice" onBack={() => router.back()} />
        <ErrorState
          title="Could not load invoice"
          error={new Error(purchaseFriendlyError(q.error, 'Load failed'))}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const inv = q.data
  const st = String(inv.status || '').toUpperCase()
  const showSubmit = canSubmit && (inv.allowedActions?.canSubmit || st === 'DRAFT')
  const showApprove =
    canApprove && (Boolean(inv.allowedActions?.canApprove) || st === 'PENDING_APPROVAL')

  const act = async (kind: 'submit' | 'approve') => {
    setBusy(true)
    try {
      if (kind === 'submit') await submitPurchaseInvoice(invoiceId, 'Mobile submit')
      else await approvePurchaseInvoice(invoiceId, 'Mobile approve')
      invalidate()
      await q.refetch()
      Alert.alert('Done', kind === 'submit' ? 'Invoice submitted.' : 'Invoice approved.')
    } catch (e) {
      Alert.alert('Action failed', purchaseFriendlyError(e, 'Could not update invoice'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title={inv.invoiceNumber || 'Invoice'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusChip label={titleCaseLabel(inv.status) || '—'} tone={statusTone(inv.status)} />
        <FormSection title="Summary">
          <AppCard style={styles.card}>
            <ReviewRow label="Vendor" value={inv.vendorName || '—'} />
            <ReviewRow label="Vendor inv #" value={inv.vendorInvoiceNumber || '—'} />
            <ReviewRow label="Date" value={formatDate(inv.invoiceDate || undefined) || '—'} />
            <ReviewRow label="PO" value={inv.purchaseOrderNumber || '—'} />
            <ReviewRow label="GRN" value={inv.goodsReceiptNumber || '—'} />
            <ReviewRow label="Total" value={formatMoney(Number(inv.totalAmount ?? 0))} />
            <ReviewRow label="Tax" value={formatMoney(Number(inv.taxAmount ?? 0))} />
          </AppCard>
        </FormSection>
        <FormSection title="Lines">
          {(inv.lines ?? []).map((l, i) => (
            <AppCard key={l.id || String(i)} style={styles.card}>
              <Text style={styles.lineCode}>{l.itemCode || '—'}</Text>
              <Text style={styles.meta}>
                {l.itemName || '—'} · {Number(l.quantity ?? 0)} @ {formatMoney(Number(l.rate ?? 0))}
              </Text>
            </AppCard>
          ))}
        </FormSection>
        {showSubmit ? (
          <PrimaryButton
            title={busy ? 'Working…' : 'Submit invoice'}
            onPress={() => void act('submit')}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {showApprove ? (
          <SecondaryButton
            title={busy ? 'Working…' : 'Approve invoice'}
            onPress={() => void act('approve')}
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
  card: { marginBottom: spacing.sm, marginTop: spacing.sm },
  lineCode: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  cta: { marginTop: spacing.md },
})
