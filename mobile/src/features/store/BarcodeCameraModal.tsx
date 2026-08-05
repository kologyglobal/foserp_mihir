import { useCallback, useRef, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { PrimaryButton, SecondaryButton } from '@/components'
import { colors, spacing, typography } from '@/theme'
import { normalizeScan } from '@/features/store/api'

const BARCODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf14',
  'pdf417',
  'aztec',
  'datamatrix',
] as const

type Props = {
  visible: boolean
  title?: string
  onClose: () => void
  /** Called once per successful scan with normalized payload. */
  onScanned: (normalized: string) => void
}

/**
 * Full-screen camera barcode / QR reader (expo-camera).
 * Dedupes rapid re-scans; parent should close or re-open for next scan.
 */
export function BarcodeCameraModal({
  visible,
  title = 'Scan barcode',
  onClose,
  onScanned,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const lockedRef = useRef(false)
  const lastDataRef = useRef('')
  const lastAtRef = useRef(0)

  const handleBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      const data = normalizeScan(result.data ?? '')
      if (!data || lockedRef.current) return
      const now = Date.now()
      // Ignore duplicate frame events for the same code within 1.5s
      if (data === lastDataRef.current && now - lastAtRef.current < 1500) return
      lockedRef.current = true
      lastDataRef.current = data
      lastAtRef.current = now
      onScanned(data)
      // Unlock after short debounce so user can re-open and scan again
      setTimeout(() => {
        lockedRef.current = false
      }, 800)
    },
    [onScanned],
  )

  if (!visible) return null

  if (Platform.OS === 'web') {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            Camera barcode scanning is available on iOS and Android devices. On web, use a
            keyboard-wedge scanner or type the code.
          </Text>
          <PrimaryButton title="Close" onPress={onClose} style={styles.mt} />
        </View>
      </Modal>
    )
  }

  if (!permission) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={styles.center}>
          <Text style={styles.body}>Checking camera permission…</Text>
          <SecondaryButton title="Close" onPress={onClose} style={styles.mt} />
        </View>
      </Modal>
    )
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color={colors.primary} />
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.body}>
            Allow camera access to scan warehouse barcodes and QR codes on work orders, items, and
            batches.
          </Text>
          <PrimaryButton title="Allow camera" onPress={() => void requestPermission()} style={styles.mt} />
          <SecondaryButton title="Cancel" onPress={onClose} style={styles.mt} />
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.root}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: [...BARCODE_TYPES],
          }}
          onBarcodeScanned={handleBarcode}
        />
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close scanner">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>{title}</Text>
          <Pressable
            onPress={() => setTorch((v) => !v)}
            style={styles.iconBtn}
            accessibilityLabel="Toggle torch"
          >
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>Align barcode or QR in the frame</Text>
        </View>
      </View>
    </Modal>
  )
}

/**
 * True when on-device camera barcode is expected to work.
 * Web builds fall back to keyboard wedge / type-in.
 */
export function isCameraBarcodeSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android'
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { ...typography.title, marginTop: spacing.md, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  mt: { marginTop: spacing.md },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topTitle: { ...typography.bodyStrong, color: '#fff' },
  iconBtn: { padding: spacing.sm, minWidth: 44, alignItems: 'center' },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: '72%',
    aspectRatio: 1.4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  frameHint: {
    ...typography.caption,
    color: '#fff',
    marginTop: spacing.md,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
})
