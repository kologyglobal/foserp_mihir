import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppCard, AppHeader, Avatar, InfoTile } from '@/components'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, spacing, typography } from '@/theme'
import { useResponsive } from '@/hooks/useResponsive'

export default function ProfileScreen() {
  const profile = useSessionStore((s) => s.profile)
  const router = useRouter()
  const { contentMaxWidth, isTablet } = useResponsive()
  const user = profile?.user
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '—'

  return (
    <View style={styles.flex}>
      <AppHeader title="Profile" subtitle="Your account" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, isTablet && styles.center]} showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: contentMaxWidth }}>
          <AppCard style={styles.hero}>
            <Avatar name={fullName} size={80} uri={profile?.photoUrl} />
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.sub}>{user?.designation || user?.email || '—'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Read-only · Mobile</Text>
            </View>
          </AppCard>

          <View style={styles.grid}>
            <InfoTile label="User code" value={profile?.employeeCode ?? '—'} />
            <InfoTile label="Department" value={profile?.department ?? user?.department ?? '—'} />
            <InfoTile label="Role" value={profile?.roles?.join(', ') || '—'} />
            <InfoTile label="Branch" value={profile?.branchName ?? '—'} />
            <InfoTile label="Legal entity" value={profile?.legalEntityName ?? '—'} />
            <InfoTile label="Email" value={user?.email ?? '—'} />
            <InfoTile label="Phone" value={user?.mobile ?? '—'} />
            <InfoTile label="Company" value={profile?.tenant?.name ?? '—'} />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  center: { alignItems: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.xs },
  name: { ...typography.title, marginTop: spacing.md, fontSize: 22 },
  sub: { ...typography.caption },
  badge: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
  },
  badgeText: { ...typography.captionStrong, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
})
