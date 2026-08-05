import { Redirect, Stack } from 'expo-router'
import { Loading } from '@/components'
import { useSessionStore } from '@/store/sessionStore'
import { colors } from '@/theme'

export default function AppLayout() {
  const status = useSessionStore((s) => s.status)

  if (status === 'unknown' || status === 'restoring') {
    return <Loading fullScreen label="Restoring session…" />
  }

  if (status !== 'signed_in') {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="crm" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="purchase" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="quality" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="store" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="gate" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
