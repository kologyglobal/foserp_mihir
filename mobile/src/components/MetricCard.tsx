import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, motion, radius, shadows, spacing, typography } from '@/theme'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

const toneMap: Record<Tone, { iconBg: string; icon: string; accent: string }> = {
  default: { iconBg: colors.draftMuted, icon: colors.draft, accent: colors.draft },
  success: { iconBg: colors.successMuted, icon: colors.success, accent: colors.success },
  warning: { iconBg: colors.warningMuted, icon: colors.warning, accent: colors.warning },
  danger: { iconBg: colors.dangerMuted, icon: colors.danger, accent: colors.danger },
  info: { iconBg: colors.primaryMuted, icon: colors.primary, accent: colors.primary },
}

type Props = {
  label: string
  value: string | number
  hint?: string
  icon?: keyof typeof Ionicons.glyphMap
  tone?: Tone
  trendLabel?: string
  onPress?: () => void
}

export function MetricCard({
  label,
  value,
  hint,
  icon = 'analytics-outline',
  tone = 'info',
  trendLabel,
  onPress,
}: Props) {
  const t = toneMap[tone]
  const content = (
    <>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: t.iconBg }]}>
          <Ionicons name={icon} size={18} color={t.icon} />
        </View>
        {trendLabel ? (
          <View style={[styles.trendPill, { backgroundColor: t.iconBg }]}>
            <Text style={[styles.trend, { color: t.accent }]} numberOfLines={1}>
              {trendLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={styles.card}>{content}</View>
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 148,
    minHeight: 128,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: motion.pressScaleSoft }] },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    maxWidth: 88,
  },
  trend: { ...typography.micro, letterSpacing: 0.2 },
  label: {
    ...typography.label,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    color: colors.textMuted,
  },
  value: { ...typography.metric },
  hint: { ...typography.caption, marginTop: spacing.xs, color: colors.textMuted },
})
