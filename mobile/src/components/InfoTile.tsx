import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme'

type Props = {
  label: string
  value: string
  hint?: string
}

export function InfoTile({ label, value, hint }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={2}>
        {value || '—'}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    ...typography.micro,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    color: colors.textMuted,
  },
  value: { ...typography.bodyStrong, fontSize: 16 },
  hint: { ...typography.caption, marginTop: spacing.xs, color: colors.textMuted },
})
