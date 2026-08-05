import { useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, spacing, typography } from '@/theme'
import { normalizeScan } from '@/features/store/api'
import { BarcodeCameraModal, isCameraBarcodeSupported } from '@/features/store/BarcodeCameraModal'

type Props = {
  value: string
  onChangeText: (t: string) => void
  /** Fired when user finishes scan (hardware wedge Enter, camera, or Go). */
  onSubmitScan?: (normalized: string) => void
  placeholder?: string
  label?: string
  autoFocus?: boolean
  /** Hide camera button even on device (e.g. pure keyboard fields). */
  disableCamera?: boolean
  style?: StyleProp<ViewStyle>
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'onSubmitEditing'>
}

/**
 * Warehouse-friendly field:
 * - Keyboard wedge scanners → Enter submits
 * - Soft keyboard type + Go
 * - Device camera barcode/QR (expo-camera) via camera button
 */
export function ScanField({
  value,
  onChangeText,
  onSubmitScan,
  placeholder = 'Scan or type…',
  label,
  autoFocus,
  disableCamera,
  style,
  inputProps,
}: Props) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraOk = isCameraBarcodeSupported() && !disableCamera

  const hint = useMemo(() => {
    if (cameraOk) {
      return 'Camera · keyboard wedge · or type + Go'
    }
    if (Platform.OS === 'web') {
      return 'Type or use a keyboard-wedge scanner (Enter)'
    }
    return 'Scanner OK — aim and trigger; or type and press Go'
  }, [cameraOk])

  const emit = (raw: string) => {
    const n = normalizeScan(raw)
    if (!n) return
    onChangeText(n)
    onSubmitScan?.(n)
  }

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Ionicons name="barcode-outline" size={22} color={colors.primary} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            const n = normalizeScan(value)
            if (n) onSubmitScan?.(n)
          }}
          {...inputProps}
        />
        {cameraOk ? (
          <Pressable
            onPress={() => setCameraOpen(true)}
            style={styles.camBtn}
            accessibilityLabel="Open camera barcode scanner"
            hitSlop={8}
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{hint}</Text>

      <BarcodeCameraModal
        visible={cameraOpen}
        title={label ? `Scan ${label}` : 'Scan barcode'}
        onClose={() => setCameraOpen(false)}
        onScanned={(code) => {
          setCameraOpen(false)
          emit(code)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  camBtn: {
    padding: spacing.xs,
    minWidth: 36,
    alignItems: 'center',
  },
  hint: { ...typography.micro, color: colors.textMuted, marginTop: 4 },
})
