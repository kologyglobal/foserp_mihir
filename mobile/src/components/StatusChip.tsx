import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme'

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, { bg: string; fg: string }> = {
  default: { bg: colors.chipDefaultBg, fg: colors.chipDefaultText },
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
  info: { bg: colors.infoMuted, fg: colors.info },
}

function humanize(label: string): string {
  return String(label)
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

type Props = {
  label: string
  tone?: Tone
  /** Smaller chip for dense list rows */
  compact?: boolean
}

export function StatusChip({ label, tone = 'default', compact }: Props) {
  const t = tones[tone]
  const display = humanize(label)
  return (
    <View style={[styles.chip, compact && styles.compact, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, compact && styles.labelCompact, { color: t.fg }]} numberOfLines={1}>
        {display}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  compact: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  label: { ...typography.captionStrong, fontSize: 12 },
  labelCompact: { fontSize: 11 },
})
