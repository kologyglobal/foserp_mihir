import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, motion, radius, spacing, typography } from '@/theme'

export type QuickActionTint =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'rose'
  | 'grey'
  | 'primary'
  | 'neutral'

type Props = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  /** Pastel circle + matching icon color. `primary`/`neutral` kept for compatibility. */
  tone?: QuickActionTint
}

const TINTS: Record<
  QuickActionTint,
  { bg: string; fg: string }
> = {
  blue: { bg: colors.primaryMuted, fg: colors.primary },
  primary: { bg: colors.primaryMuted, fg: colors.primary },
  green: { bg: colors.successMuted, fg: colors.success },
  purple: { bg: colors.purpleMuted, fg: colors.purple },
  orange: { bg: colors.orangeMuted, fg: colors.orange },
  rose: { bg: colors.roseMuted, fg: colors.rose },
  grey: { bg: colors.draftMuted, fg: colors.draft },
  neutral: { bg: colors.draftMuted, fg: colors.draft },
}

export function QuickActionButton({ label, icon, onPress, tone = 'blue' }: Props) {
  const tint = TINTS[tone] ?? TINTS.blue
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={[styles.circle, { backgroundColor: tint.bg }]}>
        <Ionicons name={icon} size={24} color={tint.fg} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: 76,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.88, transform: [{ scale: motion.pressScale }] },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.captionStrong,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
})
