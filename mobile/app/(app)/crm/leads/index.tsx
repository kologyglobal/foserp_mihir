import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppHeader, EmptyState, ErrorState, IconButton, SearchBar, SkeletonCard } from '@/components'
import { useLeads } from '@/features/crm/hooks'
import { LeadCard } from '@/features/crm/components/LeadCard'
import { SwipeableRow } from '@/features/crm/components/SwipeableRow'
import { openTel, openWhatsApp } from '@/features/crm/utils'
import { colors, layout, spacing } from '@/theme'

export default function LeadsRegisterScreen() {
  const [q, setQ] = useState('')
  const { data, isLoading, error, refetch } = useLeads(q)
  const router = useRouter()

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Leads"
        subtitle="Prospect pipeline"
        onBack={() => router.back()}
        right={
          <View style={styles.headerRight}>
            <IconButton
              name="scan-outline"
              accessibilityLabel="Scan card"
              onPress={() => router.push('/(app)/crm/business-card')}
            />
            <IconButton
              name="add-outline"
              accessibilityLabel="New lead"
              onPress={() => router.push('/(app)/crm/leads/create')}
            />
          </View>
        }
      />
      <View style={styles.pad}>
        <SearchBar value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder="Search leads…" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
        {(data ?? []).map((lead) => (
          <SwipeableRow
            key={lead.id}
            rightActions={[
              {
                key: 'call',
                label: 'Call',
                onPress: () => void openTel(lead.mobile),
              },
              {
                key: 'wa',
                label: 'WA',
                onPress: () => void openWhatsApp(lead.mobile, `Hi ${lead.prospectName}`),
              },
              {
                key: 'open',
                label: 'Open',
                tone: 'neutral',
                onPress: () => router.push(`/(app)/crm/leads/${lead.id}`),
              },
            ]}
          >
            <LeadCard lead={lead} onPress={() => router.push(`/(app)/crm/leads/${lead.id}`)} />
          </SwipeableRow>
        ))}
        {!isLoading && (data ?? []).length === 0 ? (
          <EmptyState
            title="No leads yet"
            description="Capture a prospect or scan a business card to start."
            icon="person-add-outline"
            actionLabel="New lead"
            onAction={() => router.push('/(app)/crm/leads/create')}
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  headerRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
})
