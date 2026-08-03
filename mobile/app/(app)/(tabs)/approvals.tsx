import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
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
import { formatMoney, statusTone } from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import { usePermissions } from '@/auth/permissions'
import { Ionicons } from '@expo/vector-icons'

export default function ApprovalsScreen() {
  const dash = useCrmDashboard()
  const pending = dash.data?.panels?.pendingApprovalQuotations ?? []
  const { can } = usePermissions()
  const invalidate = useInvalidateCrm()
  const router = useRouter()

  const onApprove = async (quotationId: string, docId: string) => {
    if (!can('crm.quotation.approve') && !can('tenant.manage')) {
      Alert.alert('Permission denied', 'You cannot approve quotations.')
      return
    }
    try {
      await approveQuotationDocument(quotationId, docId)
      invalidate()
      Alert.alert('Approved', 'Quotation document approved.')
    } catch (e) {
      Alert.alert('Approve failed', getUserFriendlyMessage(e))
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Approvals"
        subtitle={pending.length === 1 ? '1 pending' : `${pending.length} pending`}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hintRow}>
          <View style={styles.hintIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.hint}>
            Review commercial documents before they leave the team. Approve or open for detail.
          </Text>
        </View>
        {dash.isLoading ? <Loading /> : null}
        {dash.error ? <ErrorState error={dash.error} onRetry={() => void dash.refetch()} /> : null}
        {pending.map((raw) => {
          const row = raw as Record<string, unknown>
          const quotationId = String(row.quotationId || row.id)
          const docId = String(row.id)
          return (
            <AppCard key={docId} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBadge}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.title}>{String(row.quotationCode || 'Quotation')}</Text>
                  <Text style={styles.meta}>{String(row.customerName || '—')}</Text>
                </View>
                <StatusChip label={String(row.status || 'pending')} tone={statusTone(String(row.status))} compact />
              </View>
              <Text style={styles.amount}>{formatMoney(Number(row.totalAmount ?? 0))}</Text>
              <View style={styles.row}>
                <PrimaryButton
                  title="Approve"
                  onPress={() => void onApprove(quotationId, docId)}
                  style={styles.btn}
                />
                <SecondaryButton
                  title="View"
                  onPress={() => {
                    if (!quotationId || quotationId === 'undefined' || quotationId === 'null') {
                      Alert.alert('Unavailable', 'This approval row is missing a quotation id.')
                      return
                    }
                    router.push(`/(app)/crm/quotations/${quotationId}`)
                  }}
                  style={styles.btn}
                />
              </View>
            </AppCard>
          )
        })}
        {!dash.isLoading && pending.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="No quotation approvals waiting. New requests will show up here."
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
  title: { ...typography.bodyStrong, fontSize: 16 },
  meta: { ...typography.caption, marginTop: 3 },
  amount: {
    ...typography.metric,
    fontSize: 24,
    marginTop: spacing.lg,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, minHeight: 48 },
})
