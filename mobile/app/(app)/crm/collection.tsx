import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  SearchBar,
} from '@/components'
import { useCompanies } from '@/features/crm/hooks'
import { companyLabel, formatMoney, openTel, openWhatsApp } from '@/features/crm/utils'
import { listArCustomerSummaries, type ArCustomerSummary } from '@/api/receivablesApi'
import { usePermissions } from '@/auth/permissions'
import { useSessionStore } from '@/store/sessionStore'
import { colors, spacing, typography } from '@/theme'

function pickLegalEntityId(): string | undefined {
  const profile = useSessionStore.getState().profile
  const anyProf = profile as { legalEntities?: Array<{ id: string; isDefault?: boolean }> } | null
  const les = anyProf?.legalEntities
  if (!les?.length) return undefined
  return les.find((x) => x.isDefault)?.id ?? les[0]?.id
}

export default function CollectionScreen() {
  const { can } = usePermissions()
  const canAr = can('finance.ar.view') || can('tenant.manage')
  const [q, setQ] = useState('')
  const router = useRouter()
  const companies = useCompanies(q)
  const legalEntityId = pickLegalEntityId()

  const ar = useQuery({
    queryKey: ['ar', 'customers', legalEntityId],
    enabled: canAr && !!legalEntityId,
    queryFn: async () => {
      const res = await listArCustomerSummaries({
        legalEntityId: legalEntityId!,
        page: 1,
        pageSize: 50,
      })
      const body = res.data as { items?: ArCustomerSummary[] } | ArCustomerSummary[]
      if (Array.isArray(body)) return body
      return body.items ?? []
    },
    retry: false,
  })

  const companyList = useMemo(() => {
    const rows = companies.data ?? []
    const withBal = rows.filter((c) => Number(c.outstandingAmount ?? 0) > 0)
    return (withBal.length ? withBal : rows).filter((c) => {
      if (!q.trim()) return true
      const hay = companyLabel(c).toLowerCase()
      return hay.includes(q.trim().toLowerCase())
    })
  }, [companies.data, q])

  const arList = useMemo(() => {
    const rows = ar.data ?? []
    if (!q.trim()) return rows
    const needle = q.trim().toLowerCase()
    return rows.filter((c) =>
      [c.customerName, c.customerCode].filter(Boolean).join(' ').toLowerCase().includes(needle),
    )
  }, [ar.data, q])

  return (
    <View style={styles.flex}>
      <AppHeader title="Collection" subtitle="Outstanding balances" onBack={() => router.back()} />
      <View style={styles.pad}>
        <SearchBar value={q} onChangeText={setQ} onClear={() => setQ('')} placeholder="Search customers…" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!canAr ? (
          <>
            <Text style={styles.hint}>
              Detailed AR invoices require finance.ar.view. Showing CRM company balances only.
            </Text>
            {companies.isLoading ? <Loading /> : null}
            {companies.error ? (
              <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
            ) : null}
            {companyList.map((c) => {
              const due = Number(c.outstandingAmount ?? 0)
              return (
                <AppCard key={c.id} style={styles.card}>
                  <Pressable onPress={() => router.push(`/(app)/crm/companies/${c.id}`)}>
                    <Text style={styles.title}>{companyLabel(c)}</Text>
                    <Text style={styles.meta}>Total outstanding: {formatMoney(due || undefined)}</Text>
                    <Text style={styles.meta}>Overdue amount: —</Text>
                    <Text style={styles.meta}>Oldest due date: —</Text>
                    <Text style={styles.meta}>Overdue days: —</Text>
                  </Pressable>
                  <View style={styles.actions}>
                    <Pressable onPress={() => void openTel(c.phone || c.contactPhone)}>
                      <Text style={styles.link}>Call</Text>
                    </Pressable>
                    <Pressable onPress={() => void openWhatsApp(c.phone || c.contactPhone)}>
                      <Text style={styles.link}>WhatsApp</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push(`/(app)/crm/companies/${c.id}`)}>
                      <Text style={styles.link}>Open customer</Text>
                    </Pressable>
                  </View>
                </AppCard>
              )
            })}
            {!companies.isLoading && companyList.length === 0 ? (
              <EmptyState title="No customers" />
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              Accounting AR open-item summaries (finance.ar.view). Invoice rows open per customer when
              legal entity is available.
            </Text>
            {!legalEntityId ? (
              <Text style={styles.meta}>
                No legal entity on session profile — cannot call AR APIs yet. Sign in with a profile that
                includes LE, or view company commercial position from Customer 360.
              </Text>
            ) : null}
            {ar.isLoading ? <Loading /> : null}
            {ar.error ? <ErrorState error={ar.error} onRetry={() => void ar.refetch()} /> : null}
            {arList.map((c) => (
              <AppCard key={c.customerId} style={styles.card}>
                <Text style={styles.title}>{c.customerName || c.customerCode || c.customerId}</Text>
                <Text style={styles.meta}>
                  Total outstanding: {formatMoney(Number(c.outstandingAmount || c.baseOutstandingAmount))}
                </Text>
                <Text style={styles.meta}>
                  Overdue amount: {c.maxDaysOverdue != null && c.maxDaysOverdue > 0 ? formatMoney(Number(c.outstandingAmount)) : '—'}
                </Text>
                <Text style={styles.meta}>Oldest due date: {c.oldestDueDate || '—'}</Text>
                <Text style={styles.meta}>Overdue days: {c.maxDaysOverdue ?? '—'}</Text>
                <Text style={styles.meta}>Open items: {c.openItemCount}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => router.push('/(app)/crm/collection')}>
                    <Text style={styles.link}>Open customer</Text>
                  </Pressable>
                </View>
              </AppCard>
            ))}
            {!ar.isLoading && arList.length === 0 && legalEntityId ? (
              <EmptyState title="No AR open balances" />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  pad: { padding: spacing.lg, paddingBottom: 0 },
  scroll: { padding: spacing.lg },
  hint: { ...typography.caption, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  link: { ...typography.caption, color: colors.primary, fontWeight: '700' },
})

