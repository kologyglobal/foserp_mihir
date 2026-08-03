import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, motion, radius, shadows, spacing, typography } from '@/theme'
import { useToastStore, type ToastTone } from '@/store/toastStore'

type ToneStyle = {
  bg: string
  fg: string
  border: string
  icon: keyof typeof Ionicons.glyphMap
}

const TONES: Record<ToastTone, ToneStyle> = {
  success: {
    bg: colors.successMuted,
    fg: colors.success,
    border: '#A7F3D0',
    icon: 'checkmark-circle',
  },
  warning: {
    bg: colors.warningMuted,
    fg: colors.warning,
    border: '#FDE68A',
    icon: 'cloud-offline-outline',
  },
  danger: {
    bg: colors.dangerMuted,
    fg: colors.danger,
    border: '#FECACA',
    icon: 'alert-circle',
  },
  info: {
    bg: colors.infoMuted,
    fg: colors.info,
    border: colors.primarySoft,
    icon: 'information-circle',
  },
}

/**
 * Global toast host — mount once under SafeAreaProvider.
 * Soft pill cards: green success, amber warning, red danger.
 */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast)
  const hide = useToastStore((s) => s.hide)
  const insets = useSafeAreaInsets()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-12)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    if (!toast) {
      opacity.setValue(0)
      translateY.setValue(-12)
      return
    }

    opacity.setValue(0)
    translateY.setValue(-12)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.normal,
        useNativeDriver: true,
      }),
    ]).start()

    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: motion.fast,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: motion.fast,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) hide()
      })
    }, toast.durationMs)

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
  }, [toast, hide, opacity, translateY])

  if (!toast) return null

  const tone = TONES[toast.tone]

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + spacing.sm }]}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          onPress={hide}
          style={[
            styles.toast,
            {
              backgroundColor: tone.bg,
              borderColor: tone.border,
            },
          ]}
        >
          <Ionicons name={tone.icon} size={20} color={tone.fg} />
          <Text style={[styles.message, { color: tone.fg }]} numberOfLines={3}>
            {toast.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: spacing.lg,
    alignItems: 'stretch',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.float,
  },
  message: {
    ...typography.captionStrong,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
})
