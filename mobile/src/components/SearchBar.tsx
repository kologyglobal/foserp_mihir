import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  onClear?: () => void
  onFocus?: () => void
  style?: StyleProp<ViewStyle>
  autoFocus?: boolean
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  onFocus,
  style,
  autoFocus,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search-outline" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        autoFocus={autoFocus}
        onFocus={onFocus}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable
          onPress={onClear ?? (() => onChangeText(''))}
          hitSlop={10}
          accessibilityLabel="Clear search"
          style={({ pressed }) => pressed && styles.clearPressed}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    ...shadows.soft,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.md,
  },
  clearPressed: { opacity: 0.7 },
})
