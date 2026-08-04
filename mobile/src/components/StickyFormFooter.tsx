import { View, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { SecondaryButton } from '@/components/SecondaryButton'
import { colors, shadows, spacing } from '@/theme'

type Props = {
  primaryTitle: string
  onPrimary: () => void
  secondaryTitle?: string
  onSecondary?: () => void
  loading?: boolean
  primaryDisabled?: boolean
}

/** Sticky bottom bar for wizards / create forms — large touch targets, safe area aware. */
export function StickyFormFooter({
  primaryTitle,
  onPrimary,
  secondaryTitle,
  onSecondary,
  loading,
  primaryDisabled,
}: Props) {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, spacing.md)

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      <View style={styles.row}>
        {secondaryTitle && onSecondary ? (
          <SecondaryButton
            title={secondaryTitle}
            onPress={onSecondary}
            style={styles.secondary}
            disabled={loading}
          />
        ) : null}
        <PrimaryButton
          title={primaryTitle}
          onPress={onPrimary}
          loading={loading}
          disabled={primaryDisabled}
          fullWidth={!secondaryTitle}
          style={secondaryTitle ? styles.primary : undefined}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    ...shadows.float,
    ...Platform.select({
      android: { elevation: 14 },
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  secondary: { flex: 1, minHeight: 52 },
  primary: { flex: 1.4, minHeight: 52 },
})
