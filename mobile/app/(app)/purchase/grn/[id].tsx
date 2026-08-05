import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  ConfirmDialog,
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
import { isModuleEnabled } from '@/auth/modules'
import {
  canPostInventoryGrn,
  canSubmitDraftGrn,
  grnPostingStatusLabel,
  grnQcStatusLabel,
  postInventoryGoodsReceipt,
  purchaseFriendlyError,
  submitGoodsReceipt,
} from '@/features/purchase/api'
import {
  useGrnAccess,
  useGrnDetail,
  useInvalidatePurchase,
  useQiForGrn,
} from '@/features/purchase/hooks'
import { formatDate, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, spacing, typography } from '@/theme'

export default function GrnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const grnId = String(id || '')
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const qualityOn = isModuleEnabled('quality', profile?.modules)
  const { moduleOn, canView, canCreate, canPost, canQi, perms } = useGrnAccess()
  const q = useGrnDetail(grnId, canView && Boolean(grnId))
  const qiQ = useQiForGrn(grnId, canView && canQi && Boolean(grnId))
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)
  const [confirmPost, setConfirmPost] = useState(false)

  if (!moduleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Goods receipt" onBack={() => router.back()} />
        <EmptyState title="Purchase module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Goods receipt" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You are not authorised to perform this Purchase action."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!grnId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Goods receipt" onBack={() => router.back()} />
        <EmptyState title="Missing GRN" />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Goods receipt" onBack={() => router.back()} />
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
        <AppHeader title="Goods receipt" onBack={() => router.back()} />
        <ErrorState
          title={forbidden ? 'Not authorised' : notFound ? 'Not found' : 'Could not load GRN'}
          error={new Error(purchaseFriendlyError(q.error, 'Could not load goods receipt'))}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const grn = q.data
  const posted = String(grn.status) === 'INVENTORY_POSTED'
  const showSubmit = canSubmitDraftGrn(grn, perms)
  const showPost = canPostInventoryGrn(grn, perms)
  const qi = (qiQ.data ?? [])[0]

  const onSubmit = async () => {
    setBusy(true)
    try {
      await submitGoodsReceipt(grnId, 'Submitted from mobile')
      invalidate()
      await q.refetch()
      Alert.alert('Submitted', 'Goods receipt submitted.')
    } catch (e) {
      Alert.alert('Submit failed', purchaseFriendlyError(e, 'Submit failed'))
      if (e instanceof ApiError && e.status === 409) void q.refetch()
    } finally {
      setBusy(false)
    }
  }

  const onPost = async () => {
    setBusy(true)
    setConfirmPost(false)
    try {
      await postInventoryGoodsReceipt(grnId, 'Posted from mobile')
      invalidate()
      await q.refetch()
      Alert.alert('Posted', 'Inventory posted for this GRN.')
    } catch (e) {
      Alert.alert('Post failed', purchaseFriendlyError(e, 'Post failed'))
      if (e instanceof ApiError && e.status === 409) void q.refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={grn.grnNumber || 'Goods receipt'}
        subtitle={grn.vendorName || undefined}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.chips}>
          <StatusChip label={titleCaseLabel(grn.status) || '—'} tone={statusTone(grn.status)} />
          <StatusChip label={grnQcStatusLabel(grn)} compact />
          <StatusChip label={grnPostingStatusLabel(grn)} compact />
        </View>

        <FormSection title="Summary">
          <AppCard style={styles.card}>
            {grn.purchaseOrderId ? (
              <Pressable
                onPress={() =>
                  router.push(`/(app)/purchase/purchase-orders/${grn.purchaseOrderId}` as never)
                }
              >
                <ReviewRow label="PO" value={grn.purchaseOrderNumber || 'Open PO'} />
              </Pressable>
            ) : (
              <ReviewRow label="PO" value={grn.purchaseOrderNumber || '—'} />
            )}
            <ReviewRow label="Vendor" value={grn.vendorName || grn.vendorCode || '—'} />
            <ReviewRow label="Warehouse" value={grn.warehouseName || grn.warehouseCode || '—'} />
            <ReviewRow label="Plant" value={grn.plantId || '—'} />
            <ReviewRow label="Receipt date" value={formatDate(grn.receiptDate || undefined) || '—'} />
            <ReviewRow label="Supplier challan" value={grn.vendorChallanNumber || '—'} />
            <ReviewRow
              label="Challan date"
              value={formatDate(grn.vendorChallanDate || undefined) || '—'}
            />
            <ReviewRow label="Vehicle" value={grn.vehicleNumber || '—'} />
            <ReviewRow label="Transporter" value={grn.transporterName || '—'} />
            <ReviewRow label="Received by" value={grn.receivedByName || '—'} />
            <ReviewRow label="Total qty" value={String(grn.totalReceivedQty ?? 0)} />
            {grn.remarks ? <ReviewRow label="Remarks" value={String(grn.remarks)} /> : null}
          </AppCard>
        </FormSection>

        <FormSection title="Lines">
          {(grn.lines ?? []).map((line, idx) => (
            <AppCard key={line.id || String(idx)} style={styles.card}>
              <Text style={styles.lineCode}>{line.itemCode || '—'}</Text>
              <Text style={styles.lineName}>{line.itemName || line.description || '—'}</Text>
              <Text style={styles.meta}>
                Received {Number(line.receivedQuantity ?? 0)} · accepted{' '}
                {Number(line.acceptedQuantity ?? 0)} · rejected {Number(line.rejectedQuantity ?? 0)}
                {line.uom ? ` · ${line.uom}` : ''}
              </Text>
              {line.batchNumber ? <Text style={styles.meta}>Batch {line.batchNumber}</Text> : null}
              {line.serialNumber ? (
                <Text style={styles.meta}>Serial {line.serialNumber}</Text>
              ) : null}
              {line.toleranceStatus && line.toleranceStatus !== 'EXACT' ? (
                <Text style={styles.warn}>
                  Tolerance {line.toleranceStatus}
                  {line.variancePercentage != null ? ` · ${line.variancePercentage}%` : ''}
                </Text>
              ) : null}
              {line.qcRequired ? <Text style={styles.meta}>QC required</Text> : null}
            </AppCard>
          ))}
        </FormSection>

        <FormSection title="History">
          <AppCard style={styles.card}>
            <ReviewRow label="Created" value={formatDate(grn.createdAt || undefined) || '—'} />
            <ReviewRow label="Submitted" value={formatDate(grn.submittedAt || undefined) || '—'} />
            <ReviewRow label="Updated" value={formatDate(grn.updatedAt || undefined) || '—'} />
            <ReviewRow label="Posting" value={grnPostingStatusLabel(grn)} />
          </AppCard>
        </FormSection>

        {canQi ? (
          <FormSection title="Quality">
            <AppCard style={styles.card}>
              <ReviewRow label="QC status" value={grnQcStatusLabel(grn)} />
              {qi ? (
                <ReviewRow label="Inspection" value={qi.inspectionNumber || qi.id.slice(0, 8)} />
              ) : (
                <Text style={styles.meta}>No linked quality inspection loaded.</Text>
              )}
              {qi?.id && qualityOn ? (
                <SecondaryButton
                  title="Open quality inspection"
                  onPress={() => router.push(`/(app)/quality/inspection/${qi.id}` as never)}
                  style={styles.mt}
                />
              ) : null}
              {qi?.id ? (
                <SecondaryButton
                  title="Open purchase QC decision"
                  onPress={() =>
                    router.push(`/(app)/purchase/quality-inspections/${qi.id}` as never)
                  }
                  style={styles.mt}
                />
              ) : null}
            </AppCard>
          </FormSection>
        ) : null}

        {posted ? (
          <Text style={styles.muted}>This GRN is posted and cannot be edited on mobile.</Text>
        ) : null}

        {showSubmit ? (
          <PrimaryButton
            title={busy ? 'Working…' : 'Submit GRN'}
            onPress={() => void onSubmit()}
            disabled={busy || !canCreate}
            style={styles.cta}
          />
        ) : null}
        {showPost ? (
          <PrimaryButton
            title={busy ? 'Working…' : 'Post to inventory'}
            onPress={() => setConfirmPost(true)}
            disabled={busy || !canPost}
            style={styles.cta}
          />
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirmPost}
        title="Post GRN to inventory?"
        message="Posted goods receipts are treated as immutable. Confirm posting stock movements."
        confirmLabel="Post"
        onConfirm={() => void onPost()}
        onCancel={() => setConfirmPost(false)}
        loading={busy}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: { marginBottom: spacing.sm },
  lineCode: { ...typography.bodyStrong },
  lineName: { ...typography.caption, marginTop: 4, color: colors.textSecondary },
  meta: { ...typography.micro, marginTop: 4, color: colors.textMuted },
  warn: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  muted: { ...typography.caption, color: colors.textMuted, marginVertical: spacing.md },
  cta: { marginTop: spacing.md },
  mt: { marginTop: spacing.md },
})
