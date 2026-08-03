import { Pressable, ScrollView, StyleSheet, Text, View, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  SecondaryButton,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { useSalesOrders } from '@/features/crm/hooks'
import { salesOrderAmount } from '@/features/crm/commercialMap'
import { formatDate, formatMoney, statusTone } from '@/features/crm/utils'
import { colors, layout, motion, spacing, typography } from '@/theme'

export default function SalesOrdersListScreen() {
  const { data, isLoading, error, refetch } = useSalesOrders()
  const router = useRouter()

  return (
    <View style={styles.flex}>
      <AppHeader title="Sales orders" subtitle="Fulfilled from CRM" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
        {(data ?? []).map((s) => {
          const no = s.salesOrderNo || s.soNumber || s.id
          const customer = s.customerName || s.companyName || s.customerCode || '—'
          const amount = salesOrderAmount(s)
          const metaBits = [
            s.orderDate ? `Order ${formatDate(s.orderDate)}` : null,
            s.quotationNo ? `From ${s.quotationNo}` : null,
            s.salesOwnerName ? s.salesOwnerName : null,
          ].filter(Boolean)

          return (
            <AppCard key={s.id} style={styles.card}>
              <Pressable
                onPress={() => router.push(`/(app)/crm/sales-orders/${s.id}`)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View style={styles.head}>
                  <View style={styles.headCopy}>
                    <Text style={styles.title}>{no}</Text>
                    <Text style={styles.meta}>{customer}</Text>
                  </View>
                  <StatusChip label={s.status || '—'} tone={statusTone(s.status)} compact />
                </View>
                <Text style={styles.amount}>{formatMoney(amount)}</Text>
                {metaBits.length ? <Text style={styles.metaMuted}>{metaBits.join(' · ')}</Text> : null}
                <View style={styles.chips}>
                  {s.invoiceStatus ? (
                    <StatusChip label={`Invoice · ${s.invoiceStatus}`} compact />
                  ) : null}
                  {s.dispatchStatus || s.fulfilmentStatus ? (
                    <StatusChip
                      label={`Dispatch · ${s.dispatchStatus || s.fulfilmentStatus}`}
                      tone="info"
                      compact
                    />
                  ) : null}
                </View>
              </Pressable>
              <View style={styles.actions}>
                <SecondaryButton
                  title="Share"
                  onPress={() => void Share.share({ message: `Sales order ${no} (FOS ERP)` })}
                  style={styles.btn}
                />
                <SecondaryButton
                  title="Track"
                  onPress={() => router.push(`/(app)/crm/sales-orders/${s.id}`)}
                  style={styles.btn}
                />
              </View>
              <View style={styles.chevronHint}>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </AppCard>
          )
        })}
        {!isLoading && (data ?? []).length === 0 ? (
          <EmptyState
            title="No sales orders yet"
            description="Convert an approved quotation to create one."
            icon="cart-outline"
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
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, minHeight: 48, paddingVertical: spacing.sm },
  chevronHint: { position: 'absolute', top: spacing.xl, right: spacing.xl },
})
