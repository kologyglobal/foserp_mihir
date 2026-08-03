import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius, shadows, spacing } from '@/theme'

type Props = {
  width?: number | `${number}%`
  height?: number
  style?: StyleProp<ViewStyle>
  rounded?: boolean
}

export function Skeleton({ width = '100%', height = 14, style, rounded }: Props) {
  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius: rounded ? radius.full : radius.sm },
        style,
      ]}
    />
  )
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} rounded style={{ borderRadius: 14 }} />
        <View style={styles.col}>
          <Skeleton width="48%" height={12} />
          <Skeleton width="72%" height={16} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
      <Skeleton width="100%" height={10} style={{ marginTop: spacing.lg }} />
      <Skeleton width="64%" height={10} style={{ marginTop: spacing.sm }} />
    </View>
  )
}

export function SkeletonMetricRow() {
  return (
    <View style={styles.metrics}>
      <View style={styles.metric}>
        <Skeleton width={36} height={36} rounded />
        <Skeleton width="50%" height={10} style={{ marginTop: spacing.md }} />
        <Skeleton width="70%" height={22} style={{ marginTop: spacing.sm }} />
      </View>
      <View style={styles.metric}>
        <Skeleton width={36} height={36} rounded />
        <Skeleton width="50%" height={10} style={{ marginTop: spacing.md }} />
        <Skeleton width="70%" height={22} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.skeleton },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  col: { flex: 1 },
  metrics: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
})
