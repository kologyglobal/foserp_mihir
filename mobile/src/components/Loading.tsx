import { View, ActivityIndicator, StyleSheet, Text } from 'react-native'
import { colors, spacing, typography } from '@/theme'

type Props = {
  label?: string
  fullScreen?: boolean
}

export function Loading({ label = 'Loading…', fullScreen }: Props) {
  return (
    <View style={[styles.wrap, fullScreen && styles.full]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  full: { flex: 1, backgroundColor: colors.background },
  label: { ...typography.caption },
})
