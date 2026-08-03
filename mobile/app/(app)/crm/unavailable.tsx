import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { AppHeader, EmptyState } from '@/components'
import { handleNotificationDeepLink } from '@/features/crm/deeplinks'
import { colors } from '@/theme'

function decodeParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined
  try {
    return decodeURIComponent(String(raw))
  } catch {
    return String(raw)
  }
}

function friendlyReason(reason?: string): string {
  if (!reason) {
    return 'This link is invalid, incomplete, or the record cannot be opened on mobile.'
  }
  switch (reason) {
    case 'Missing entity':
    case 'Empty link':
      return 'This link did not specify which CRM record to open.'
    case 'Missing record id':
      return 'This link is missing the record id. Open the list and choose the record again.'
    case 'Invalid record id':
    case 'Invalid approval id':
    case 'Invalid PDF record id':
      return 'The record id in this link is not valid. Ask for a fresh link from the web app or notification.'
    default:
      if (reason.startsWith('Unknown')) {
        return 'This link type is not supported on mobile yet. Try opening the record from CRM lists.'
      }
      return reason
  }
}

/** Safe landing when a deep link points to an invalid or unavailable CRM record. */
export default function UnavailableScreen() {
  const params = useLocalSearchParams<{ reason?: string; retry?: string }>()
  const reason = decodeParam(params.reason)
  const retry = decodeParam(params.retry)
  const router = useRouter()

  const goHome = () => {
    router.replace('/(app)/(tabs)')
  }

  const goBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    goHome()
  }

  const onRetry = () => {
    if (!retry) return
    const href = handleNotificationDeepLink(retry)
    if (href && !href.includes('/crm/unavailable')) {
      router.replace(href as never)
      return
    }
    // Still bad — stay here with clear copy
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Unavailable" onBack={goBack} />
      <View style={styles.body}>
        <EmptyState
          title="Record unavailable"
          description={friendlyReason(reason)}
          icon="unlink-outline"
          actionLabel={retry ? 'Try again' : 'Go home'}
          onAction={retry ? onRetry : goHome}
          secondaryLabel={retry ? 'Go home' : 'Go back'}
          onSecondary={retry ? goHome : goBack}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center' },
})
