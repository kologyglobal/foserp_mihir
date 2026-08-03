import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ListTile,
  Loading,
  SearchBar,
  SectionHeader,
} from '@/components'
import { useCrmSearch } from '@/features/crm/hooks'
import { colors, layout, spacing, typography } from '@/theme'

export default function CrmSearchScreen() {
  const [q, setQ] = useState('')
  const { data, isFetching } = useCrmSearch(q)
  const router = useRouter()
  const ready = q.trim().length >= 2

  const leads = data?.leads ?? []
  const companies = data?.companies ?? []
  const contacts = data?.contacts ?? []
  const opportunities = data?.opportunities ?? []
  const quotations = data?.quotations ?? []
  const salesOrders = data?.salesOrders ?? []

  const empty =
    ready &&
    !isFetching &&
    !leads.length &&
    !companies.length &&
    !contacts.length &&
    !opportunities.length &&
    !quotations.length &&
    !salesOrders.length

  return (
    <View style={styles.flex}>
      <AppHeader title="Search" subtitle="CRM · everything in one place" onBack={() => router.back()} />
      <View style={styles.pad}>
        <SearchBar
          value={q}
          onChangeText={setQ}
          onClear={() => setQ('')}
          placeholder="Leads, companies, quotes…"
          autoFocus
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {isFetching ? <Loading label="Searching…" /> : null}
        {!ready ? (
          <EmptyState
            title="Find anyone, anything"
            description="Type at least 2 characters. Results are grouped by entity."
            icon="search-outline"
          />
        ) : null}

        {leads.length ? (
          <>
            <SectionHeader title={`Leads · ${leads.length}`} />
            <AppCard padded={false} style={styles.group}>
              {leads.map((l, i) => (
                <View key={String(l.id)}>
                  <ListTile
                    title={String(l.prospectName || l.leadCode)}
                    subtitle={String(l.companyName || l.city || 'Lead')}
                    avatarName={String(l.prospectName || 'L')}
                    onPress={() => router.push(`/(app)/crm/leads/${String(l.id)}`)}
                  />
                  {i < leads.length - 1 ? <View style={styles.div} /> : null}
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {companies.length ? (
          <>
            <SectionHeader title={`Companies · ${companies.length}`} />
            <AppCard padded={false} style={styles.group}>
              {companies.map((c, i) => (
                <View key={String(c.id)}>
                  <ListTile
                    title={String(c.name || c.companyCode)}
                    subtitle={String(c.city || 'Customer')}
                    avatarName={String(c.name || 'C')}
                    onPress={() => router.push(`/(app)/crm/companies/${String(c.id)}`)}
                  />
                  {i < companies.length - 1 ? <View style={styles.div} /> : null}
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {contacts.length ? (
          <>
            <SectionHeader title={`Contacts · ${contacts.length}`} />
            <AppCard padded={false} style={styles.group}>
              {contacts.map((c, i) => {
                const name = String(
                  c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Contact',
                )
                return (
                  <View key={String(c.id)}>
                    <ListTile
                      title={name}
                      subtitle={String(c.companyName || c.designation || 'Contact')}
                      avatarName={name}
                      onPress={() => router.push(`/(app)/crm/contacts/${String(c.id)}`)}
                    />
                    {i < contacts.length - 1 ? <View style={styles.div} /> : null}
                  </View>
                )
              })}
            </AppCard>
          </>
        ) : null}

        {opportunities.length ? (
          <>
            <SectionHeader title={`Opportunities · ${opportunities.length}`} />
            <AppCard padded={false} style={styles.group}>
              {opportunities.map((o, i) => (
                <View key={String(o.id)}>
                  <ListTile
                    title={String(
                      o.companyName ||
                        o.customerName ||
                        o.opportunityName ||
                        o.name ||
                        'Opportunity',
                    )}
                    subtitle={String(
                      (() => {
                        const lines = Array.isArray(o.lines) ? o.lines : []
                        const product =
                          lines
                            .map((l) => String(l.productOrItem || l.description || '').trim())
                            .find(Boolean) ||
                          String(o.productRequirement || '').trim()
                        const stage = String(o.stageName || o.stage || 'Deal')
                        return product ? `${product} · ${stage}` : stage
                      })(),
                    )}
                    icon="funnel-outline"
                    onPress={() => router.push('/(app)/crm/opportunities')}
                  />
                  {i < opportunities.length - 1 ? <View style={styles.div} /> : null}
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {quotations.length ? (
          <>
            <SectionHeader title={`Quotations · ${quotations.length}`} />
            <AppCard padded={false} style={styles.group}>
              {quotations.map((q, i) => (
                <View key={String(q.id)}>
                  <ListTile
                    title={String(q.quotationCode || q.quotationNo || 'Quote')}
                    subtitle={String(
                      q.customerName || q.companyName || q.customerCode || '—',
                    )}
                    icon="document-text-outline"
                    onPress={() => router.push(`/(app)/crm/quotations/${String(q.id)}`)}
                  />
                  {i < quotations.length - 1 ? <View style={styles.div} /> : null}
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {salesOrders.length ? (
          <>
            <SectionHeader title={`Sales orders · ${salesOrders.length}`} />
            <AppCard padded={false} style={styles.group}>
              {salesOrders.map((s, i) => (
                <View key={String(s.id)}>
                  <ListTile
                    title={String(s.salesOrderNo || s.soNumber || 'SO')}
                    subtitle={String(
                      s.customerName || s.companyName || s.customerCode || '—',
                    )}
                    icon="cart-outline"
                    onPress={() => router.push(`/(app)/crm/sales-orders/${String(s.id)}`)}
                  />
                  {i < salesOrders.length - 1 ? <View style={styles.div} /> : null}
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {empty ? (
          <EmptyState
            title="No matches"
            description="Try another name, code, or company."
            icon="search-outline"
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
  group: { marginBottom: spacing.lg, overflow: 'hidden' },
  div: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 68 },
})
