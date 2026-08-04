import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { colors, motion, radius, shadows, spacing, typography } from '@/theme'

type Props = PressableProps & {
  title: string
  loading?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

export function PrimaryButton({ title, loading, disabled, fullWidth, style, ...rest }: Props) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.textInverse} />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadows.soft,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: motion.pressScale }],
    opacity: 0.96,
  },
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  label: { ...typography.button, color: colors.textInverse },
})
