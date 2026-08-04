import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppCard, AppHeader, Avatar, ListTile } from '@/components'
import { Ionicons } from '@expo/vector-icons'
import { colors, layout, motion, radius, shadows, spacing, typography } from '@/theme'
import { useSessionStore } from '@/store/sessionStore'
import { env } from '@/config/env'
import { isModuleEnabled } from '@/auth/modules'
import { can } from '@/auth/permissions'

type Link = {
  label: string
  href: string
  icon: keyof typeof Ionicons.glyphMap
  show?: boolean
  hint?: string
}

export default function MoreScreen() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const crmOn = isModuleEnabled('crm')
  const fullName = profile?.user
    ? `${profile.user.firstName} ${profile.user.lastName}`.trim()
    : 'User'

  const links: Link[] = (
    [
      {
        label: 'Leads',
        href: '/(app)/crm/leads',
        icon: 'person-outline' as const,
        hint: 'Prospect pipeline',
        show: crmOn || can('crm.lead.view'),
      },
      {
        label: 'Opportunities',
        href: '/(app)/crm/opportunities',
        icon: 'funnel-outline' as const,
        hint: 'Deals & stages',
        show: can('crm.opportunity.view') || crmOn,
      },
      {
        label: 'Quotations',
        href: '/(app)/crm/quotations',
        icon: 'document-text-outline' as const,
        hint: 'Commercial quotes',
        show: can('crm.quotation.view') || crmOn,
      },
      {
        label: 'Sales Orders',
        href: '/(app)/crm/sales-orders',
        icon: 'cart-outline' as const,
        hint: 'Converted orders',
        show: can('crm.sales_order.view') || crmOn,
      },
      {
        label: 'Follow-ups',
        href: '/(app)/crm/follow-ups',
        icon: 'alarm-outline' as const,
        hint: 'Tasks & reminders',
        show: can('crm.follow_up.view') || crmOn,
      },
      {
        label: 'Search',
        href: '/(app)/crm/search',
        icon: 'search-outline' as const,
        hint: 'Global CRM search',
        show: true,
      },
      {
        label: 'Collection',
        href: '/(app)/crm/collection',
        icon: 'cash-outline' as const,
        hint: 'Outstanding balances',
        show: true,
      },
      {
        label: 'Notifications',
        href: '/(app)/crm/notifications',
        icon: 'notifications-outline' as const,
        hint: 'Alerts & updates',
        show: true,
      },
      {
        label: 'Profile',
        href: '/(app)/profile',
        icon: 'person-circle-outline' as const,
        hint: 'Account details',
        show: true,
      },
      {
        label: 'Settings',
        href: '/(app)/settings',
        icon: 'settings-outline' as const,
        hint: 'App preferences',
        show: true,
      },
    ] satisfies Link[]
  ).filter((l) => l.show !== false)

  return (
    <View style={styles.flex}>
      <AppHeader title="More" subtitle="Modules & account" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [styles.profileCard, pressed && styles.profilePressed]}
          onPress={() => router.push('/(app)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Avatar name={fullName} size={54} />
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {profile?.user.email}
            </Text>
            <Text style={styles.profileOrg}>{profile?.tenant?.name ?? 'Organisation'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <AppCard padded={false} style={styles.menu}>
          {links.map((l, i) => (
            <View key={l.href}>
              <ListTile
                title={l.label}
                subtitle={l.hint}
                icon={l.icon}
                onPress={() => router.push(l.href as never)}
              />
              {i < links.length - 1 ? <View style={styles.div} /> : null}
            </View>
          ))}
        </AppCard>
        <Text style={styles.meta}>
          {env.appEnv} · v{env.appVersion}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 88,
    ...shadows.card,
  },
  profilePressed: { opacity: 0.92, transform: [{ scale: motion.pressScaleSoft }] },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { ...typography.subtitle, fontSize: 18 },
  profileEmail: { ...typography.caption, marginTop: 3, color: colors.textMuted },
  profileOrg: {
    ...typography.captionStrong,
    color: colors.primary,
    marginTop: 4,
  },
  menu: { overflow: 'hidden' },
  div: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: 70 },
  meta: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xxl,
  },
})
