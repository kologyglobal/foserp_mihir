import { View, StyleSheet, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, shadows, typography } from '@/theme'
import { OfflineBanner } from '@/components'
import { useOfflineDraftSync } from '@/features/crm/hooks'

function TabBarIcon({
  focused,
  color,
  outline,
  solid,
}: {
  focused: boolean
  color: string
  outline: keyof typeof Ionicons.glyphMap
  solid: keyof typeof Ionicons.glyphMap
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={focused ? solid : outline} color={color} size={22} />
    </View>
  )
}

/**
 * Shared tabs only: Home · Work · Approvals · More.
 * CRM customers/tasks stay as screens (hidden tabs) for deep links.
 */
export default function TabsLayout() {
  useOfflineDraftSync()

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 90 : 70,
            paddingTop: 6,
            paddingBottom: Platform.OS === 'ios' ? 28 : 12,
            ...shadows.tabBar,
          },
          tabBarLabelStyle: {
            ...typography.micro,
            fontSize: 11,
            fontWeight: '600',
            marginTop: 0,
            letterSpacing: 0.15,
          },
          tabBarItemStyle: {
            paddingTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon focused={focused} color={color} outline="home-outline" solid="home" />
            ),
          }}
        />
        <Tabs.Screen
          name="work"
          options={{
            title: 'Work',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                focused={focused}
                color={color}
                outline="checkbox-outline"
                solid="checkbox"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="approvals"
          options={{
            title: 'Approvals',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                focused={focused}
                color={color}
                outline="document-text-outline"
                solid="document-text"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon focused={focused} color={color} outline="grid-outline" solid="grid" />
            ),
          }}
        />
        {/* Legacy CRM route hosts — keep for deep links; never fixed module tabs */}
        <Tabs.Screen name="customers" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  iconWrap: {
    width: 48,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryMuted,
  },
})
