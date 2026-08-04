import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, spacing, typography } from '@/theme'
import { openMail, openMaps, openTel, openWhatsApp } from '@/features/crm/utils'

type Props = {
  phone?: string | null
  email?: string | null
  mapQuery?: string | null
  whatsappText?: string
  size?: 'sm' | 'md'
}

function ActionBtn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={disabled ? colors.textMuted : colors.primary} />
      <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  )
}

export function QuickContactActions({ phone, email, mapQuery, whatsappText }: Props) {
  return (
    <View style={styles.row}>
      <ActionBtn icon="call-outline" label="Call" onPress={() => void openTel(phone)} disabled={!phone} />
      <ActionBtn
        icon="logo-whatsapp"
        label="WhatsApp"
        onPress={() => void openWhatsApp(phone, whatsappText)}
        disabled={!phone}
      />
      <ActionBtn
        icon="mail-outline"
        label="Email"
        onPress={() => void openMail(email)}
        disabled={!email}
      />
      {mapQuery ? (
        <ActionBtn icon="navigate-outline" label="Map" onPress={() => void openMaps(mapQuery)} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    minHeight: 44,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  label: { ...typography.captionStrong, color: colors.primary, fontSize: 14 },
  disabled: { opacity: 0.4, backgroundColor: colors.surfaceMuted },
  disabledLabel: { color: colors.textMuted },
})
