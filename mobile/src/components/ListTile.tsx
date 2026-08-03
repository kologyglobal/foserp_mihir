import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, motion, radius, spacing, typography } from '@/theme'
import { Avatar } from '@/components/Avatar'
import { StatusChip } from '@/components/StatusChip'

type Props = {
  title: string
  subtitle?: string
  meta?: string
  status?: string
  statusTone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  avatarName?: string
  icon?: keyof typeof Ionicons.glyphMap
  right?: ReactNode
  onPress?: () => void
  /** Hide trailing chevron even when pressable */
  hideChevron?: boolean
}

export function ListTile({
  title,
  subtitle,
  meta,
  status,
  statusTone = 'default',
  avatarName,
  icon,
  right,
  onPress,
  hideChevron,
}: Props) {
  const trailing =
    right ??
    (onPress && !hideChevron ? (
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
    ) : null)

  const body = (
    <View style={styles.row}>
      {avatarName ? (
        <Avatar name={avatarName} size={46} />
      ) : icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {status ? <StatusChip label={status} tone={statusTone} compact /> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={styles.wrap}>{body}</View>
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.sm,
    minHeight: 68,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.9, transform: [{ scale: motion.pressScaleSoft }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: { ...typography.bodyStrong, flexShrink: 1 },
  subtitle: { ...typography.caption, marginTop: 3 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chevron: { marginLeft: spacing.xs },
})
