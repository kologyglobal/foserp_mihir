import { useState } from 'react'
import {
  Alert,
  Modal,
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
  FormSection,
  PrimaryButton,
  ReviewRow,
  SecondaryButton,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { ApiError, getUserFriendlyMessage } from '@/api/errors'
import { usePermissions } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import {
  approvePurchaseDocument,
  canViewGrns,
  canViewPurchaseOrders,
  canViewPurchaseRequisitions,
  rejectPurchaseDocument,
  shouldShowApproveAction,
  shouldShowRejectAction,
} from '@/features/purchase/api'
import {
  useInvalidatePurchase,
  usePurchaseApproval,
  usePurchaseApprovalsAccess,
} from '@/features/purchase/hooks'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function PurchaseApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const approvalId = String(id || '')
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const purchaseModuleOn = isModuleEnabled('purchase', profile?.modules)
  const { enabled } = usePurchaseApprovalsAccess()
  const { permissions } = usePermissions()
  const q = usePurchaseApproval(approvalId)
  const invalidate = useInvalidatePurchase()

  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [rejectError, setRejectError] = useState('')

  if (!purchaseModuleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Approval" onBack={() => router.back()} />
        <EmptyState
          title="Purchase module disabled"
          description="This organisation does not have the purchase module enabled."
          icon="ban-outline"
        />
      </View>
    )
  }

  if (!enabled) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Approval" onBack={() => router.back()} />
        <EmptyState
          title="Not authorised"
          description="You are not authorised to view purchase approvals."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (!approvalId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Approval" onBack={() => router.back()} />
        <EmptyState title="Missing approval" description="No approval id in the route." />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Approval" onBack={() => router.back()} />
        <View style={styles.scroll}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    )
  }

  if (q.error || !q.data?.row) {
    const forbidden =
      q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)
    return (
      <View style={styles.flex}>
        <AppHeader title="Approval" onBack={() => router.back()} />
        <ErrorState
          title={forbidden ? 'Not authorised' : 'Could not load approval'}
          error={
            forbidden
              ? new Error('You are not authorised to view this approval.')
              : q.error ?? new Error('Approval not found.')
          }
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const detail = q.data
  const row = detail.row
  const showApprove = shouldShowApproveAction(row, permissions)
  const showReject = shouldShowRejectAction(row, permissions)
  const lines = detail.lines ?? []
  const history = detail.previousApprovals ?? []

  const onApprove = async () => {
    if (!showApprove) {
      Alert.alert('Not authorised', 'You are not authorised to approve this document.')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      await approvePurchaseDocument(row.documentType, row.documentId)
      invalidate()
      await q.refetch()
      Alert.alert('Approved', `${row.documentNumber || 'Document'} approved.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      Alert.alert('Approve failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onRejectConfirm = async () => {
    const remarks = rejectRemarks.trim()
    if (!remarks) {
      setRejectError('Remarks are required to reject.')
      return
    }
    if (!showReject) {
      Alert.alert('Not authorised', 'You are not authorised to reject this document.')
      return
    }
    if (busy) return
    setBusy(true)
    setRejectError('')
    try {
      await rejectPurchaseDocument(row.documentType, row.documentId, remarks)
      invalidate()
      setRejectOpen(false)
      setRejectRemarks('')
      await q.refetch()
      Alert.alert('Rejected', `${row.documentNumber || 'Document'} rejected.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      Alert.alert('Reject failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={row.documentNumber || 'Approval'}
        subtitle={row.documentTypeLabel || titleCaseLabel(row.documentType)}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppCard>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>{row.documentTypeLabel}</Text>
              <Text style={styles.heroAmount}>{formatMoney(row.amount)}</Text>
            </View>
            <StatusChip
              label={row.statusLabel || titleCaseLabel(row.status) || 'Pending'}
              tone={statusTone(row.status)}
            />
          </View>
          {row.approvalLevelLabel ? (
            <Text style={styles.meta}>{row.approvalLevelLabel}</Text>
          ) : null}
          {row.priorityLabel ? (
            <Text style={styles.meta}>Priority: {row.priorityLabel}</Text>
          ) : null}
        </AppCard>

        {row.documentType === 'purchase_requisition' && row.documentId ? (
          canViewPurchaseRequisitions(permissions) ? (
            <SecondaryButton
              title="Open purchase requisition"
              onPress={() =>
                router.push(`/(app)/purchase/requisitions/${row.documentId}` as never)
              }
              style={styles.linkBtn}
            />
          ) : (
            <Text style={styles.infoBanner}>
              You can approve this document but do not have purchase.pr.view to open the full PR.
            </Text>
          )
        ) : null}
        {row.documentType === 'purchase_order' && row.documentId ? (
          canViewPurchaseOrders(permissions) ? (
            <SecondaryButton
              title="Open purchase order"
              onPress={() =>
                router.push(`/(app)/purchase/purchase-orders/${row.documentId}` as never)
              }
              style={styles.linkBtn}
            />
          ) : (
            <Text style={styles.infoBanner}>
              You can approve this document but do not have purchase.po.view to open the full PO.
            </Text>
          )
        ) : null}
        {row.documentType === 'goods_receipt_note' && row.documentId ? (
          canViewGrns(permissions) ? (
            <SecondaryButton
              title="Open goods receipt"
              onPress={() => router.push(`/(app)/purchase/grn/${row.documentId}` as never)}
              style={styles.linkBtn}
            />
          ) : (
            <Text style={styles.infoBanner}>
              You can act on this approval but do not have purchase.grn.view to open the GRN.
            </Text>
          )
        ) : null}

        {(showApprove || showReject) && (
          <View style={styles.actions}>
            {showApprove ? (
              <PrimaryButton
                title="Approve"
                onPress={() => void onApprove()}
                loading={busy && !rejectOpen}
                disabled={busy}
                fullWidth
              />
            ) : null}
            {showReject ? (
              <SecondaryButton
                title="Reject"
                onPress={() => {
                  setRejectError('')
                  setRejectOpen(true)
                }}
                disabled={busy}
                fullWidth
              />
            ) : null}
          </View>
        )}

        {!showApprove && !showReject && String(row.status).toLowerCase() === 'pending' ? (
          <Text style={styles.infoBanner}>
            This item is pending but you cannot act on it (assigned to another approver, self-approval
            blocked, or missing act permission).
          </Text>
        ) : null}

        <FormSection title="Summary">
          <ReviewRow label="Document" value={row.documentNumber || '—'} />
          <ReviewRow label="Requested by" value={row.requestedBy || '—'} />
          <ReviewRow label="Department" value={row.department || '—'} />
          <ReviewRow label="Location / vendor" value={row.locationName || '—'} />
          <ReviewRow label="Document date" value={formatDate(row.documentDate)} />
          <ReviewRow label="Submitted" value={formatDate(row.submittedDate)} />
          {detail.expectedDeliveryDate ? (
            <ReviewRow label="Expected delivery" value={formatDate(detail.expectedDeliveryDate)} />
          ) : null}
          {detail.purpose ? <ReviewRow label="Purpose" value={detail.purpose} /> : null}
          {detail.requesterRemarks ? (
            <ReviewRow label="Requester remarks" value={detail.requesterRemarks} />
          ) : null}
        </FormSection>

        {lines.length > 0 ? (
          <FormSection title={`Lines (${lines.length})`}>
            {lines.map((line) => (
              <AppCard key={`${line.lineNo}-${line.itemCode}`} style={styles.lineCard}>
                <Text style={styles.lineTitle}>
                  {line.lineNo}. {line.itemName || line.itemCode || 'Item'}
                </Text>
                <Text style={styles.lineMeta}>
                  {line.itemCode ? `${line.itemCode} · ` : ''}
                  {line.quantity} {line.uom || ''}
                  {line.rate != null ? ` @ ${formatMoney(line.rate)}` : ''}
                </Text>
                <Text style={styles.lineAmount}>{formatMoney(line.amount)}</Text>
              </AppCard>
            ))}
          </FormSection>
        ) : null}

        {history.length > 0 ? (
          <FormSection title="History">
            {history.map((h) => (
              <AppCard key={h.id} style={styles.lineCard}>
                <Text style={styles.lineTitle}>{titleCaseLabel(h.action)}</Text>
                <Text style={styles.lineMeta}>
                  {h.actorName || '—'}
                  {h.actedAt ? ` · ${formatDate(h.actedAt)}` : ''}
                </Text>
                {h.remarks ? <Text style={styles.lineMeta}>{h.remarks}</Text> : null}
              </AppCard>
            ))}
          </FormSection>
        ) : null}
      </ScrollView>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => !busy && setRejectOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => !busy && setRejectOpen(false)} />
        <View style={styles.modalCenter}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject document</Text>
            <Text style={styles.modalMessage}>
              Rejection remarks are mandatory. They are recorded on the document history.
            </Text>
            <TextInput
              value={rejectRemarks}
              onChangeText={(t) => {
                setRejectRemarks(t)
                if (rejectError) setRejectError('')
              }}
              placeholder="Reason for rejection"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              style={[styles.textarea, rejectError ? styles.textareaError : null]}
              editable={!busy}
              textAlignVertical="top"
            />
            {rejectError ? <Text style={styles.fieldError}>{rejectError}</Text> : null}
            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => !busy && setRejectOpen(false)}
                style={styles.modalBtn}
                disabled={busy}
              />
              <SecondaryButton
                title="Reject"
                onPress={() => void onRejectConfirm()}
                destructive
                style={styles.modalBtn}
                disabled={busy}
              />
            </View>
            {busy ? <Text style={styles.busyHint}>Submitting…</Text> : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroCopy: { flex: 1, minWidth: 0 },
  heroLabel: { ...typography.caption, color: colors.textSecondary },
  heroAmount: { ...typography.metric, fontSize: 26, color: colors.primary, marginTop: 4 },
  meta: { ...typography.caption, marginTop: spacing.xs, color: colors.textMuted },
  actions: { gap: spacing.sm, marginVertical: spacing.lg },
  infoBanner: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  linkBtn: { marginBottom: spacing.md },
  lineCard: { marginBottom: spacing.sm },
  lineTitle: { ...typography.bodyStrong, fontSize: 15 },
  lineMeta: { ...typography.caption, marginTop: 2, color: colors.textSecondary },
  lineAmount: { ...typography.bodyStrong, marginTop: spacing.xs, color: colors.primary },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  modalTitle: { ...typography.subtitle, marginBottom: spacing.sm },
  modalMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 110,
    marginBottom: spacing.sm,
  },
  textareaError: { borderColor: colors.danger, backgroundColor: colors.dangerMuted },
  fieldError: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: { flex: 1 },
  busyHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
})
