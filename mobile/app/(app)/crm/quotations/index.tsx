import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Share } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  SkeletonCard,
  StatusChip,
} from '@/components'
import { useQuotations, useInvalidateCrm } from '@/features/crm/hooks'
import { convertQuotationToSalesOrder } from '@/api/crmApi'
import {
  quotationAmount,
  quotationDisplayCode,
  quotationDisplayCustomer,
  quotationDisplayOwner,
  quotationDisplayProduct,
} from '@/features/crm/commercialMap'
import { formatDate, formatMoney, statusTone, titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, motion, radius, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import { usePermissions } from '@/auth/permissions'

type ActionIconProps = {
  name: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  primary?: boolean
  disabled?: boolean
}

function ActionIcon({ name, label, onPress, primary, disabled }: ActionIconProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={(e) => {
        e.stopPropagation?.()
        onPress()
      }}
      style={({ pressed }) => [
        styles.actionIcon,
        primary && styles.actionIconPrimary,
        disabled && styles.actionIconDisabled,
        pressed && !disabled && styles.actionIconPressed,
      ]}
    >
      <Ionicons
        name={name}
        size={18}
        color={primary ? colors.textInverse : colors.primary}
      />
    </Pressable>
  )
}

export default function QuotationsListScreen() {
  const { data, isLoading, error, refetch } = useQuotations()
  const router = useRouter()
  const invalidate = useInvalidateCrm()
  const { can } = usePermissions()
  const canConvert = can('crm.quotation.convert') || can('tenant.manage')

  const onConvert = async (id: string) => {
    if (!canConvert) {
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
      message: `Quotation ${code}`,
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
          const code = quotationDisplayCode(q)
          const customer = quotationDisplayCustomer(q)
          const product = quotationDisplayProduct(q)
          const owner = quotationDisplayOwner(q)
          const amount = quotationAmount(q)
          const expiry = q.validUntil || q.expiryDate || q.validityDate
          const status = titleCaseLabel(q.status || '—')
          const alreadyConverted = Boolean(q.salesOrderId)
          const metaBits = [
            expiry ? `Valid ${formatDate(expiry)}` : null,
            owner,
            product ? `Item: ${product}` : null,
          ].filter(Boolean)

          return (
            <AppCard key={q.id} style={styles.card} padded={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${code}, ${customer}, ${formatMoney(amount)}`}
                onPress={() => router.push(`/(app)/crm/quotations/${q.id}`)}
                style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}
              >
                <View style={styles.iconBadge}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.main}>
                  <View style={styles.topRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {code}
                    </Text>
                    <StatusChip label={status} tone={statusTone(q.status)} compact />
                  </View>
                  <Text style={styles.customer} numberOfLines={1}>
                    {customer}
                  </Text>
                  {product ? (
                    <Text style={styles.product} numberOfLines={1}>
                      {product}
                    </Text>
                  ) : null}
                  <View style={styles.amountRow}>
                    <Text style={styles.amount}>{formatMoney(amount)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                  {metaBits.length ? (
                    <Text style={styles.meta} numberOfLines={2}>
                      {metaBits.join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.actions}>
                <ActionIcon
                  name="eye-outline"
                  label="View quotation"
                  onPress={() => router.push(`/(app)/crm/quotations/${q.id}`)}
                />
                <ActionIcon
                  name="document-outline"
                  label="View PDF"
                  onPress={() => router.push(`/(app)/crm/pdf/quotation/${q.id}`)}
                />
                <ActionIcon
                  name="share-outline"
                  label="Share quotation"
                  onPress={() => void onShare(code === 'Quotation' ? 'document' : code)}
                />
                <ActionIcon
                  name={alreadyConverted ? 'cart-outline' : 'swap-horizontal-outline'}
                  label={alreadyConverted ? 'Open sales order' : 'Convert to sales order'}
                  primary={!alreadyConverted && canConvert}
                  disabled={!alreadyConverted && !canConvert}
                  onPress={() => {
                    if (alreadyConverted && q.salesOrderId) {
                      router.push(`/(app)/crm/sales-orders/${q.salesOrderId}`)
                      return
                    }
                    void onConvert(q.id)
                  }}
                />
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
  card: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  pressed: { opacity: 0.94, transform: [{ scale: motion.pressScaleSoft }] },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryMuted ?? colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...typography.subtitle, fontSize: 16, flex: 1, minWidth: 0 },
  customer: { ...typography.bodyStrong, marginTop: 3, fontSize: 14 },
  product: { ...typography.caption, marginTop: 2, color: colors.textMuted },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  amount: {
    ...typography.metric,
    fontSize: 20,
    color: colors.primary,
    letterSpacing: -0.4,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actionIconPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionIconPressed: { opacity: 0.85, transform: [{ scale: motion.pressScale }] },
  actionIconDisabled: { opacity: 0.4 },
})
