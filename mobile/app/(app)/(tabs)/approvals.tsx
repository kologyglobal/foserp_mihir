/**
 * Approvals tab — unified inbox:
 * - CRM quotation approvals (existing)
 * - Purchase approval queue rows (independent fetch; failure isolated)
 */
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
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
import { useCrmDashboard, useInvalidateCrm } from '@/features/crm/hooks'
import { approveQuotationDocument } from '@/api/crmApi'
import { formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { canAny } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import { usePermissions } from '@/auth/permissions'
import { useSessionStore } from '@/store/sessionStore'
import { getUserFriendlyMessage } from '@/api/errors'
import {
  approvePurchaseDocument,
  shouldShowApproveAction,
  type PurchaseApprovalQueueRow,
} from '@/features/purchase/api'
import {
  useInvalidatePurchase,
  usePurchaseApprovals,
  usePurchaseApprovalsAccess,
} from '@/features/purchase/hooks'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function ApprovalsScreen() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const crmOn =
    perms != null &&
    isModuleEnabled('crm', profile?.modules) &&
    canAny(['crm.quotation.view', 'crm.quotation.approve'], perms)

  const dash = useCrmDashboard()
  const pendingQuotes = crmOn ? dash.data?.panels?.pendingApprovalQuotations ?? [] : []
  const { can, permissions } = usePermissions()
  const invalidateCrm = useInvalidateCrm()
  const invalidatePurchase = useInvalidatePurchase()
  const router = useRouter()

  const { enabled: purchaseOn } = usePurchaseApprovalsAccess()
  const purchaseQ = usePurchaseApprovals('pending_mine')
  const purchaseRows = purchaseOn ? purchaseQ.data ?? [] : []

  const [busyApproveId, setBusyApproveId] = useState<string | null>(null)

  const onApproveQuote = async (quotationId: string, docId: string) => {
    if (!can('crm.quotation.approve') && !can('tenant.manage')) {
      Alert.alert('Not authorised', 'You are not authorised to perform this action.')
      return
    }
    try {
      await approveQuotationDocument(quotationId, docId)
      invalidateCrm()
      Alert.alert('Approved', 'Quotation document approved.')
    } catch (e) {
      Alert.alert('Approve failed', getUserFriendlyMessage(e))
    }
  }

  const onApprovePurchase = async (row: PurchaseApprovalQueueRow) => {
    if (!shouldShowApproveAction(row, permissions)) {
      Alert.alert('Not authorised', 'You are not authorised to approve this document.')
      return
    }
    const key = row.approvalId || row.documentId
    if (busyApproveId) return
    setBusyApproveId(key)
    try {
      await approvePurchaseDocument(row.documentType, row.documentId)
      invalidatePurchase()
      await purchaseQ.refetch()
      Alert.alert('Approved', `${row.documentNumber || 'Document'} approved.`)
    } catch (e) {
      Alert.alert('Approve failed', getUserFriendlyMessage(e))
    } finally {
      setBusyApproveId(null)
    }
  }

  const crmLoading = crmOn && dash.isLoading
  const purchaseLoading = purchaseOn && purchaseQ.isLoading
  const loading = crmLoading || purchaseLoading
  const total = pendingQuotes.length + purchaseRows.length

  const subtitle = (() => {
    if (loading) return 'Loading…'
    if (total === 0) return 'Nothing pending'
    const parts: string[] = []
    if (crmOn) parts.push(`${pendingQuotes.length} CRM`)
    if (purchaseOn) parts.push(`${purchaseRows.length} purchase`)
    return parts.join(' · ') || 'Nothing pending'
  })()

  return (
    <View style={styles.flex}>
      <AppHeader title="Approvals" subtitle={subtitle} showBack={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hintRow}>
          <View style={styles.hintIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.hint}>
            Review CRM quotations and purchase documents waiting for your sign-off. Sources load
            independently — one failure will not hide the others.
          </Text>
        </View>

        {purchaseOn ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Purchase</Text>
              <SecondaryButton
                title="Open queue"
                onPress={() => router.push('/(app)/purchase/approvals' as never)}
                style={styles.sectionBtn}
              />
            </View>
            {purchaseLoading ? <Loading /> : null}
            {purchaseQ.error ? (
              <ErrorState error={purchaseQ.error} onRetry={() => void purchaseQ.refetch()} />
            ) : null}
            {!purchaseLoading && !purchaseQ.error && purchaseRows.length === 0 && total > 0 ? (
              <Text style={styles.emptyLine}>No purchase approvals pending for you.</Text>
            ) : null}
            {!purchaseLoading && !purchaseQ.error
              ? purchaseRows.map((row) => {
                  const key = row.approvalId || `${row.documentType}-${row.documentId}`
                  const canActUi = shouldShowApproveAction(row, permissions)
                  return (
                    <AppCard key={`po-${key}`} style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.iconBadge}>
                          <Ionicons name="cart-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.cardCopy}>
                          <Text style={styles.source}>Purchase</Text>
                          <Text style={styles.title}>{row.documentNumber || '—'}</Text>
                          <Text style={styles.meta}>
                            {row.documentTypeLabel || titleCaseLabel(row.documentType)}
                            {row.requestedBy ? ` · ${row.requestedBy}` : ''}
                          </Text>
                        </View>
                        <StatusChip
                          label={row.statusLabel || titleCaseLabel(row.status) || 'Pending'}
                          tone={statusTone(row.status)}
                          compact
                        />
                      </View>
                      <Text style={styles.amount}>{formatMoney(row.amount)}</Text>
                      <View style={styles.row}>
                        {canActUi ? (
                          <PrimaryButton
                            title="Approve"
                            onPress={() => void onApprovePurchase(row)}
                            style={styles.btn}
                            loading={busyApproveId === key}
                            disabled={busyApproveId != null}
                          />
                        ) : null}
                        <SecondaryButton
                          title="Review"
                          onPress={() =>
                            router.push(
                              `/(app)/purchase/approvals/${row.approvalId || row.documentId}` as never,
                            )
                          }
                          style={styles.btn}
                          disabled={busyApproveId != null}
                        />
                      </View>
                    </AppCard>
                  )
                })
              : null}
          </>
        ) : null}

        {crmOn ? (
          <>
            <Text style={styles.section}>CRM quotations</Text>
            {crmLoading ? <Loading /> : null}
            {dash.error ? <ErrorState error={dash.error} onRetry={() => void dash.refetch()} /> : null}
            {!crmLoading && !dash.error && pendingQuotes.length === 0 && total > 0 ? (
              <Text style={styles.emptyLine}>No CRM quotations pending approval.</Text>
            ) : null}
            {!crmLoading && !dash.error
              ? pendingQuotes.map((raw) => {
                  const row = raw as Record<string, unknown>
                  const quotationId = String(row.quotationId || row.id)
                  const docId = String(row.id)
                  return (
                    <AppCard key={`crm-${docId}`} style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.iconBadge}>
                          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.cardCopy}>
                          <Text style={styles.source}>CRM</Text>
                          <Text style={styles.title}>{String(row.quotationCode || 'Quotation')}</Text>
                          <Text style={styles.meta}>{String(row.customerName || '—')}</Text>
                        </View>
                        <StatusChip
                          label={String(row.status || 'pending')}
                          tone={statusTone(String(row.status))}
                          compact
                        />
                      </View>
                      <Text style={styles.amount}>{formatMoney(Number(row.totalAmount ?? 0))}</Text>
                      <View style={styles.row}>
                        <PrimaryButton
                          title="Approve"
                          onPress={() => void onApproveQuote(quotationId, docId)}
                          style={styles.btn}
                        />
                        <SecondaryButton
                          title="View"
                          onPress={() => router.push(`/(app)/crm/quotations/${quotationId}`)}
                          style={styles.btn}
                        />
                      </View>
                    </AppCard>
                  )
                })
              : null}
          </>
        ) : null}

        {!purchaseOn && !crmOn ? (
          <EmptyState
            title="No approval access"
            description={
              perms == null
                ? 'Permissions still loading or unavailable.'
                : 'Ask your administrator for CRM quotation or purchase approval access.'
            }
            icon="lock-closed-outline"
          />
        ) : null}

        {!loading && total === 0 && (purchaseOn || crmOn) ? (
          <EmptyState
            title="You're all caught up"
            description="No documents waiting for your approval."
            icon="checkmark-circle-outline"
            success
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  hintRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primarySoft,
  },
  hintIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { ...typography.caption, flex: 1, color: colors.textSecondary, lineHeight: 19, paddingTop: 6 },
  section: { ...typography.bodyStrong, marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionBtn: { minHeight: 40, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  emptyLine: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  source: { ...typography.micro, color: colors.primary, fontWeight: '700' },
  title: { ...typography.bodyStrong, fontSize: 16 },
  meta: { ...typography.caption, marginTop: 3 },
  amount: {
    ...typography.metric,
    fontSize: 22,
    marginTop: spacing.md,
    color: colors.primary,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  btn: { flex: 1, minHeight: 48, minWidth: 90 },
})
