import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { colors, motion, radius, spacing, typography } from '@/theme'

type Props = PressableProps & {
  title: string
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  destructive?: boolean
}

export function SecondaryButton({ title, disabled, fullWidth, style, destructive, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        destructive && styles.destructive,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.label, destructive && styles.destructiveLabel]}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  destructive: { borderColor: colors.danger, backgroundColor: colors.dangerMuted },
  fullWidth: { alignSelf: 'stretch' },
  pressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: motion.pressScale }],
    opacity: 0.94,
  },
  disabled: { opacity: 0.45 },
  label: { ...typography.button, color: colors.text },
  destructiveLabel: { color: colors.danger },
})
