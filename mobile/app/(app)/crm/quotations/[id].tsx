import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  ConfirmDialog,
  FormSection,
  Loading,
  PrimaryButton,
  ReviewRow,
  SecondaryButton,
  StatusChip,
} from '@/components'
import { useInvalidateCrm, useQuotation } from '@/features/crm/hooks'
import { approveQuotationDocument, convertQuotationToSalesOrder } from '@/api/crmApi'
import {
  pickLatestQuotationDocument,
  quotationAmount,
  quotationDisplayCode,
  quotationDisplayCustomer,
  quotationDisplayOwner,
  quotationLineDisplayLabel,
  looksLikeUuid,
} from '@/features/crm/commercialMap'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { ContextualActionsSheet } from '@/features/crm/components/ContextualActionsSheet'
import { EntityMissingState } from '@/features/crm/components/EntityMissingState'
import { colors, layout, spacing, typography } from '@/theme'
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
  const [busyApprove, setBusyApprove] = useState(false)
  const [busyConvert, setBusyConvert] = useState(false)
  const [confirmConvert, setConfirmConvert] = useState(false)

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
  const latest = pickLatestQuotationDocument(docs)
  const amount = quotationAmount(data)
  const code = quotationDisplayCode(data)
  const customer = quotationDisplayCustomer(data)
  const owner = quotationDisplayOwner(data) || '—'
  const customerId = data.customerId || data.companyId
  const validUntil = data.validUntil || data.expiryDate || data.validityDate
  const docStatus = titleCaseLabel(latest?.status || data.status || '—')
  const headerStatus = titleCaseLabel(data.status || latest?.status || '—')
  const alreadyConverted = Boolean(data.salesOrderId || latest?.salesOrderId)
  const soId = data.salesOrderId || latest?.salesOrderId || null
  const soNoRaw = data.salesOrderNo || latest?.salesOrderNo || null
  const soNo = soNoRaw && !looksLikeUuid(soNoRaw) ? String(soNoRaw) : null
  const canApprove =
    Boolean(latest?.id) &&
    String(latest?.status || '').toLowerCase() === 'pending_approval' &&
    (can('crm.quotation.approve') || can('tenant.manage'))
  const canConvert =
    !alreadyConverted && (can('crm.quotation.convert') || can('tenant.manage'))
  const priceLines = latest?.priceLines ?? []
  const freight = Number(latest?.freightAmount ?? 0)
  const installation = Number(latest?.installationAmount ?? 0)
  const customCharges = Number(latest?.customCharges ?? 0)
  const orderDiscount = Number(latest?.orderDiscountAmount ?? 0)
  const pricing = data.pricing

  const openPdf = () => router.push(`/(app)/crm/pdf/quotation/${qid}`)

  const approve = async () => {
    if (!latest?.id) {
      Alert.alert('Unavailable', 'No quotation document to approve.')
      return
    }
    if (!can('crm.quotation.approve') && !can('tenant.manage')) {
      Alert.alert('Permission denied', 'You cannot approve quotations.')
      return
    }
    if (String(latest.status || '').toLowerCase() !== 'pending_approval') {
      Alert.alert(
        'Not ready',
        `Document must be pending approval (current: ${latest.status || 'unknown'}).`,
      )
      return
    }
    setBusyApprove(true)
    try {
      await approveQuotationDocument(qid, latest.id)
      invalidate()
      await refetch()
      Alert.alert('Approved', 'Quotation document approved.')
    } catch (e) {
      Alert.alert('Approve failed', getUserFriendlyMessage(e))
    } finally {
      setBusyApprove(false)
    }
  }

  const convert = async () => {
    if (!can('crm.quotation.convert') && !can('tenant.manage')) {
      Alert.alert('Permission denied', 'You cannot convert quotations.')
      return
    }
    if (alreadyConverted && soId) {
      router.push(`/(app)/crm/sales-orders/${soId}`)
      return
    }
    setBusyConvert(true)
    try {
      const res = await convertQuotationToSalesOrder(qid)
      invalidate()
      const newSoId = res.data?.salesOrderId
      if (!newSoId) {
        Alert.alert('Converted', 'Sales order created. Open Sales Orders to view it.')
        router.push('/(app)/crm/sales-orders')
        return
      }
      Alert.alert('Converted', `Sales order ${res.data.salesOrderNo || newSoId}`)
      router.push(`/(app)/crm/sales-orders/${newSoId}`)
    } catch (e) {
      Alert.alert('Convert failed', getUserFriendlyMessage(e))
    } finally {
      setBusyConvert(false)
      setConfirmConvert(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={code}
        subtitle={customer}
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => setSheet(true)} hitSlop={8}>
            <Text style={styles.link}>Actions</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppCard>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroCustomer}>{customer}</Text>
              <Text style={styles.heroAmount}>{formatMoney(amount)}</Text>
            </View>
            <StatusChip label={String(headerStatus)} tone={statusTone(headerStatus)} />
          </View>
          {String(docStatus) !== String(headerStatus) ? (
            <Text style={styles.meta}>Document: {String(docStatus)}</Text>
          ) : null}
          {latest ? (
            <Text style={styles.meta}>
              Revision R{latest.revisionNo ?? data.revisionNo ?? 1}
              {docs.length > 1 ? ` · ${docs.length} documents` : ''}
            </Text>
          ) : (
            <Text style={styles.meta}>No commercial document attached</Text>
          )}
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton title="View PDF" onPress={openPdf} fullWidth />
          {canApprove ? (
            <PrimaryButton
              title="Approve"
              onPress={() => void approve()}
              loading={busyApprove}
              fullWidth
            />
          ) : null}
          {alreadyConverted && soId ? (
            <SecondaryButton
              title={soNo ? `Open SO ${soNo}` : 'Open sales order'}
              onPress={() => router.push(`/(app)/crm/sales-orders/${soId}`)}
              fullWidth
            />
          ) : (
            <SecondaryButton
              title="Convert to sales order"
              onPress={() => {
                if (!canConvert) {
                  Alert.alert('Permission denied', 'You cannot convert quotations.')
                  return
                }
                setConfirmConvert(true)
              }}
              disabled={!canConvert || busyConvert}
              fullWidth
            />
          )}
        </View>

        <FormSection title="Summary">
          <ReviewRow label="Quotation" value={code} />
          <ReviewRow label="Customer" value={customer} />
          <ReviewRow label="Status" value={headerStatus} />
          <ReviewRow label="Valid until" value={formatDate(validUntil)} />
          <ReviewRow label="Sales owner" value={owner} />
          <ReviewRow
            label="Opportunity"
            value={
              data.opportunityNo && !looksLikeUuid(data.opportunityNo)
                ? String(data.opportunityNo)
                : data.opportunityId
                  ? 'Linked'
                  : '—'
            }
          />
          <ReviewRow
            label="Customer approval"
            value={data.customerApproval ? titleCaseLabel(String(data.customerApproval)) : '—'}
          />
          <ReviewRow
            label="Sales order"
            value={soNo || (alreadyConverted ? 'Converted' : 'Not converted')}
            last
          />
        </FormSection>

        {priceLines.length > 0 ? (
          <FormSection title="Line items" description={`${priceLines.length} line(s)`}>
            {priceLines.map((line, index) => {
              const isLast = index === priceLines.length - 1
              const qty = Number(line.qty ?? 0)
              const uom = line.uom ? ` ${line.uom}` : ''
              const unit = formatMoney(line.unitPrice ?? null)
              const disc =
                line.discountPct != null && Number(line.discountPct) > 0
                  ? ` · ${Number(line.discountPct)}% off`
                  : ''
              const tax =
                line.taxPct != null && Number(line.taxPct) > 0
                  ? ` · GST ${Number(line.taxPct)}%`
                  : ''
              const optional = line.isOptional ? ' (optional)' : ''
              return (
                <View key={String(line.id || index)} style={[styles.lineBlock, !isLast && styles.lineBorder]}>
                  <Text style={styles.lineTitle}>
                    {quotationLineDisplayLabel(line as Record<string, unknown>)}
                    {optional}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {qty}
                    {uom} × {unit}
                    {disc}
                    {tax}
                  </Text>
                  <Text style={styles.lineTotal}>{formatMoney(line.lineTotal ?? null)}</Text>
                </View>
              )
            })}
          </FormSection>
        ) : null}

        <FormSection title="Commercial totals">
          {pricing?.subtotal != null ? (
            <ReviewRow label="Subtotal" value={formatMoney(pricing.subtotal)} />
          ) : null}
          {orderDiscount > 0 ? (
            <ReviewRow label="Order discount" value={`−${formatMoney(orderDiscount)}`} />
          ) : null}
          {freight > 0 ? <ReviewRow label="Freight" value={formatMoney(freight)} /> : null}
          {installation > 0 ? (
            <ReviewRow label="Installation" value={formatMoney(installation)} />
          ) : null}
          {customCharges > 0 ? (
            <ReviewRow label="Other charges" value={formatMoney(customCharges)} />
          ) : null}
          {pricing?.gstAmount != null && Number(pricing.gstAmount) > 0 ? (
            <ReviewRow
              label={pricing.gstPct != null ? `GST (${pricing.gstPct}%)` : 'GST'}
              value={formatMoney(pricing.gstAmount)}
            />
          ) : null}
          <ReviewRow label="Grand total" value={formatMoney(amount)} last />
        </FormSection>

        {data.paymentTerms || data.deliveryTerms || data.deliveryTime || data.terms ? (
          <FormSection title="Terms">
            {data.paymentTerms ? <ReviewRow label="Payment" value={String(data.paymentTerms)} /> : null}
            {data.deliveryTerms ? (
              <ReviewRow label="Delivery" value={String(data.deliveryTerms)} />
            ) : null}
            {data.deliveryTime ? (
              <ReviewRow label="Delivery time" value={String(data.deliveryTime)} />
            ) : null}
            {data.terms ? (
              <ReviewRow label="Terms" value={String(data.terms)} last={!latest?.commercialNotes} />
            ) : null}
            {latest?.commercialNotes ? (
              <ReviewRow label="Commercial notes" value={String(latest.commercialNotes)} last />
            ) : null}
          </FormSection>
        ) : null}

        {customerId ? (
          <Pressable
            style={styles.linkCard}
            onPress={() => router.push(`/(app)/crm/companies/${customerId}`)}
          >
            <Text style={styles.secondaryText}>Open customer 360</Text>
          </Pressable>
        ) : null}

        <Text style={styles.hint}>
          View PDF loads the server-stored quotation export. Approve requires pending approval.
          Convert creates a sales order from this quotation.
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmConvert}
        title="Convert to sales order?"
        message={`Create a sales order from ${code} for ${customer}?`}
        confirmLabel="Convert"
        loading={busyConvert}
        onCancel={() => !busyConvert && setConfirmConvert(false)}
        onConfirm={() => void convert()}
      />

      <ContextualActionsSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Quotation actions"
        actions={[
          {
            key: 'pdf',
            label: 'View PDF',
            onPress: openPdf,
          },
          {
            key: 'share',
            label: 'Share / Download PDF',
            onPress: openPdf,
          },
          {
            key: 'approve',
            label: canApprove ? 'Approve document' : 'Approve (not available)',
            onPress: () => void approve(),
            disabled: !canApprove || busyApprove,
          },
          {
            key: 'convert',
            label: alreadyConverted ? 'Open sales order' : 'Convert to sales order',
            onPress: () => {
              if (alreadyConverted && soId) {
                router.push(`/(app)/crm/sales-orders/${soId}`)
                return
              }
              if (!canConvert) {
                Alert.alert('Permission denied', 'You cannot convert quotations.')
                return
              }
              setConfirmConvert(true)
            },
            disabled: busyConvert || (!alreadyConverted && !canConvert),
          },
          ...(customerId
            ? [
                {
                  key: 'customer',
                  label: 'Open customer',
                  onPress: () => router.push(`/(app)/crm/companies/${customerId}`),
                },
              ]
            : []),
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroCopy: { flex: 1, minWidth: 0 },
  heroCustomer: { ...typography.caption, color: colors.textMuted },
  heroAmount: {
    ...typography.metric,
    fontSize: 28,
    marginTop: spacing.xs,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  meta: { ...typography.caption, marginTop: spacing.sm, color: colors.textMuted },
  actions: { gap: spacing.sm },
  lineBlock: { paddingVertical: spacing.md },
  lineBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  lineTitle: { ...typography.bodyStrong },
  lineMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  lineTotal: {
    ...typography.bodyStrong,
    marginTop: spacing.xs,
    color: colors.primary,
    textAlign: 'right',
  },
  linkCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: { ...typography.bodyStrong, color: colors.primary },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '700' },
})
