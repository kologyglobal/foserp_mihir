import { ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { QuickActionButton } from '@/components'
import { spacing } from '@/theme'

/** Horizontal quick actions strip used on CRM Home. */
export function QuickActionsBar() {
  const router = useRouter()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <QuickActionButton
        label="Scan card"
        icon="scan-outline"
        tone="blue"
        onPress={() => router.push('/(app)/crm/business-card')}
      />
      <QuickActionButton
        label="Lead"
        icon="person-add-outline"
        tone="green"
        onPress={() => router.push('/(app)/crm/leads/create')}
      />
      <QuickActionButton
        label="Customer"
        icon="business-outline"
        tone="purple"
        onPress={() => router.push('/(app)/crm/companies/create')}
      />
      <QuickActionButton
        label="Meeting"
        icon="calendar-outline"
        tone="orange"
        onPress={() => router.push('/(app)/crm/meetings/create')}
      />
      <QuickActionButton
        label="Quotation"
        icon="document-text-outline"
        tone="rose"
        onPress={() => router.push('/(app)/crm/quotations')}
      />
      <QuickActionButton
        label="Follow-up"
        icon="alarm-outline"
        tone="grey"
        onPress={() => router.push('/(app)/crm/follow-ups/create')}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
    marginBottom: spacing.sm,
  },
})
