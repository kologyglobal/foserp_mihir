/**
 * Shared hub UI: module tiles filtered by navigation catalogue.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AppCard, AppHeader, EmptyState } from '@/components'
import { colors, layout, radius, spacing, typography } from '@/theme'
import {
  listMoreNavigation,
  listWorkNavigation,
  listHomeNavigation,
  type MobileNavigationEntry,
  type NavigationSection,
} from '@/auth/navigationCatalog'
import { useNavigationAuthContext } from '@/auth/useNavigationAccess'

export function ModuleHubScreen({
  title,
  subtitle,
  group,
  sections = ['home', 'work', 'more'],
}: {
  title: string
  subtitle?: string
  group: NonNullable<MobileNavigationEntry['group']>
  sections?: NavigationSection[]
}) {
  const ctx = useNavigationAuthContext()
  const router = useRouter()
  const entries: MobileNavigationEntry[] = []
  const seen = new Set<string>()
  for (const section of sections) {
    const list =
      section === 'home'
        ? listHomeNavigation(ctx)
        : section === 'work'
          ? listWorkNavigation(ctx)
          : listMoreNavigation(ctx)
    for (const e of list) {
      if (e.group !== group) continue
      if (seen.has(e.href)) continue
      seen.add(e.href)
      entries.push(e)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title={title} subtitle={subtitle} showBack />
      <View style={styles.body}>
        {entries.length === 0 ? (
          <EmptyState
            title="No access"
            description="This module is not enabled or you lack required permissions."
            icon="lock-closed-outline"
          />
        ) : (
          entries.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(e.href as never)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <AppCard style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.icon}>
                    <Ionicons
                      name={(e.icon as keyof typeof Ionicons.glyphMap) || 'ellipse-outline'}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.label}>{e.label}</Text>
                    {e.description ? <Text style={styles.desc}>{e.description}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </AppCard>
            </Pressable>
          ))
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: { padding: layout.screenPadding, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  label: { ...typography.bodyStrong },
  desc: { ...typography.caption, marginTop: 2 },
})
