import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '@/theme'
import { SecondaryButton } from '@/components/SecondaryButton'
import { getUserFriendlyMessage } from '@/api/errors'

type Props = {
  error: unknown
  onRetry?: () => void
  title?: string
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: Props) {
  const message = getUserFriendlyMessage(error)
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <SecondaryButton title="Try again" onPress={onRetry} style={styles.btn} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.subtitle, textAlign: 'center' },
  message: { ...typography.caption, textAlign: 'center', maxWidth: 320, color: colors.textMuted },
  btn: { marginTop: spacing.md },
})
