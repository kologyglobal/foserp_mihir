import { useCallback, useEffect, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, StatusChip } from '@/components'
import { ContextualActionsSheet } from '@/features/crm/components/ContextualActionsSheet'
import {
  companyOf,
  oppAmount,
  ownerOf,
  productOf,
  stageLabelOf,
} from '@/features/crm/opportunityDisplay'
import { formatDate, formatMoney, statusTone } from '@/features/crm/utils'
import { colors, radius, shadows, spacing, typography } from '@/theme'
import type { CrmOpportunity, PipelineStage } from '@/types/crm'

const SCREEN_W = Dimensions.get('window').width
const SWIPE_OUT = SCREEN_W * 1.15
const THRESHOLD = 96

function MiniBars({ seed }: { seed: string }) {
  const heights = [8, 12, 10, 16, 14, 18, 12]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return (
    <View style={styles.sparkBars} accessibilityElementsHidden>
      {heights.map((base, i) => {
        const height = 6 + ((base + (h >> (i * 2)) % 10) % 14)
        return (
          <View
            key={i}
            style={[
              styles.sparkBar,
              {
                height,
                backgroundColor: i === heights.length - 1 ? colors.primary : colors.primarySoft,
              },
            ]}
          />
        )
      })}
    </View>
  )
}

function productLine(o: CrmOpportunity, company: string): string {
  const p = productOf(o)
  if (!p || p.toLowerCase() === company.toLowerCase()) return ''
  return p
}

type CardFaceProps = {
  opportunity: CrmOpportunity
  stages: PipelineStage[]
  eyebrow: string
  onPressOpen?: () => void
  showHints?: boolean
}

function CardFace({
  opportunity: o,
  stages,
  eyebrow,
  onPressOpen,
  showHints = true,
}: CardFaceProps) {
  const company = companyOf(o)
  const product = productLine(o, company)
  const stageLabel = stageLabelOf(o, stages)
  const owner = ownerOf(o)

  const body = (
    <>
      <View style={styles.featuredHead}>
        <Text style={styles.featuredEyebrow}>{eyebrow}</Text>
        <View style={styles.featuredIcons}>
          <View style={styles.trophyWrap}>
            <Ionicons name="trophy-outline" size={18} color={colors.orange} />
          </View>
          <MiniBars seed={o.id || company} />
        </View>
      </View>

      <View style={styles.featuredCompanyRow}>
        <Text style={styles.featuredCompany} numberOfLines={2}>
          {company}
        </Text>
        {onPressOpen ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null}
      </View>

      {product ? (
        <Text style={styles.featuredProduct} numberOfLines={2}>
          {product}
        </Text>
      ) : null}

      <Text style={styles.featuredAmount}>{formatMoney(oppAmount(o))}</Text>

      <View style={styles.featuredMeta}>
        <StatusChip label={stageLabel} tone={statusTone(stageLabel)} compact />
        <View style={styles.featuredOwner}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <Text style={styles.featuredOwnerText}>
            {formatDate(o.expectedCloseDate) || 'No close date'}
          </Text>
          <Text style={styles.featuredDot}>·</Text>
          <Avatar name={owner} size={20} />
          <Text style={styles.featuredOwnerText} numberOfLines={1}>
            {owner}
          </Text>
        </View>
      </View>

      {showHints ? (
        <View style={styles.hintRow}>
          <View style={styles.hintLeft}>
            <Ionicons name="arrow-back" size={12} color={colors.textMuted} />
            <Text style={styles.hintText}>Snooze</Text>
          </View>
          <View style={styles.hintRight}>
            <Text style={styles.hintTextAction}>Follow-up</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </View>
        </View>
      ) : null}
    </>
  )

  if (!onPressOpen) {
    return <View style={styles.cardInner}>{body}</View>
  }

  return (
    <Pressable
      onPress={onPressOpen}
      accessibilityRole="button"
      accessibilityLabel={`${company}, ${formatMoney(oppAmount(o))}`}
      style={styles.cardInner}
    >
      {body}
    </Pressable>
  )
}

type TopCardProps = {
  opportunity: CrmOpportunity
  stages: PipelineStage[]
  remaining: number
  onSnooze: (o: CrmOpportunity) => void
  onEngage: (o: CrmOpportunity) => void
  onOpen: (o: CrmOpportunity) => void
}

function SwipeableFocusCard({
  opportunity,
  stages,
  remaining,
  onSnooze,
  onEngage,
  onOpen,
}: TopCardProps) {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    translateX.value = 0
    translateY.value = 0
    setLocked(false)
  }, [opportunity.id, translateX, translateY])

  const finishLeft = useCallback(() => {
    onSnooze(opportunity)
  }, [onSnooze, opportunity])

  const finishRight = useCallback(() => {
    onEngage(opportunity)
  }, [onEngage, opportunity])

  const lock = useCallback(() => setLocked(true), [])

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      translateX.value = e.translationX
      translateY.value = e.translationY * 0.18
    })
    .onEnd((e) => {
      const x = e.translationX
      if (x > THRESHOLD) {
        runOnJS(lock)()
        translateX.value = withTiming(SWIPE_OUT, { duration: 220 }, (done) => {
          if (done) runOnJS(finishRight)()
        })
      } else if (x < -THRESHOLD) {
        runOnJS(lock)()
        translateX.value = withTiming(-SWIPE_OUT, { duration: 220 }, (done) => {
          if (done) runOnJS(finishLeft)()
        })
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 })
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 })
      }
    })

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-12, 0, 12],
      Extrapolation.CLAMP,
    )
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    }
  })

  const leftLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-THRESHOLD * 1.4, -40, 0],
      [1, 0.6, 0],
      Extrapolation.CLAMP,
    ),
  }))

  const rightLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 40, THRESHOLD * 1.4],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    ),
  }))

  const eyebrow =
    remaining > 1 ? `TODAY'S FOCUS · ${remaining} LEFT` : "TODAY'S FOCUS"

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.View style={[styles.stamp, styles.stampSnooze, leftLabelStyle]} pointerEvents="none">
          <Text style={styles.stampSnoozeText}>SNOOZE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampAct, rightLabelStyle]} pointerEvents="none">
          <Text style={styles.stampActText}>ACT</Text>
        </Animated.View>
        <CardFace
          opportunity={opportunity}
          stages={stages}
          eyebrow={eyebrow}
          onPressOpen={() => onOpen(opportunity)}
        />
      </Animated.View>
    </GestureDetector>
  )
}

export type TodayFocusDeckProps = {
  items: CrmOpportunity[]
  stages: PipelineStage[]
  onOpen: (o: CrmOpportunity) => void
  /** Swipe left — persist snooze + remove from deck. */
  onSnooze: (o: CrmOpportunity) => void
  /**
   * Called when user engages (right swipe / green button) so parent can drop
   * the card from the in-session queue while the action sheet is open.
   */
  onSessionDismiss: (o: CrmOpportunity) => void
  onAddFollowUp: (o: CrmOpportunity) => void
  onLogActivity: (o: CrmOpportunity) => void
}

/**
 * Tinder-style deck of "Today's focus" opportunities.
 * Left = snooze · Right = follow-up / activity.
 */
export function TodayFocusDeck({
  items,
  stages,
  onOpen,
  onSnooze,
  onSessionDismiss,
  onAddFollowUp,
  onLogActivity,
}: TodayFocusDeckProps) {
  const [engageTarget, setEngageTarget] = useState<CrmOpportunity | null>(null)

  const onEngage = useCallback(
    (o: CrmOpportunity) => {
      setEngageTarget(o)
      onSessionDismiss(o)
    },
    [onSessionDismiss],
  )

  if (!items.length) {
    return (
      <View style={styles.emptyDeck}>
        <Ionicons name="checkmark-circle-outline" size={28} color={colors.success} />
        <Text style={styles.emptyTitle}>Focus clear</Text>
        <Text style={styles.emptyBody}>
          No open deals due soon. New ones appear here as close dates approach.
        </Text>
      </View>
    )
  }

  const top = items[0]!
  const under = items[1]

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        {under ? (
          <View style={[styles.card, styles.cardUnder]} pointerEvents="none">
            <CardFace
              opportunity={under}
              stages={stages}
              eyebrow="UP NEXT"
              showHints={false}
            />
          </View>
        ) : null}

        <SwipeableFocusCard
          key={top.id}
          opportunity={top}
          stages={stages}
          remaining={items.length}
          onSnooze={onSnooze}
          onEngage={onEngage}
          onOpen={onOpen}
        />
      </View>

      <View style={styles.actionBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Snooze opportunity"
          onPress={() => onSnooze(top)}
          style={({ pressed }) => [styles.roundBtn, styles.snoozeBtn, pressed && styles.pressed]}
        >
          <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add follow-up or activity"
          onPress={() => onEngage(top)}
          style={({ pressed }) => [styles.roundBtn, styles.actBtn, pressed && styles.pressed]}
        >
          <Ionicons name="checkmark" size={24} color={colors.textInverse} />
        </Pressable>
      </View>

      <Text style={styles.legend}>
        Swipe left to snooze · Swipe right for follow-up / activity
      </Text>

      <ContextualActionsSheet
        visible={Boolean(engageTarget)}
        onClose={() => setEngageTarget(null)}
        title={engageTarget ? `Act · ${companyOf(engageTarget)}` : 'Act on deal'}
        actions={[
          {
            key: 'fu',
            label: 'Schedule follow-up',
            onPress: () => {
              if (engageTarget) onAddFollowUp(engageTarget)
              setEngageTarget(null)
            },
          },
          {
            key: 'act',
            label: 'Log activity / meeting',
            onPress: () => {
              if (engageTarget) onLogActivity(engageTarget)
              setEngageTarget(null)
            },
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  stack: {
    position: 'relative',
    minHeight: 268,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
    overflow: 'hidden',
  },
  cardUnder: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 10,
    opacity: 0.55,
    transform: [{ scale: 0.97 }],
  },
  cardInner: {
    padding: spacing.xl,
  },
  stamp: {
    position: 'absolute',
    top: 48,
    zIndex: 4,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stampSnooze: {
    left: 20,
    borderColor: colors.textMuted,
    transform: [{ rotate: '-12deg' }],
  },
  stampAct: {
    right: 20,
    borderColor: colors.success,
    transform: [{ rotate: '12deg' }],
  },
  stampSnoozeText: {
    ...typography.captionStrong,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  stampActText: {
    ...typography.captionStrong,
    color: colors.success,
    letterSpacing: 1,
  },
  featuredHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  featuredEyebrow: {
    ...typography.micro,
    color: colors.primary,
    letterSpacing: 0.8,
  },
  featuredIcons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  trophyWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 22,
  },
  sparkBar: {
    width: 4,
    borderRadius: 2,
  },
  featuredCompanyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featuredCompany: {
    ...typography.subtitle,
    fontSize: 18,
    flex: 1,
  },
  featuredProduct: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  featuredAmount: {
    ...typography.metric,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  featuredMeta: {
    gap: spacing.sm,
  },
  featuredOwner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  featuredOwnerText: {
    ...typography.caption,
    color: colors.textSecondary,
    maxWidth: 140,
  },
  featuredDot: {
    ...typography.caption,
    color: colors.textMuted,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  hintLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintText: { ...typography.micro, color: colors.textMuted },
  hintTextAction: { ...typography.micro, color: colors.primary, fontWeight: '700' },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  roundBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  snoozeBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  actBtn: {
    backgroundColor: colors.success,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  legend: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyDeck: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.bodyStrong, color: colors.text },
  emptyBody: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
