import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppCard, AppHeader, Avatar, EmptyState, ListTile } from '@/components'
import { colors, layout, spacing, typography } from '@/theme'
import { useSessionStore } from '@/store/sessionStore'
import { env } from '@/config/env'
import { useNavigationAccess } from '@/auth/useNavigationAccess'
import type { MobileNavigationEntry } from '@/auth/navigationCatalog'

const GROUP_ORDER = ['gate', 'quality', 'store', 'purchase', 'crm', 'other'] as const
const GROUP_LABEL: Record<string, string> = {
  gate: 'Gate',
  quality: 'Quality',
  store: 'Store',
  purchase: 'Purchase',
  crm: 'CRM',
  other: 'Other',
}

export default function MoreScreen() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const { more } = useNavigationAccess()
  const fullName = profile?.user
    ? `${profile.user.firstName} ${profile.user.lastName}`.trim()
    : 'User'

  const byGroup = new Map<string, MobileNavigationEntry[]>()
  for (const e of more) {
    const g = e.group || 'other'
    const list = byGroup.get(g) ?? []
    list.push(e)
    byGroup.set(g, list)
  }

  const hasGroups = GROUP_ORDER.some((g) => (byGroup.get(g)?.length ?? 0) > 0)

  return (
    <View style={styles.flex}>
      <AppHeader title="More" subtitle="Modules you can access" showBack={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={fullName} size={48} />
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{fullName}</Text>
              <Text style={styles.org}>{profile?.tenant?.name || env.defaultTenantSlug}</Text>
            </View>
          </View>
        </AppCard>

        {GROUP_ORDER.map((group) => {
          const entries = byGroup.get(group)
          if (!entries?.length) return null
          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{GROUP_LABEL[group]}</Text>
              {entries.map((link) => (
                <ListTile
                  key={link.id}
                  title={link.label}
                  subtitle={link.description}
                  icon={(link.icon as never) || undefined}
                  onPress={() => router.push(link.href as never)}
                />
              ))}
            </View>
          )
        })}

        {!hasGroups ? (
          <EmptyState
            title="No menu entries"
            description={
              profile?.permissions == null
                ? 'Session permissions unavailable. Sign out and try again.'
                : 'No modules or permissions are available for your user on this device.'
            }
            icon="lock-closed-outline"
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  profileCard: { marginBottom: spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileCopy: { flex: 1 },
  name: { ...typography.bodyStrong, fontSize: 17 },
  org: { ...typography.caption, marginTop: 2 },
  group: { marginBottom: spacing.md },
  groupTitle: {
    ...typography.micro,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
})
