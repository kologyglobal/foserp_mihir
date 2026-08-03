import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { useQuotations, useInvalidateCrm } from '@/features/crm/hooks'
import { convertQuotationToSalesOrder } from '@/api/crmApi'
import { quotationAmount } from '@/features/crm/commercialMap'
import { formatDate, formatMoney, statusTone } from '@/features/crm/utils'
import { colors, layout, motion, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import { usePermissions } from '@/auth/permissions'

export default function QuotationsListScreen() {
  const { data, isLoading, error, refetch } = useQuotations()
  const router = useRouter()
  const invalidate = useInvalidateCrm()
  const { can } = usePermissions()

  const onConvert = async (id: string) => {
    if (!can('crm.quotation.convert') && !can('tenant.manage')) {
      Alert.alert('Permission denied', 'You cannot convert quotations.')
      return
    }
    try {
      const res = await convertQuotationToSalesOrder(id)
      invalidate()
      const soId = res.data?.salesOrderId
      if (!soId) {
        Alert.alert('Converted', 'Sales order created. Open Sales Orders to view it.')
        router.push('/(app)/crm/sales-orders')
        return
      }
      Alert.alert('Converted', `Sales order ${res.data.salesOrderNo || soId}`)
      router.push(`/(app)/crm/sales-orders/${soId}`)
    } catch (e) {
      Alert.alert('Convert failed', getUserFriendlyMessage(e))
    }
  }

  const onShare = async (code: string) => {
    await Share.share({
      message: `Quotation ${code} (open FOS ERP web for PDF export)`,
    })
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Quotations" subtitle="Commercial documents" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
        {(data ?? []).map((q) => {
          const code = q.quotationCode || q.quotationNo || q.id
          const amount = quotationAmount(q)
          const expiry = q.validUntil || q.expiryDate || q.validityDate
          const customer = q.customerName || q.companyName || '—'
          return (
            <AppCard key={q.id} style={styles.card}>
              <Pressable
                onPress={() => router.push(`/(app)/crm/quotations/${q.id}`)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View style={styles.head}>
                  <View style={styles.headCopy}>
                    <Text style={styles.title}>{code}</Text>
                    <Text style={styles.meta}>{customer}</Text>
                  </View>
                  <StatusChip label={q.status || '—'} tone={statusTone(q.status)} compact />
                </View>
                <Text style={styles.amount}>{formatMoney(amount)}</Text>
                <Text style={styles.metaMuted}>
                  Valid until {formatDate(expiry)}
                  {q.salesOwnerName ? ` · ${q.salesOwnerName}` : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <SecondaryButton
                  title="View"
                  onPress={() => router.push(`/(app)/crm/quotations/${q.id}`)}
                  style={styles.btn}
                />
                <SecondaryButton title="Share" onPress={() => void onShare(String(code))} style={styles.btn} />
                <PrimaryButton title="To SO" onPress={() => void onConvert(q.id)} style={styles.btn} />
              </View>
              <View style={styles.chevronHint}>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </AppCard>
          )
        })}
        {!isLoading && (data ?? []).length === 0 ? (
          <EmptyState
            title="No quotations yet"
            description="Quotes created on web or converted from opportunities appear here."
            icon="document-text-outline"
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  card: { marginBottom: spacing.md, position: 'relative' },
  pressed: { opacity: 0.94, transform: [{ scale: motion.pressScaleSoft }] },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headCopy: { flex: 1, minWidth: 0, paddingRight: spacing.md },
  title: { ...typography.subtitle, fontSize: 17 },
  meta: { ...typography.caption, marginTop: 3 },
  metaMuted: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  amount: {
    ...typography.metric,
    fontSize: 24,
    marginTop: spacing.lg,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, minHeight: 48, paddingVertical: spacing.sm },
  chevronHint: { position: 'absolute', top: spacing.xl, right: spacing.xl },
})
