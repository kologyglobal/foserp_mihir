import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppCard, AppHeader, Loading, StatusChip } from '@/components'
import { useContacts } from '@/features/crm/hooks'
import { EntityMissingState } from '@/features/crm/components/EntityMissingState'
import { QuickContactActions } from '@/features/crm/components/QuickContactActions'
import { displayName } from '@/features/crm/utils'
import { colors, spacing, typography } from '@/theme'

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const contactId = String(id || '')
  const router = useRouter()
  const contacts = useContacts()
  const contact = (contacts.data ?? []).find((c) => c.id === contactId)

  if (!contactId) {
    return <EntityMissingState title="Contact" entityLabel="contact" />
  }
  if (contacts.isLoading) return <Loading fullScreen />
  if (!contact) {
    return (
      <EntityMissingState
        title="Contact"
        entityLabel="contact"
        error={new Error('Contact not found')}
        onRetry={() => void contacts.refetch()}
      />
    )
  }

  const name = contact.fullName || displayName(contact.firstName, contact.lastName)

  return (
    <View style={styles.flex}>
      <AppHeader title={name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppCard>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.meta}>{contact.designation || '—'}</Text>
          <Text style={styles.meta}>{contact.companyName || '—'}</Text>
          {contact.isDecisionMaker ? <StatusChip label="Decision maker" tone="warning" /> : null}
          <View style={{ marginTop: spacing.md }}>
            <QuickContactActions phone={contact.mobile || contact.phone} email={contact.email} />
          </View>
        </AppCard>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg },
  title: { ...typography.subtitle },
  meta: { ...typography.caption, marginTop: 2 },
})
