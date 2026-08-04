import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '@/theme'

export type WizardStep = {
  key: string
  label: string
}

type Props = {
  steps: WizardStep[]
  currentIndex: number
}

export function WizardStepper({ steps, currentIndex }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      <View style={styles.track}>
        {steps.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <View key={step.key} style={styles.segment}>
              <View
                style={[
                  styles.dot,
                  (done || active) && styles.dotActive,
                  done && styles.dotDone,
                ]}
              >
                <Text
                  style={[
                    styles.dotText,
                    active && styles.dotTextActive,
                    done && styles.dotTextDone,
                  ]}
                >
                  {done ? '✓' : i + 1}
                </Text>
              </View>
              <Text
                style={[styles.label, active && styles.labelActive, done && styles.labelDone]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              {i < steps.length - 1 ? (
                <View style={[styles.line, i < currentIndex && styles.lineDone]} />
              ) : null}
            </View>
          )
        })}
      </View>
      <Text style={styles.progress}>
        Step {currentIndex + 1} of {steps.length}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.section },
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primarySoft,
  },
  dotText: {
    ...typography.captionStrong,
    color: colors.textMuted,
    fontSize: 12,
  },
  dotTextActive: { color: colors.textInverse },
  dotTextDone: { color: colors.primary },
  label: {
    ...typography.micro,
    marginTop: spacing.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 76,
  },
  labelActive: { color: colors.primary },
  labelDone: { color: colors.textSecondary },
  line: {
    position: 'absolute',
    top: 16,
    left: '55%',
    right: '-45%',
    height: 2,
    backgroundColor: colors.border,
    zIndex: 0,
  },
  lineDone: { backgroundColor: colors.primarySoft },
  progress: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
})
