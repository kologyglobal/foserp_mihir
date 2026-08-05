/**
 * Phase 1 placeholder for operational module routes (no business write flows yet).
 */
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { AppHeader, EmptyState } from '@/components'
import { colors, layout, spacing } from '@/theme'

export function ComingSoonScreen({
  title,
  description = 'This screen ships in a later mobile phase. Use the module hub or web ERP for this action now.',
  hubHref,
  hubLabel = 'Back to module hub',
}: {
  title: string
  description?: string
  hubHref?: string
  hubLabel?: string
}) {
  const router = useRouter()
  return (
    <View style={styles.flex}>
      <AppHeader title={title} showBack />
      <View style={styles.body}>
        <EmptyState
          title="Coming soon"
          description={description}
          icon="construct-outline"
          actionLabel={hubHref ? hubLabel : undefined}
          onAction={hubHref ? () => router.replace(hubHref as never) : undefined}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    padding: layout.screenPadding,
    paddingTop: spacing.xl,
    justifyContent: 'center',
  },
})
