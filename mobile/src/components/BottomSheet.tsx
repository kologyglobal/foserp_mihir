import type { ReactNode } from 'react'
import { Modal, View, Text, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  visible: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Premium bottom sheet shell (Modal). */
export function BottomSheet({ visible, onClose, title, children, style }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }, style]}>
        <View style={styles.handle} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '85%',
    ...shadows.float,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  title: { ...typography.subtitle, marginBottom: spacing.lg, fontSize: 18 },
})
