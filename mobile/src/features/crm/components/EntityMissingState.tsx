import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AppHeader, EmptyState } from '@/components'
import { ApiError } from '@/api/errors'
import { colors } from '@/theme'

type Props = {
  title?: string
  entityLabel?: string
  error?: unknown
  onRetry?: () => void
}

/**
 * Premium empty state when a detail fetch 404s or the id is missing.
 */
export function EntityMissingState({
  title = 'Record unavailable',
  entityLabel = 'record',
  error,
  onRetry,
}: Props) {
  const router = useRouter()
  const isNotFound =
    error instanceof ApiError
      ? error.kind === 'not_found' || error.status === 404
      : !error || (error instanceof Error && /not found/i.test(error.message))

  const description = isNotFound
    ? `This ${entityLabel} could not be found. It may have been removed, or you may not have access.`
    : error instanceof Error
      ? error.message
      : `This ${entityLabel} cannot be opened right now.`

  const goHome = () => router.replace('/(app)/(tabs)')
  const goBack = () => {
    if (router.canGoBack()) router.back()
    else goHome()
  }

  return (
    <View style={styles.flex}>
      <AppHeader title={title} onBack={goBack} />
      <View style={styles.body}>
        <EmptyState
          title={isNotFound ? `${capitalize(entityLabel)} not found` : 'Record unavailable'}
          description={description}
          icon={isNotFound ? 'file-tray-outline' : 'cloud-offline-outline'}
          actionLabel={onRetry ? 'Try again' : 'Go back'}
          onAction={onRetry ?? goBack}
          secondaryLabel="Go home"
          onSecondary={goHome}
        />
      </View>
    </View>
  )
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center' },
})
