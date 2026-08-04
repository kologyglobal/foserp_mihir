import type { ReactNode } from 'react'
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius, shadows, spacing } from '@/theme'

type Props = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
  /** Flatter surfaces for nested content */
  flat?: boolean
}

export function AppCard({ children, style, padded = true, flat = false }: Props) {
  return (
    <View style={[styles.card, flat && styles.flat, padded && styles.padded, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  flat: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceMuted,
  },
  padded: { padding: spacing.xl },
})
