import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, shadows, spacing, typography } from '@/theme'
import { PrimaryButton } from '@/components/PrimaryButton'
import { SecondaryButton } from '@/components/SecondaryButton'

type Props = {
  title: string
  description?: string
  icon?: keyof typeof Ionicons.glyphMap
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  /** Softer success moment (clear inbox / all done) */
  success?: boolean
}

export function EmptyState({
  title,
  description,
  icon = 'planet-outline',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  success,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, success && styles.iconSuccess]}>
        <Ionicons
          name={icon}
          size={32}
          color={success ? colors.success : colors.primary}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton title={actionLabel} onPress={onAction} style={styles.btn} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <SecondaryButton title={secondaryLabel} onPress={onSecondary} style={styles.btnSecondary} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.hero + spacing.md,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primarySoft,
    ...shadows.soft,
  },
  iconSuccess: {
    backgroundColor: colors.successMuted,
    borderColor: '#A7F3D0',
  },
  title: {
    ...typography.subtitle,
    textAlign: 'center',
    fontSize: 19,
    letterSpacing: -0.2,
  },
  description: {
    ...typography.caption,
    textAlign: 'center',
    maxWidth: 300,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  btn: { marginTop: spacing.lg, minWidth: 188, minHeight: 52 },
  btnSecondary: { marginTop: spacing.sm, minWidth: 188, minHeight: 52 },
})
