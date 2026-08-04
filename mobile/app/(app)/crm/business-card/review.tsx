import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  FormField,
  Loading,
  PrimaryButton,
  SecondaryButton,
  StatusChip,
} from '@/components'
import { colors, spacing, typography } from '@/theme'
import { businessCardScanStore, useBusinessCardScan } from '@/features/crm/businessCard/scanStore'
import {
  FIELD_LABELS,
  isUncertain,
  type BusinessCardFieldKey,
  type BusinessCardSaveMode,
} from '@/features/crm/businessCard/types'
import { findBusinessCardDuplicates, type DuplicateMatch } from '@/features/crm/businessCard/duplicateDetection'
import { saveBusinessCard } from '@/features/crm/businessCard/saveBusinessCard'
import { listCompanies, listContacts, listLeads, searchCrm } from '@/api/crmApi'
import { usePermissions } from '@/auth/permissions'
import { useInvalidateCrm } from '@/features/crm/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { useSessionStore } from '@/store/sessionStore'
import type { CrmCompany } from '@/types/crm'

/**
 * Screen 3 — Review fields, confidence, duplicates, company suggest, save options.
 */
export default function BusinessCardReviewScreen() {
  const router = useRouter()
  const fields = useBusinessCardScan((s) => s.fields)
  const confidence = useBusinessCardScan((s) => s.confidence)
  const previewUri = useBusinessCardScan((s) => s.previewUri)
  const ocrError = useBusinessCardScan((s) => s.ocrError)
  const preselectedCompanyId = useBusinessCardScan((s) => s.preselectedCompanyId)
  const { can } = usePermissions()
  const invalidate = useInvalidateCrm()
  const online = useSessionStore((s) => s.isOnline)

  const [busy, setBusy] = useState(false)
  const [dupes, setDupes] = useState<DuplicateMatch[]>([])
  const [dupChecked, setDupChecked] = useState(false)
  const [companyQuery, setCompanyQuery] = useState(fields.company)
  const [companyHits, setCompanyHits] = useState<CrmCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(preselectedCompanyId)
  const [forceCreate, setForceCreate] = useState(false)

  const canLead = can('crm.lead.create') || can('tenant.manage')
  const canCompany = can('crm.company.create') || can('tenant.manage')
  const canContact = can('crm.contact.create') || can('tenant.manage')

  const orderedKeys = useMemo(
    () =>
      Object.keys(FIELD_LABELS) as BusinessCardFieldKey[],
    [],
  )

  useEffect(() => {
    setCompanyQuery(fields.company)
  }, [fields.company])

  useEffect(() => {
    const q = companyQuery.trim()
    if (q.length < 2) {
      setCompanyHits([])
      return
    }
    const t = setTimeout(() => {
      void listCompanies({ page: 1, limit: 8, search: q })
        .then((res) => setCompanyHits(res.data ?? []))
        .catch(() => setCompanyHits([]))
    }, 280)
    return () => clearTimeout(t)
  }, [companyQuery])

  const runDuplicateCheck = async () => {
    setBusy(true)
    try {
      const [companies, contacts, leads, search] = await Promise.all([
        listCompanies({ page: 1, limit: 40, search: fields.company || undefined }),
        listContacts({ page: 1, limit: 40, search: fields.mobile || fields.email || undefined }),
        listLeads({ page: 1, limit: 40, search: fields.mobile || fields.email || fields.company || undefined }),
        fields.mobile || fields.email || fields.company
          ? searchCrm((fields.mobile || fields.email || fields.company).trim(), 15)
          : Promise.resolve({ data: { leads: [], companies: [], contacts: [], opportunities: [] } }),
      ])
      const companyRows = [
        ...(companies.data ?? []),
        ...((search.data.companies as CrmCompany[]) || []),
      ]
      // Dedupe companies by id
      const byId = new Map(companyRows.map((c) => [c.id, c]))
      const matches = findBusinessCardDuplicates({
        fields,
        companies: Array.from(byId.values()),
        contacts: contacts.data ?? [],
        leads: leads.data ?? [],
      })
      setDupes(matches)
      setDupChecked(true)
      if (matches[0]?.kind === 'company' && !selectedCompanyId) {
        setSelectedCompanyId(matches[0].id)
      }
    } catch (e) {
      Alert.alert('Duplicate check failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (online && !dupChecked && (fields.mobile || fields.email || fields.company || fields.gstin)) {
      void runDuplicateCheck()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doSave = async (mode: BusinessCardSaveMode) => {
    if (!previewUri) {
      Alert.alert('Missing image', 'Go back and capture the card again.')
      return
    }
    if (mode === 'create_lead' && !canLead) {
      Alert.alert('Permission denied', 'You cannot create leads.')
      return
    }
    if (mode === 'create_company_contact' && !(canCompany && canContact)) {
      Alert.alert('Permission denied', 'You need company + contact create.')
      return
    }
    if (mode === 'add_contact_existing' && !canContact) {
      Alert.alert('Permission denied', 'You cannot create contacts.')
      return
    }
    if (mode === 'add_contact_existing' && !selectedCompanyId) {
      Alert.alert('Select company', 'Choose an existing company from suggestions.')
      return
    }
    if (!forceCreate && dupes.length > 0 && mode !== 'draft' && mode !== 'add_contact_existing') {
      Alert.alert(
        'Possible duplicates',
        'Resolve duplicates first, or choose Create anyway / Add contact to existing.',
      )
      return
    }

    setBusy(true)
    try {
      const result = await saveBusinessCard({
        mode,
        fields: { ...fields, company: companyQuery || fields.company },
        imageUri: previewUri,
        existingCompanyId: selectedCompanyId,
        forceCreate,
      })
      invalidate()
      businessCardScanStore.getState().reset()
      if (result.offline) {
        Alert.alert('Saved offline', 'Will create the record and upload the card when online.')
        router.replace('/(app)/(tabs)')
        return
      }
      if (result.leadId) {
        router.replace(`/(app)/crm/leads/${result.leadId}`)
        return
      }
      if (result.contactId) {
        router.replace(`/(app)/crm/contacts/${result.contactId}`)
        return
      }
      if (result.companyId) {
        router.replace(`/(app)/crm/companies/${result.companyId}`)
        return
      }
      router.replace('/(app)/(tabs)')
    } catch (e) {
      Alert.alert('Save failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Review card" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {ocrError ? (
          <AppCard style={styles.warn}>
            <Text style={styles.warnText}>{ocrError}</Text>
            <Text style={styles.meta}>Edit fields below. Original card will still attach on save.</Text>
          </AppCard>
        ) : null}

        {!online ? (
          <AppCard style={styles.warn}>
            <Text style={styles.warnText}>Offline — Save as draft or save will queue for sync.</Text>
          </AppCard>
        ) : null}

        {orderedKeys.map((key) => {
          const conf = confidence[key] ?? (fields[key] ? 55 : 0)
          const uncertain = Boolean(fields[key]) && isUncertain(conf)
          const value = key === 'company' ? companyQuery : fields[key]
          return (
            <View key={key} style={styles.fieldBlock}>
              <View style={styles.fieldHead}>
                <Text style={styles.label}>{FIELD_LABELS[key]}</Text>
                {fields[key] || (key === 'company' && companyQuery) ? (
                  <StatusChip
                    label={`${conf}%`}
                    tone={uncertain ? 'warning' : conf >= 90 ? 'success' : 'info'}
                  />
                ) : null}
              </View>
              <FormField
                label=""
                value={value}
                onChangeText={(t) => {
                  if (key === 'company') {
                    setCompanyQuery(t)
                    businessCardScanStore.getState().setField('company', t)
                  } else {
                    businessCardScanStore.getState().setField(key, t)
                  }
                }}
                keyboardType={
                  key === 'mobile' || key === 'alternateMobile' || key === 'pincode'
                    ? 'phone-pad'
                    : key === 'email'
                      ? 'email-address'
                      : 'default'
                }
                autoCapitalize={key === 'email' || key === 'website' || key === 'linkedin' ? 'none' : 'words'}
              />
              {uncertain ? <Text style={styles.uncertain}>Uncertain — please verify</Text> : null}
            </View>
          )
        })}

        {companyHits.length ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Matching companies</Text>
            {companyHits.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.hit,
                  selectedCompanyId === c.id && styles.hitSelected,
                ]}
                onPress={() => {
                  setSelectedCompanyId(c.id)
                  setCompanyQuery(c.customerName || c.name || '')
                  businessCardScanStore
                    .getState()
                    .setField('company', c.customerName || c.name || '')
                }}
              >
                <Text style={styles.hitTitle}>{c.customerName || c.name}</Text>
                <Text style={styles.meta}>{[c.city, c.gstin].filter(Boolean).join(' · ')}</Text>
              </Pressable>
            ))}
          </AppCard>
        ) : null}

        <AppCard>
          <View style={styles.fieldHead}>
            <Text style={styles.sectionTitle}>Duplicates</Text>
            <Pressable onPress={() => void runDuplicateCheck()} disabled={busy || !online}>
              <Text style={styles.link}>{dupChecked ? 'Re-check' : 'Check now'}</Text>
            </Pressable>
          </View>
          {busy && !dupChecked ? <Loading /> : null}
          {dupes.map((d) => (
            <View key={`${d.kind}_${d.id}`} style={styles.dupeRow}>
              <Text style={styles.hitTitle}>
                {d.kind}: {d.label}
              </Text>
              <Text style={styles.meta}>{d.reason}</Text>
              <View style={styles.dupeActions}>
                {d.kind === 'company' ? (
                  <>
                    <Pressable
                      onPress={() => {
                        setSelectedCompanyId(d.id)
                        setForceCreate(false)
                      }}
                    >
                      <Text style={styles.link}>Add contact</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push(`/(app)/crm/companies/${d.id}`)}>
                      <Text style={styles.link}>Open existing</Text>
                    </Pressable>
                  </>
                ) : null}
                {d.kind === 'lead' ? (
                  <Pressable onPress={() => router.push(`/(app)/crm/leads/${d.id}`)}>
                    <Text style={styles.link}>Open existing</Text>
                  </Pressable>
                ) : null}
                {d.kind === 'contact' ? (
                  <Pressable onPress={() => router.push(`/(app)/crm/contacts/${d.id}`)}>
                    <Text style={styles.link}>Open existing</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {dupChecked && !dupes.length ? (
            <Text style={styles.meta}>No duplicates found.</Text>
          ) : null}
          {dupes.length ? (
            <Pressable onPress={() => setForceCreate(true)}>
              <Text style={styles.link}>Create anyway (ack duplicates)</Text>
            </Pressable>
          ) : null}
          {forceCreate ? <StatusChip label="Create anyway enabled" tone="warning" /> : null}
        </AppCard>

        <Text style={styles.sectionTitle}>Save</Text>
        {canLead ? (
          <PrimaryButton
            title="Create lead"
            onPress={() => void doSave('create_lead')}
            loading={busy}
            fullWidth
          />
        ) : null}
        {canCompany && canContact ? (
          <PrimaryButton
            title="Create company + contact"
            onPress={() => void doSave('create_company_contact')}
            loading={busy}
            fullWidth
          />
        ) : null}
        {canContact ? (
          <SecondaryButton
            title="Add contact to existing company"
            onPress={() => void doSave('add_contact_existing')}
            fullWidth
          />
        ) : null}
        <SecondaryButton title="Save as draft" onPress={() => void doSave('draft')} fullWidth />
        <Text style={styles.meta}>
          Original card image always uploads as BUSINESS_CARD attachment when online.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  fieldBlock: { marginBottom: spacing.sm },
  fieldHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: { ...typography.label },
  uncertain: { ...typography.caption, color: colors.warning, marginTop: -4 },
  sectionTitle: { ...typography.subtitle, marginTop: spacing.sm, marginBottom: spacing.sm },
  warn: { backgroundColor: colors.warningMuted, marginBottom: spacing.sm },
  warnText: { ...typography.bodyStrong, color: colors.warning },
  meta: { ...typography.caption, marginTop: 2 },
  link: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  hit: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hitSelected: { backgroundColor: colors.primaryMuted, borderRadius: 8, paddingHorizontal: spacing.sm },
  hitTitle: { ...typography.bodyStrong },
  dupeRow: { marginBottom: spacing.md },
  dupeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
})
