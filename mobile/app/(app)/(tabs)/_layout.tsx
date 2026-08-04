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
          name="customers"
          options={{
            title: 'Customers',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon focused={focused} color={color} outline="people-outline" solid="people" />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
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
