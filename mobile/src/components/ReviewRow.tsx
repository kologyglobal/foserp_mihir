import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '@/theme'

type Props = {
  label: string
  value: string
  last?: boolean
}

export function ReviewRow({ label, value, last }: Props) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  value: { ...typography.bodyStrong },
})
