import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppCard, AppHeader, Loading, PrimaryButton, StatusChip } from '@/components'
import { useInvalidateCrm, useQuotation } from '@/features/crm/hooks'
import { approveQuotationDocument, convertQuotationToSalesOrder } from '@/api/crmApi'
import { quotationAmount } from '@/features/crm/commercialMap'
import { formatMoney, statusTone } from '@/features/crm/utils'
import { ContextualActionsSheet } from '@/features/crm/components/ContextualActionsSheet'
import { EntityMissingState } from '@/features/crm/components/EntityMissingState'
import { colors, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import { usePermissions } from '@/auth/permissions'

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qid = String(id || '')
  const { data, isLoading, error, refetch } = useQuotation(qid)
  const { can } = usePermissions()
  const invalidate = useInvalidateCrm()
  const router = useRouter()
  const [sheet, setSheet] = useState(false)

  if (!qid) {
    return <EntityMissingState title="Quotation" entityLabel="quotation" />
  }
  if (isLoading) return <Loading fullScreen />
  if (error || !data) {
    return (
      <EntityMissingState
        title="Quotation"
        entityLabel="quotation"
        error={error ?? new Error('Not found')}
        onRetry={() => void refetch()}
      />
    )
  }

  const docs = data.documents ?? []
  const latest = docs[docs.length - 1]

  const approve = async () => {
    if (!latest) return
    if (!can('crm.quotation.approve') && !can('tenant.manage')) {
      Alert.alert('Permission denied')
      return
    }
    try {
      await approveQuotationDocument(qid, latest.id)
      invalidate()
      Alert.alert('Approved')
    } catch (e) {
      Alert.alert('Failed', getUserFriendlyMessage(e))
    }
  }

  const convert = async () => {
    try {
      const res = await convertQuotationToSalesOrder(qid)
      invalidate()
      const soId = res.data?.salesOrderId
      if (!soId) {
        Alert.alert('Converted', 'Sales order created. Open Sales Orders to view it.')
        router.push('/(app)/crm/sales-orders')
        return
      }
      router.push(`/(app)/crm/sales-orders/${soId}`)
    } catch (e) {
      Alert.alert('Convert failed', getUserFriendlyMessage(e))
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={String(data.quotationCode || data.quotationNo || 'Quotation')}
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => setSheet(true)}>
            <Text style={styles.link}>Actions</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppCard>
          <Text style={styles.meta}>{data.customerName || data.companyName || '—'}</Text>
          <Text style={styles.value}>{formatMoney(quotationAmount(data))}</Text>
          <StatusChip label={data.status || latest?.status || '—'} tone={statusTone(data.status)} />
          <Text style={styles.meta}>Documents: {docs.length}</Text>
        </AppCard>
        <View style={styles.actions}>
          <PrimaryButton
            title="View PDF"
            onPress={() => router.push(`/(app)/crm/pdf/quotation/${qid}`)}
            fullWidth
          />
          {latest ? (
            <PrimaryButton title="Approve document" onPress={() => void approve()} fullWidth />
          ) : null}
          <Pressable style={styles.secondary} onPress={() => void convert()}>
            <Text style={styles.secondaryText}>Convert to sales order</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          PDF is loaded from server entity attachments (quotation_pdf). Mobile never generates PDFs.
        </Text>
      </ScrollView>

      <ContextualActionsSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Quotation actions"
        actions={[
          {
            key: 'pdf',
            label: 'View PDF',
            onPress: () => router.push(`/(app)/crm/pdf/quotation/${qid}`),
          },
          {
            key: 'share',
            label: 'Share / Download PDF',
            onPress: () => router.push(`/(app)/crm/pdf/quotation/${qid}`),
          },
          {
            key: 'approve',
            label: 'Approve',
            onPress: () => void approve(),
            disabled: !latest,
          },
          {
            key: 'convert',
            label: 'Convert to SO',
            onPress: () => void convert(),
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.md },
  value: { ...typography.title, marginVertical: spacing.sm },
  meta: { ...typography.caption },
  actions: { gap: spacing.sm },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { ...typography.bodyStrong, color: colors.primary },
  hint: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.caption, color: colors.primary, fontWeight: '700' },
})
