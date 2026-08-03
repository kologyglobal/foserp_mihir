import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, motion, radius, shadows, spacing } from '@/theme'

type Props = {
  onPress: () => void
  icon?: keyof typeof Ionicons.glyphMap
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export function Fab({
  onPress,
  icon = 'add',
  style,
  accessibilityLabel = 'Quick create',
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed, style]}
    >
      <Ionicons name={icon} size={28} color={colors.textInverse} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl + 8,
    width: 58,
    height: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...shadows.float,
  },
  pressed: { opacity: 0.94, transform: [{ scale: motion.pressScale }] },
})
