import { useState } from 'react'
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
  acceptPurchaseQualityInspection,
  holdPurchaseQualityInspection,
  isQiActionable,
  rejectPurchaseQualityInspection,
  startPurchaseQualityInspection,
} from '@/features/purchase/phaseCApi'
import {
  useInvalidatePurchase,
  usePurchaseQiActAccess,
  usePurchaseQiDetail,
  useReturnAccess,
} from '@/features/purchase/hooks'
import { formatDate, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function PurchaseQiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qiId = String(id || '')
  const router = useRouter()
  const { moduleOn, canView, canDecide, canEdit } = usePurchaseQiActAccess()
  const { canCreate: canCreateReturn } = useReturnAccess()
  const q = usePurchaseQiDetail(qiId, canView && Boolean(qiId))
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)
  const [remarks, setRemarks] = useState('')

  if (!moduleOn || !canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase QC" onBack={() => router.back()} />
        <EmptyState
          title={!moduleOn ? 'Purchase module disabled' : 'Not authorised'}
          description="Need purchase.qi.view."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase QC" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Purchase QC" onBack={() => router.back()} />
        <ErrorState
          title="Could not load inspection"
          error={new Error(purchaseFriendlyError(q.error, 'Load failed'))}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const qi = q.data
  const actionable = isQiActionable(qi.status)
  const canAct = canDecide && (qi.allowedActions?.canComplete ?? actionable)
  const canStart = canEdit && actionable && String(qi.status).toUpperCase() === 'PENDING'

  const run = async (kind: 'start' | 'accept' | 'reject' | 'hold') => {
    setBusy(true)
    try {
      if (kind === 'start') await startPurchaseQualityInspection(qiId)
      if (kind === 'accept') await acceptPurchaseQualityInspection(qiId, remarks.trim() || undefined)
      if (kind === 'reject') await rejectPurchaseQualityInspection(qiId, remarks.trim() || undefined)
      if (kind === 'hold') await holdPurchaseQualityInspection(qiId, remarks.trim() || undefined)
      invalidate()
      await q.refetch()
      Alert.alert('Saved', `Inspection ${kind} succeeded.`)
    } catch (e) {
      Alert.alert('Failed', purchaseFriendlyError(e, 'Could not update inspection'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={qi.inspectionNumber || 'Purchase QC'}
        subtitle="Decisions use purchase.qi APIs"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusChip label={titleCaseLabel(qi.status) || '—'} tone={statusTone(qi.status)} />
        <FormSection title="Summary">
          <AppCard style={styles.card}>
            <ReviewRow label="GRN" value={String(qi.goodsReceiptNumber || '—')} />
            <ReviewRow label="PO" value={String(qi.purchaseOrderNumber || '—')} />
            <ReviewRow label="Vendor" value={String(qi.vendorName || '—')} />
            <ReviewRow
              label="Date"
              value={formatDate(String(qi.inspectionDate || qi.createdAt || '')) || '—'}
            />
            {qi.decisionCode ? (
              <ReviewRow label="Decision" value={String(qi.decisionCode)} />
            ) : null}
          </AppCard>
        </FormSection>
        <FormSection title="Lines">
          {(qi.lines ?? []).map((l, i) => (
            <AppCard key={l.id || String(i)} style={styles.card}>
              <Text style={styles.lineCode}>
                {l.itemCodeSnapshot || l.itemCode || '—'}
              </Text>
              <Text style={styles.meta}>
                {l.itemNameSnapshot || l.itemName || '—'} · inspected{' '}
                {Number(l.inspectedQuantity ?? 0)} · acc {Number(l.acceptedQuantity ?? 0)} · rej{' '}
                {Number(l.rejectedQuantity ?? 0)}
              </Text>
            </AppCard>
          ))}
          {(qi.lines ?? []).length === 0 ? (
            <Text style={styles.meta}>No line detail returned for this inspection.</Text>
          ) : null}
        </FormSection>

        {canAct || canStart ? (
          <>
            <Text style={styles.label}>Remarks</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Optional notes for decision"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
            <Text style={styles.hint}>
              ACCEPT / REJECT runs purchase.qi lifecycle routes. Photos remain available in the
              Quality module when required.
            </Text>
          </>
        ) : null}

        {canStart ? (
          <SecondaryButton
            title={busy ? 'Working…' : 'Start inspection'}
            onPress={() => void run('start')}
            disabled={busy}
            style={styles.cta}
          />
        ) : null}
        {canAct ? (
          <>
            <PrimaryButton
              title={busy ? 'Working…' : 'Accept (PASS)'}
              onPress={() => void run('accept')}
              disabled={busy}
              style={styles.cta}
            />
            <SecondaryButton
              title={busy ? 'Working…' : 'Reject (FAIL)'}
              onPress={() => void run('reject')}
              disabled={busy}
              style={styles.cta}
            />
            {canEdit ? (
              <SecondaryButton
                title={busy ? 'Working…' : 'Hold'}
                onPress={() => void run('hold')}
                disabled={busy}
                style={styles.cta}
              />
            ) : null}
          </>
        ) : null}

        {canCreateReturn && String(qi.status || '').toUpperCase() === 'REJECTED' ? (
          <SecondaryButton
            title="Create purchase return"
            onPress={() =>
              router.push(
                `/(app)/purchase/returns/create?qiId=${encodeURIComponent(qiId)}` as never,
              )
            }
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
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    color: colors.text,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginVertical: spacing.md,
    lineHeight: 18,
  },
  cta: { marginTop: spacing.sm },
})
