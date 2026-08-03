import { Redirect } from 'expo-router'
import { Loading } from '@/components'
import { useSessionStore } from '@/store/sessionStore'

/**
 * Entry bootstrap — restores SecureStore session then routes auth vs app.
 */
export default function Index() {
  const status = useSessionStore((s) => s.status)

  if (status === 'unknown' || status === 'restoring') {
    return <Loading fullScreen label="Restoring session…" />
  }

  if (status === 'signed_in') {
    return <Redirect href="/(app)/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
