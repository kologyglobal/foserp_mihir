import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '@/theme'
import { useSessionStore } from '@/store/sessionStore'

export function OfflineBanner() {
  const isOnline = useSessionStore((s) => s.isOnline)
  if (isOnline) return null
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>You are offline. Some actions will not work until you reconnect.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { ...typography.caption, color: colors.warning, textAlign: 'center' },
})
