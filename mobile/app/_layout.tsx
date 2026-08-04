import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { StatusBar } from 'expo-status-bar'
import { AppProviders } from '@/providers/AppProviders'
import { colors } from '@/theme'
import { handleNotificationDeepLink } from '@/features/crm/deeplinks'
import { useSessionStore } from '@/store/sessionStore'

function DeepLinkBridge() {
  const router = useRouter()
  const status = useSessionStore((s) => s.status)

  useEffect(() => {
    const route = (url: string | null) => {
      if (!url || status !== 'signed_in') return
      // Only act on real CRM deep links. Normal web reloads (/, tabs, etc.)
      // must not be forced to /crm/unavailable with "Missing entity".
      const href = handleNotificationDeepLink(url)
      if (!href) return
      router.push(href as never)
    }
    void Linking.getInitialURL().then(route)
    const sub = Linking.addEventListener('url', ({ url }) => route(url))
    return () => sub.remove()
  }, [router, status])

  return null
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <DeepLinkBridge />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AppProviders>
  )
}
