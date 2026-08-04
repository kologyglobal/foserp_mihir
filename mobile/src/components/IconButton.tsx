import { Pressable, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, layout, motion, radius, shadows, typography } from '@/theme'

type Props = {
  name: keyof typeof Ionicons.glyphMap
  onPress: () => void
  accessibilityLabel: string
  /** Red dot when true (ignored if badgeCount is set) */
  badge?: boolean
  /** Numeric badge count; shown when > 0 */
  badgeCount?: number
  size?: number
  /** Circle (default) or rounded square menu control */
  shape?: 'circle' | 'square'
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  badge,
  badgeCount,
  size = 20,
  shape = 'circle',
}: Props) {
  const count = badgeCount != null && badgeCount > 0 ? badgeCount : 0
  const showDot = count === 0 && !!badge
  const countLabel = count > 99 ? '99+' : String(count)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `${accessibilityLabel}, ${count} unread` : accessibilityLabel
      }
      onPress={onPress}
      hitSlop={layout.hitSlop}
      style={({ pressed }) => [
        styles.btn,
        shape === 'square' && styles.btnSquare,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={name} size={size} color={colors.text} />
      {count > 0 ? (
        <View style={[styles.countBadge, count > 9 && styles.countBadgeWide]}>
          <Text style={styles.countText}>{countLabel}</Text>
        </View>
      ) : showDot ? (
        <View style={styles.badge} />
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.soft,
  },
  btnSquare: {
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.88, transform: [{ scale: motion.pressScale }] },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  countBadgeWide: {
    minWidth: 20,
    paddingHorizontal: 5,
  },
  countText: {
    ...typography.micro,
    fontSize: 9,
    lineHeight: 11,
    color: colors.textInverse,
    fontWeight: '700',
  },
})
