import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, motion, spacing, typography } from '@/theme'

type Props = {
  title: string
  /** Optional friendly cue under the title (e.g. recommendation framing). */
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  /**
   * `default` — section title (18/semibold).
   * `label` — uppercase micro grey section label (e.g. TODAY'S PLAN).
   */
  variant?: 'default' | 'label'
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  variant = 'default',
}: Props) {
  const isLabel = variant === 'label'
  return (
    <View style={[styles.wrap, isLabel && styles.wrapLabel]}>
      <View style={styles.row}>
        <Text style={[styles.title, isLabel && styles.titleLabel]} numberOfLines={1}>
          {isLabel ? title.toUpperCase() : title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={10}
            style={({ pressed }) => pressed && styles.actionPressed}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle && !isLabel ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    marginTop: spacing.section - spacing.sm,
  },
  wrapLabel: {
    marginBottom: spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  title: {
    ...typography.subtitle,
    fontSize: 18,
    letterSpacing: -0.25,
    flex: 1,
    paddingRight: spacing.sm,
  },
  titleLabel: {
    ...typography.micro,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  action: { ...typography.captionStrong, color: colors.primary, fontSize: 14 },
  actionPressed: { opacity: 0.75, transform: [{ scale: motion.pressScale }] },
})
