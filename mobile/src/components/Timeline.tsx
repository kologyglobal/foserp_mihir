import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, spacing, typography } from '@/theme'
import { AppCard } from '@/components/AppCard'

export type TimelineItem = {
  id: string
  title: string
  subtitle?: string
  time?: string
  icon?: keyof typeof Ionicons.glyphMap
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const iconTone: Record<NonNullable<TimelineItem['tone']>, { bg: string; fg: string }> = {
  default: { bg: colors.draftMuted, fg: colors.draft },
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
  info: { bg: colors.primaryMuted, fg: colors.primary },
}

type Props = {
  items: TimelineItem[]
}

export function Timeline({ items }: Props) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const tone = item.tone ?? 'info'
        const t = iconTone[tone]
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: t.bg }]}>
                <Ionicons name={item.icon ?? 'ellipse-outline'} size={14} color={t.fg} />
              </View>
              {index < items.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <AppCard style={styles.card} flat>
              <View style={styles.head}>
                <Text style={styles.title}>{item.title}</Text>
                {item.time ? <Text style={styles.time}>{item.time}</Text> : null}
              </View>
              {item.subtitle ? <Text style={styles.sub}>{item.subtitle}</Text> : null}
            </AppCard>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 32, alignItems: 'center' },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
    borderRadius: 1,
  },
  card: { flex: 1, marginBottom: spacing.md, padding: spacing.lg },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  time: { ...typography.caption, color: colors.textMuted },
  sub: { ...typography.caption, marginTop: spacing.xs, color: colors.textSecondary },
})
