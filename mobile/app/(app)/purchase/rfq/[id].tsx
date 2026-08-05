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
  StatusChip,
} from '@/components'
import { purchaseFriendlyError } from '@/features/purchase/api'
import { sendRfq } from '@/features/purchase/phaseCApi'
import { useInvalidatePurchase, useRfqAccess, useRfqDetail } from '@/features/purchase/hooks'
import { formatDate, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, spacing, typography } from '@/theme'

export default function RfqDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const rfqId = String(id || '')
  const router = useRouter()
  const { moduleOn, canView, canSend } = useRfqAccess()
  const q = useRfqDetail(rfqId, canView && Boolean(rfqId))
  const invalidate = useInvalidatePurchase()
  const [busy, setBusy] = useState(false)

  if (!moduleOn || !canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="RFQ" onBack={() => router.back()} />
        <EmptyState
          title={!moduleOn ? 'Purchase module disabled' : 'Not authorised'}
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="RFQ" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !q.data) {
    return (
      <View style={styles.flex}>
        <AppHeader title="RFQ" onBack={() => router.back()} />
        <ErrorState
          title="Could not load RFQ"
          error={new Error(purchaseFriendlyError(q.error, 'Load failed'))}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const rfq = q.data
  const st = String(rfq.status || '').toUpperCase()
  const showSend = canSend && st === 'DRAFT'

  const onSend = async () => {
    setBusy(true)
    try {
      await sendRfq(rfqId, 'Sent from mobile')
      invalidate()
      await q.refetch()
      Alert.alert('Sent', 'RFQ sent to vendors.')
    } catch (e) {
      Alert.alert('Send failed', purchaseFriendlyError(e, 'Could not send RFQ'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title={rfq.rfqNumber || 'RFQ'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusChip label={titleCaseLabel(rfq.status) || '—'} tone={statusTone(rfq.status)} />
        <FormSection title="Summary">
          <AppCard style={styles.card}>
            <ReviewRow label="Title" value={rfq.title || '—'} />
            <ReviewRow label="Date" value={formatDate(rfq.rfqDate || undefined) || '—'} />
            <ReviewRow
              label="Response due"
              value={formatDate(rfq.responseDueDate || undefined) || '—'}
            />
            <ReviewRow label="PR" value={rfq.purchaseRequisitionNumber || '—'} />
            {rfq.remarks ? <ReviewRow label="Remarks" value={String(rfq.remarks)} /> : null}
          </AppCard>
        </FormSection>
        <FormSection title="Vendors">
          {(rfq.vendors ?? []).map((v, i) => (
            <AppCard key={v.id || String(i)} style={styles.card}>
              <Text style={styles.lineCode}>{v.vendorName || v.vendorCode || '—'}</Text>
              <Text style={styles.meta}>
                {titleCaseLabel(v.inviteStatus) || '—'}
                {v.contactEmail ? ` · ${v.contactEmail}` : ''}
              </Text>
            </AppCard>
          ))}
          {(rfq.vendors ?? []).length === 0 ? (
            <Text style={styles.meta}>No vendors assigned. Complete vendor set on desktop.</Text>
          ) : null}
        </FormSection>
        <FormSection title="Lines">
          {(rfq.lines ?? []).map((l, i) => (
            <AppCard key={l.id || String(i)} style={styles.card}>
              <Text style={styles.lineCode}>{l.itemCode || '—'}</Text>
              <Text style={styles.meta}>
                {l.itemName || '—'} · qty {Number(l.requiredQuantity ?? l.quantity ?? 0)}
              </Text>
            </AppCard>
          ))}
        </FormSection>
        <Text style={styles.hint}>
          Quote entry, comparison, award, and convert-to-PO stay on desktop / deeper workflows.
        </Text>
        {showSend ? (
          <PrimaryButton
            title={busy ? 'Sending…' : 'Send RFQ'}
            onPress={() => void onSend()}
            disabled={busy || !(rfq.vendors?.length)}
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
  hint: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.md },
  cta: { marginTop: spacing.md },
})
