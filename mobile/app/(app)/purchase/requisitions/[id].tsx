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
import { ApiError } from '@/api/errors'
import { convertPrToRfq } from '@/features/purchase/phaseCApi'
import {
  isPrSubmittable,
  prEstimatedTotal,
  purchaseFriendlyError,
  submitPurchaseRequisition,
} from '@/features/purchase/api'
import {
  useInvalidatePurchase,
  usePrAccess,
  usePrDetail,
} from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, spacing, typography } from '@/theme'

export default function PurchaseRequisitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const prId = String(id || '')
  const router = useRouter()
  const { moduleOn, canView, canSubmit, canCreate, canEdit, canRfqCreate } = usePrAccess()
  const q = usePrDetail(prId, canView && Boolean(prId))
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Requisition" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Requisition" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You are not authorised to perform this Purchase action."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!prId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Requisition" onBack={() => router.back()} />
        <EmptyState title="Missing PR" description="No requisition id in the route." />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Requisition" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !q.data) {
    const forbidden =
      q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)
    const notFound =
      q.error instanceof ApiError && (q.error.kind === 'not_found' || q.error.status === 404)
    return (
      <View style={styles.flex}>
        <AppHeader title="Requisition" onBack={() => router.back()} />
        <ErrorState
          title={
            forbidden ? 'Not authorised' : notFound ? 'Not found' : 'Could not load requisition'
          }
          error={new Error(purchaseFriendlyError(q.error, 'Could not load requisition'))}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const pr = q.data
  const showSubmit = canSubmit && isPrSubmittable(pr)
  const showEdit = canEdit && isPrSubmittable(pr)
  const st = String(pr.status || '').toUpperCase()
  const showConvertRfq =
    canRfqCreate && (st === 'APPROVED' || st === 'PARTIALLY_CONVERTED')
  const est = prEstimatedTotal(pr)

  const onSubmit = async () => {
    setBusy(true)
    try {
      await submitPurchaseRequisition(prId, 'Submitted from mobile')
      invalidate()
      await q.refetch()
      Alert.alert('Submitted', 'Purchase requisition submitted for approval.')
    } catch (e) {
      Alert.alert('Submit failed', purchaseFriendlyError(e, 'Submit failed'))
      if (e instanceof ApiError && e.status === 409) void q.refetch()
    } finally {
      setBusy(false)
    }
  }

  const onConvertRfq = async () => {
    setBusy(true)
    try {
      const rfq = await convertPrToRfq(prId, {
        title: `RFQ from ${pr.requisitionNumber || prId}`,
        remarks: 'Converted from mobile',
      })
      invalidate()
      Alert.alert('RFQ created', rfq.rfqNumber || 'Draft RFQ ready.', [
        {
          text: 'Open RFQ',
          onPress: () => router.push(`/(app)/purchase/rfq/${rfq.id}` as never),
        },
      ])
    } catch (e) {
      Alert.alert('Convert failed', purchaseFriendlyError(e, 'Could not convert PR to RFQ'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={pr.requisitionNumber || 'Requisition'}
        subtitle={pr.requestedByName || undefined}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          <StatusChip label={titleCaseLabel(pr.status) || '—'} tone={statusTone(pr.status)} />
          {pr.priority ? (
            <StatusChip label={titleCaseLabel(pr.priority)} compact />
          ) : null}
        </View>

        <FormSection title="Summary">
          <AppCard style={styles.card}>
            <ReviewRow
              label="PR date"
              value={formatDate(pr.requisitionDate || undefined) || '—'}
            />
            <ReviewRow
              label="Required by"
              value={formatDate(pr.requiredDate || undefined) || '—'}
            />
            <ReviewRow label="Requested by" value={pr.requestedByName || '—'} />
            <ReviewRow label="Purpose" value={pr.purchasePurpose || '—'} />
            <ReviewRow label="Est. total" value={est > 0 ? formatMoney(est) : '—'} />
            <ReviewRow label="RFQ required" value={pr.rfqRequired ? 'Yes' : 'No'} />
            <ReviewRow
              label="Submitted"
              value={formatDate(pr.submittedAt || undefined) || '—'}
            />
            <ReviewRow
              label="Approved"
              value={formatDate(pr.approvedAt || undefined) || '—'}
            />
            {pr.rejectionReason ? (
              <ReviewRow label="Rejection" value={String(pr.rejectionReason)} />
            ) : null}
            {pr.remarks ? <ReviewRow label="Remarks" value={String(pr.remarks)} /> : null}
          </AppCard>
        </FormSection>

        <FormSection title="Lines">
          {(pr.lines ?? []).length === 0 ? (
            <Text style={styles.muted}>No lines on this requisition.</Text>
          ) : (
            (pr.lines ?? []).map((line) => (
              <AppCard key={line.id} style={styles.card}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineCode}>{line.itemCode || '—'}</Text>
                  {line.status ? (
                    <StatusChip label={titleCaseLabel(line.status)} compact />
                  ) : null}
                </View>
                <Text style={styles.lineName}>{line.itemName || line.description || '—'}</Text>
                <Text style={styles.meta}>
                  Required {Number(line.requiredQuantity ?? 0)}
                  {line.orderedQuantity != null ? ` · ordered ${line.orderedQuantity}` : ''}
                  {line.remainingQuantity != null
                    ? ` · remaining ${line.remainingQuantity}`
                    : ''}
                </Text>
                {Number(line.estimatedAmount ?? 0) > 0 ? (
                  <Text style={styles.meta}>
                    Est. {formatMoney(Number(line.estimatedRate ?? 0))} ·{' '}
                    {formatMoney(Number(line.estimatedAmount ?? 0))}
                  </Text>
                ) : null}
                {line.purchaseOrderNumber ? (
                  <Text style={styles.meta}>PO {line.purchaseOrderNumber}</Text>
                ) : null}
              </AppCard>
            ))
          )}
        </FormSection>

        {showEdit ? (
          <SecondaryButton
            title="Edit lines"
            onPress={() =>
              router.push(`/(app)/purchase/requisitions/edit?id=${encodeURIComponent(prId)}` as never)
            }
            style={styles.cta}
          />
        ) : null}
        {showSubmit ? (
          <PrimaryButton
            title={busy ? 'Submitting…' : 'Submit for approval'}
            onPress={() => void onSubmit()}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {showConvertRfq ? (
          <SecondaryButton
            title={busy ? 'Working…' : 'Convert to RFQ'}
            onPress={() => void onConvertRfq()}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {!showSubmit && isPrSubmittable(pr) && !canSubmit ? (
          <Text style={styles.muted}>
            This PR is draft. You need purchase.pr.submit to send it for approval.
          </Text>
        ) : null}
        {canCreate && !showEdit ? (
          <SecondaryButton
            title="New requisition"
            onPress={() => router.push('/(app)/purchase/requisitions/edit' as never)}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: { marginBottom: spacing.sm },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineCode: { ...typography.bodyStrong, flex: 1 },
  lineName: { ...typography.caption, marginTop: 4, color: colors.textSecondary },
  meta: { ...typography.micro, marginTop: 4, color: colors.textMuted },
  muted: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  cta: { marginTop: spacing.lg },
})
