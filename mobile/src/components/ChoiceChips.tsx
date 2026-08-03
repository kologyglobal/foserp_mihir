import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme'

export type ChoiceOption = {
  value: string
  label: string
}

type Props = {
  label: string
  options: ChoiceOption[]
  value: string
  onChange: (value: string) => void
  hint?: string
}

/** Large touch choice chips for wizards — not tiny ERP radios. */
export function ChoiceChips({ label, options, value, onChange, hint }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 14,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  chipLabel: { ...typography.captionStrong, color: colors.textSecondary },
  chipLabelActive: { color: colors.primary },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
})
