import type { ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, layout, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  title: string
  subtitle?: string
  /** Custom back handler. Defaults to router.back() or Home. */
  onBack?: () => void
  /** Hide the back control (rare — e.g. full-screen takeover). Default: always show. */
  showBack?: boolean
  right?: ReactNode
  style?: StyleProp<ViewStyle>
  /** Soft canvas blend for hub screens */
  transparent?: boolean
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  style,
  transparent,
}: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(app)/(tabs)')
    }
  }

  return (
    <View
      style={[
        styles.wrap,
        transparent && styles.transparent,
        { paddingTop: Math.max(insets.top, spacing.sm) + spacing.xs },
        style,
      ]}
    >
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            hitSlop={layout.hitSlop}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.sideSlot} />
        )}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{right ?? <View style={styles.sideSlot} />}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
    paddingHorizontal: layout.screenPadding,
  },
  transparent: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  iconBtn: {
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
  iconPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  sideSlot: { width: 44 },
  titles: { flex: 1, paddingHorizontal: spacing.md },
  title: { ...typography.subtitle, fontSize: 19, letterSpacing: -0.25 },
  subtitle: { ...typography.caption, marginTop: 3, color: colors.textMuted },
  right: {
    minWidth: 44,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
})
