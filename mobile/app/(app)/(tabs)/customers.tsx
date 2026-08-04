import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  IconButton,
  ListTile,
  SearchBar,
  SkeletonCard,
} from '@/components'
import { useCompanies, useContacts } from '@/features/crm/hooks'
import { companyLabel, formatMoney } from '@/features/crm/utils'
import { QuickContactActions } from '@/features/crm/components/QuickContactActions'
import { CrmFab } from '@/features/crm/components/CrmFab'
import { colors, layout, motion, radius, spacing, typography } from '@/theme'
import { mapQueryFromCompany } from '@/features/crm/utils'

export default function CustomersTab() {
  const [tab, setTab] = useState<'companies' | 'contacts'>('companies')
  const [q, setQ] = useState('')
  const companies = useCompanies(q)
  const contacts = useContacts(q)
  const router = useRouter()

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Customers"
        subtitle="Companies & contacts"
        right={
          <IconButton
            name="scan-outline"
            accessibilityLabel="Scan business card"
            onPress={() => router.push('/(app)/crm/business-card')}
          />
        }
      />
      <View style={styles.pad}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search customers…" onClear={() => setQ('')} />
        <View style={styles.tabs}>
          {(
            [
              { id: 'companies' as const, label: 'Companies' },
              { id: 'contacts' as const, label: 'Contacts' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [
                styles.tab,
                tab === t.id && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push('/(app)/crm/leads')}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <Text style={styles.tabLabel}>Leads</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'companies' ? (
          <>
            {companies.isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : null}
            {companies.error ? (
              <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
            ) : null}
            {(companies.data ?? []).map((c) => (
              <AppCard key={c.id} style={styles.card} padded={false}>
                <ListTile
                  title={companyLabel(c)}
                  subtitle={[c.industry, c.city].filter(Boolean).join(' · ') || 'Customer'}
                  meta={`Outstanding · ${formatMoney(c.outstandingAmount as number | undefined)}`}
                  avatarName={companyLabel(c)}
                  onPress={() => router.push(`/(app)/crm/companies/${c.id}`)}
                />
                <View style={styles.actions}>
                  <QuickContactActions
                    phone={c.phone || c.contactPhone}
                    email={c.email}
                    mapQuery={mapQueryFromCompany(c)}
                  />
                </View>
              </AppCard>
            ))}
            {!companies.isLoading && (companies.data ?? []).length === 0 ? (
              <EmptyState
                title="No companies yet"
                description="Add a customer or scan a business card to get started."
                icon="business-outline"
                actionLabel="New customer"
                onAction={() => router.push('/(app)/crm/companies/create')}
              />
            ) : null}
          </>
        ) : (
          <>
            {contacts.isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : null}
            {(contacts.data ?? []).map((ct) => {
              const name =
                ct.fullName ||
                [ct.firstName, ct.lastName].filter(Boolean).join(' ') ||
                'Contact'
              return (
                <AppCard key={ct.id} style={styles.card} padded={false}>
                  <ListTile
                    title={name}
                    subtitle={[ct.designation, ct.companyName].filter(Boolean).join(' · ') || 'Contact'}
                    avatarName={name}
                    status={ct.isDecisionMaker ? 'Decision maker' : undefined}
                    statusTone="warning"
                    onPress={() => router.push(`/(app)/crm/contacts/${ct.id}`)}
                  />
                  <View style={styles.actions}>
                    <QuickContactActions phone={ct.mobile || ct.phone} email={ct.email} />
                  </View>
                </AppCard>
              )
            })}
            {!contacts.isLoading && (contacts.data ?? []).length === 0 ? (
              <EmptyState
                title="No contacts yet"
                description="Contacts linked to companies appear here."
                icon="people-outline"
              />
            ) : null}
          </>
        )}
      </ScrollView>
      <CrmFab />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  pad: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    minHeight: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primarySoft,
  },
  tabPressed: { opacity: 0.88, transform: [{ scale: motion.pressScale }] },
  tabLabel: { ...typography.captionStrong, color: colors.textSecondary },
  tabLabelActive: { color: colors.primary },
  scroll: { padding: layout.screenPadding, paddingBottom: 120 },
  card: { marginBottom: spacing.md, overflow: 'hidden' },
  actions: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
})
