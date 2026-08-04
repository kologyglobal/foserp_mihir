import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppCard, AppHeader, Loading, PrimaryButton, StatusChip } from '@/components'
import { useSalesOrder } from '@/features/crm/hooks'
import { EntityMissingState } from '@/features/crm/components/EntityMissingState'
import { salesOrderAmount } from '@/features/crm/commercialMap'
import { formatDate, formatMoney, statusTone } from '@/features/crm/utils'
import { colors, spacing, typography } from '@/theme'

export default function SalesOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const soid = String(id || '')
  const { data, isLoading, error, refetch } = useSalesOrder(soid)
  const router = useRouter()

  if (!soid) {
    return <EntityMissingState title="Sales order" entityLabel="sales order" />
  }
  if (isLoading) return <Loading fullScreen />
  if (error || !data) {
    return (
      <EntityMissingState
        title="Sales order"
        entityLabel="sales order"
        error={error ?? new Error('Not found')}
        onRetry={() => void refetch()}
      />
    )
  }

  const customer = data.customerName || data.companyName || data.customerCode || '—'
  const amount = salesOrderAmount(data)
  const companyId = data.customerId || data.companyId

  return (
    <View style={styles.flex}>
      <AppHeader
        title={String(data.salesOrderNo || data.soNumber || 'SO')}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppCard>
          <Text style={styles.meta}>{customer}</Text>
          <Text style={styles.value}>{formatMoney(amount)}</Text>
          <StatusChip label={data.status || '—'} tone={statusTone(data.status)} />
          {data.orderDate ? <Text style={styles.meta}>Order date: {formatDate(data.orderDate)}</Text> : null}
          {data.quotationNo ? <Text style={styles.meta}>Quotation: {data.quotationNo}</Text> : null}
          {data.salesOwnerName ? <Text style={styles.meta}>Owner: {data.salesOwnerName}</Text> : null}
          <Text style={styles.meta}>Invoice: {data.invoiceStatus || '—'}</Text>
          <Text style={styles.meta}>
            Dispatch: {data.dispatchStatus || data.fulfilmentStatus || '—'}
          </Text>
        </AppCard>
        <PrimaryButton
          title="View PDF"
          onPress={() => router.push(`/(app)/crm/pdf/sales_order/${soid}`)}
          fullWidth
        />
        <Pressable
          style={styles.secondary}
          onPress={() => {
            if (companyId) router.push(`/(app)/crm/companies/${companyId}`)
          }}
        >
          <Text style={styles.secondaryText}>Open customer</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.md },
  value: { ...typography.title, marginVertical: spacing.sm },
  meta: { ...typography.caption, marginTop: 4 },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { ...typography.bodyStrong, color: colors.primary },
})
